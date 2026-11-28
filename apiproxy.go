package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// How long the proxy waits at each step of a backend call.
//
// A chat answer has to stay open while it streams, so there is no overall
// deadline: a client timeout would cut every long answer. The three bounds below
// are what a socket needs instead, and each is generous enough that only a
// backend which is actually gone hits one.
var (
	// backendDialTimeout bounds connecting, and covers a host that does not
	// answer a SYN.
	backendDialTimeout = 30 * time.Second
	// backendHeaderTimeout bounds the wait for the response headers. It matches
	// the data cloud's own upstream budget: the proxy only hears from it once
	// the provider has started answering, which for a thinking model is minutes.
	backendHeaderTimeout = 10 * time.Minute
	// backendIdleTimeout bounds silence in the body. The data cloud writes an
	// SSE keepalive every 15 seconds while a stream is open, so a minute of
	// nothing means the connection is gone rather than slow.
	backendIdleTimeout = 60 * time.Second
)

// errBackendIdle is what a read returns once the backend has been silent for
// backendIdleTimeout. An error is what makes the reverse proxy abort the client
// connection, so the caller sees a broken answer instead of waiting forever.
var errBackendIdle = errors.New("desktop proxy: backend went silent")

// backendTransport is the transport every proxied call uses. The default
// transport has no response header timeout, which leaves a backend that accepts
// the connection and never answers holding the socket open indefinitely.
func backendTransport() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = (&net.Dialer{Timeout: backendDialTimeout, KeepAlive: 30 * time.Second}).DialContext
	transport.TLSHandshakeTimeout = 10 * time.Second
	transport.ResponseHeaderTimeout = backendHeaderTimeout
	return transport
}

// idleBody fails a read once the backend has sent nothing for a while, so a
// half-dead connection cannot hang the desktop app.
type idleBody struct {
	body io.ReadCloser
	idle time.Duration
}

func (b *idleBody) Read(buffer []byte) (int, error) {
	type read struct {
		n   int
		err error
	}
	// The read runs on its own goroutine because a blocked Read cannot be
	// interrupted any other way; closing the body is what ends it.
	done := make(chan read, 1)
	go func() {
		n, err := b.body.Read(buffer)
		done <- read{n: n, err: err}
	}()

	timer := time.NewTimer(b.idle)
	defer timer.Stop()

	select {
	case result := <-done:
		return result.n, result.err
	case <-timer.C:
		_ = b.body.Close()
		// The buffer is not touched again until the read it was handed has
		// returned, so this waits rather than leaking a write into it.
		<-done
		return 0, errBackendIdle
	}
}

func (b *idleBody) Close() error { return b.body.Close() }

// The paths the web build reaches its backends under. The desktop app keeps
// them relative and serves them through the asset server, which proxies them to
// whatever addresses the settings hold. Same origin, so no CORS rule is needed
// on the backends and streaming responses pass through untouched.
const (
	apiPrefix      = "/api"
	agentAPIPrefix = "/agent-api"
)

type apiProxy struct {
	settings *SettingsService

	mu     sync.Mutex
	routes map[string]*httputil.ReverseProxy
}

func apiProxyMiddleware(settings *SettingsService) application.Middleware {
	proxy := &apiProxy{settings: settings, routes: map[string]*httputil.ReverseProxy{}}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			base, prefix := proxy.route(r.URL.Path)
			if prefix == "" {
				next.ServeHTTP(w, r)
				return
			}
			handler, err := proxy.handler(base, prefix)
			if err != nil {
				http.Error(w, fmt.Sprintf("backend %q is not a valid address", base), http.StatusBadGateway)
				return
			}
			handler.ServeHTTP(w, r)
		})
	}
}

func (p *apiProxy) route(path string) (base string, prefix string) {
	servers := p.settings.servers()
	switch {
	case hasPrefix(path, agentAPIPrefix):
		return servers.AgentAPIBaseURL, agentAPIPrefix
	case hasPrefix(path, apiPrefix):
		return servers.APIBaseURL, apiPrefix
	}
	return "", ""
}

// handler builds one reverse proxy per address, so a change of address in the
// settings takes effect on the next request without touching the ones in use.
func (p *apiProxy) handler(base string, prefix string) (*httputil.ReverseProxy, error) {
	key := base + " " + prefix

	p.mu.Lock()
	defer p.mu.Unlock()

	if handler, ok := p.routes[key]; ok {
		return handler, nil
	}

	target, err := url.Parse(base)
	if err != nil {
		return nil, err
	}
	if target.Scheme == "" || target.Host == "" {
		return nil, fmt.Errorf("missing scheme or host")
	}

	handler := &httputil.ReverseProxy{
		Transport: backendTransport(),
		Rewrite: func(r *httputil.ProxyRequest) {
			r.Out.URL.Scheme = target.Scheme
			r.Out.URL.Host = target.Host
			r.Out.URL.Path = joinPath(target.Path, strings.TrimPrefix(r.In.URL.Path, prefix))
			r.Out.URL.RawPath = ""
			r.Out.Host = target.Host
		},
		// A model answer arrives as a server-sent event stream, so every write
		// goes out as it lands rather than being held in a buffer.
		FlushInterval: -1,
		ModifyResponse: func(response *http.Response) error {
			response.Body = &idleBody{body: response.Body, idle: backendIdleTimeout}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			// The reverse proxy has already closed the client connection when the
			// body failed mid-stream, so this only writes for a failure that
			// happened before anything reached the caller.
			if errors.Is(err, context.Canceled) {
				return
			}
			http.Error(w, fmt.Sprintf("backend %q did not answer: %v", base, err), http.StatusBadGateway)
		},
	}

	p.routes[key] = handler
	return handler, nil
}

func hasPrefix(path string, prefix string) bool {
	return path == prefix || strings.HasPrefix(path, prefix+"/")
}

func joinPath(base string, path string) string {
	switch {
	case base == "":
		if path == "" {
			return "/"
		}
		return path
	case path == "":
		return base
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}

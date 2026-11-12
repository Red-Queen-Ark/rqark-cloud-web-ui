package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

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
		Rewrite: func(r *httputil.ProxyRequest) {
			r.Out.URL.Scheme = target.Scheme
			r.Out.URL.Host = target.Host
			r.Out.URL.Path = joinPath(target.Path, strings.TrimPrefix(r.In.URL.Path, prefix))
			r.Out.URL.RawPath = ""
			r.Out.Host = target.Host
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

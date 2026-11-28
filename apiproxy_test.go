package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"strings"
	"testing"
	"time"
)

func TestJoinPath(t *testing.T) {
	cases := []struct {
		base string
		path string
		want string
	}{
		{"", "", "/"},
		{"", "/chat/1", "/chat/1"},
		{"/api", "", "/api"},
		{"/api", "/chat/1", "/api/chat/1"},
		{"/api/", "/chat/1", "/api/chat/1"},
		{"/prefix/api", "chat", "/prefix/api/chat"},
	}

	for _, c := range cases {
		if got := joinPath(c.base, c.path); got != c.want {
			t.Errorf("joinPath(%q, %q) = %q, want %q", c.base, c.path, got, c.want)
		}
	}
}

func TestProxyRoutes(t *testing.T) {
	proxy := &apiProxy{
		settings: &SettingsService{current: ServerConfig{
			APIBaseURL:      "http://data.local/api",
			AgentAPIBaseURL: "http://agent.local/api",
		}},
		routes: map[string]*httputil.ReverseProxy{},
	}

	base, prefix := proxy.route("/api/chat/1")
	if base != "http://data.local/api" || prefix != apiPrefix {
		t.Errorf("data cloud route = %q %q", base, prefix)
	}

	base, prefix = proxy.route("/agent-api/voice/ws")
	if base != "http://agent.local/api" || prefix != agentAPIPrefix {
		t.Errorf("agent cloud route = %q %q", base, prefix)
	}

	base, prefix = proxy.route("/assets/index.js")
	if base != "" || prefix != "" {
		t.Errorf("asset path should not be proxied, got %q %q", base, prefix)
	}
}

func TestMiddlewareForwardsAndLeavesAssetsAlone(t *testing.T) {
	var forwarded string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		forwarded = r.URL.Path
		_, _ = io.WriteString(w, "ok")
	}))
	defer backend.Close()

	settings := &SettingsService{current: ServerConfig{
		APIBaseURL:      backend.URL + "/api",
		AgentAPIBaseURL: backend.URL + "/api",
	}}
	assets := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "asset")
	})

	handler := apiProxyMiddleware(settings)(assets)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/chat/1", nil))
	if recorded := recorder.Body.String(); recorded != "ok" {
		t.Errorf("proxied response = %q", recorded)
	}
	if forwarded != "/api/chat/1" {
		t.Errorf("backend saw %q", forwarded)
	}

	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/index.html", nil))
	if recorded := recorder.Body.String(); recorded != "asset" {
		t.Errorf("asset response = %q", recorded)
	}
}

// serveProxy sends one request through a proxy pointed at backend, and returns
// the recorder. It is the shape every bound below is exercised in.
func serveProxy(t *testing.T, backend string, path string) *httptest.ResponseRecorder {
	t.Helper()

	settings := &SettingsService{current: ServerConfig{APIBaseURL: backend, AgentAPIBaseURL: backend}}
	handler := apiProxyMiddleware(settings)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected asset request %q", r.URL.Path)
	}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, path, nil))
	return recorder
}

// TestProxyGivesUpOnABackendThatNeverAnswers covers a socket the backend accepts
// and then leaves alone: without a response header timeout the request would
// never return, which is what a hung desktop app looks like.
func TestProxyGivesUpOnABackendThatNeverAnswers(t *testing.T) {
	previous := backendHeaderTimeout
	backendHeaderTimeout = 50 * time.Millisecond
	t.Cleanup(func() { backendHeaderTimeout = previous })

	release := make(chan struct{})
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer backend.Close()
	defer close(release)

	done := make(chan *httptest.ResponseRecorder, 1)
	go func() { done <- serveProxy(t, backend.URL+"/api", "/api/chat/1") }()

	select {
	case recorder := <-done:
		if recorder.Code != http.StatusBadGateway {
			t.Errorf("status = %d, want 502", recorder.Code)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the proxy never returned for a backend that sent no headers")
	}
}

// TestProxyGivesUpOnASilentStream covers a backend that answers and then stops
// mid-body: the read errors once the body has been silent for the idle budget,
// which aborts the connection rather than holding it open.
func TestProxyGivesUpOnASilentStream(t *testing.T) {
	previous := backendIdleTimeout
	backendIdleTimeout = 50 * time.Millisecond
	t.Cleanup(func() { backendIdleTimeout = previous })

	release := make(chan struct{})
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "data: one\n\n")
		w.(http.Flusher).Flush()
		<-release
	}))
	defer backend.Close()
	defer close(release)

	recorder := httptest.NewRecorder()
	settings := &SettingsService{current: ServerConfig{APIBaseURL: backend.URL + "/api"}}
	handler := apiProxyMiddleware(settings)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	started := time.Now()
	done := make(chan struct{})
	go func() {
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/chat/1", nil))
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the proxy never gave up on a silent stream")
	}

	// The idle budget is 50ms, so anything near the guard above means the body
	// was held open rather than given up on.
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Errorf("the proxy held a silent stream for %s", elapsed)
	}
	if body := recorder.Body.String(); body != "data: one\n\n" {
		t.Errorf("body = %q, want only what the backend sent", body)
	}
}

// TestProxyKeepsASlowStreamOpen covers the other side of the same bound: a
// backend that is slow but alive is not cut, because every write resets the
// wait.
func TestProxyKeepsASlowStreamOpen(t *testing.T) {
	previous := backendIdleTimeout
	backendIdleTimeout = 100 * time.Millisecond
	t.Cleanup(func() { backendIdleTimeout = previous })

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		for i := 0; i < 5; i++ {
			time.Sleep(30 * time.Millisecond)
			_, _ = io.WriteString(w, "data: tick\n\n")
			w.(http.Flusher).Flush()
		}
	}))
	defer backend.Close()

	recorder := serveProxy(t, backend.URL+"/api", "/api/chat/1")

	if got := strings.Count(recorder.Body.String(), "data: tick"); got != 5 {
		t.Errorf("body carried %d events, want 5: %q", got, recorder.Body.String())
	}
	if recorder.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", recorder.Code)
	}
}

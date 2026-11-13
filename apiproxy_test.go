package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"testing"
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

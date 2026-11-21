package main

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	defaultAPIBaseURL      = "http://localhost:7302/api"
	defaultAgentAPIBaseURL = "http://localhost:8000/api"
	configDirName          = "rqark-cloud-desktop"
	configFileName         = "server.json"
)

// ServerConfig is where the desktop app reaches the two backends.
type ServerConfig struct {
	APIBaseURL      string `json:"apiBaseUrl"`
	AgentAPIBaseURL string `json:"agentApiBaseUrl"`
}

// SettingsService keeps the backend addresses in a JSON file under the user
// config directory and hands them to the proxy on every request.
type SettingsService struct {
	path string

	mu      sync.RWMutex
	current ServerConfig
}

func NewSettingsService() (*SettingsService, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	service := &SettingsService{
		path: filepath.Join(dir, configDirName, configFileName),
		current: ServerConfig{
			APIBaseURL:      defaultAPIBaseURL,
			AgentAPIBaseURL: defaultAgentAPIBaseURL,
		},
	}
	service.read()
	return service, nil
}

// Load returns the addresses in use. It is called by the frontend on boot.
func (s *SettingsService) Load() ServerConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current
}

// Save stores new addresses and makes the proxy use them from the next request on.
func (s *SettingsService) Save(config ServerConfig) error {
	next := normalise(config)

	s.mu.Lock()
	s.current = next
	s.mu.Unlock()

	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(next)
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o600)
}

func (s *SettingsService) servers() ServerConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current
}

// read keeps the defaults when the file is missing or unreadable: a broken
// config file must not stop the app from starting.
func (s *SettingsService) read() {
	data, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return
		}
		return
	}
	var stored ServerConfig
	if err := json.Unmarshal(data, &stored); err != nil {
		return
	}
	s.current = normalise(stored)
}

func normalise(config ServerConfig) ServerConfig {
	api := strings.TrimRight(config.APIBaseURL, "/")
	if api == "" {
		api = defaultAPIBaseURL
	}
	agent := strings.TrimRight(config.AgentAPIBaseURL, "/")
	if agent == "" {
		agent = defaultAgentAPIBaseURL
	}
	return ServerConfig{APIBaseURL: api, AgentAPIBaseURL: agent}
}

package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
)

const (
	DefaultPassword  = "admin123"
	DefaultJWTSecret = "change-me-in-production"

	// defaultConfigPath is relative to the process working directory, which is
	// the repository root for the Docker image and the backend directory for
	// `cd backend && go run .`.
	defaultConfigPath = "data/config.json"
	configPathEnv     = "WARHUTV_CONFIG"
)

type SiteConfig struct {
	API    string `json:"api"`
	Name   string `json:"name"`
	Detail string `json:"detail,omitempty"`
}

type Config struct {
	SiteName     string                `json:"site_name"`
	Announcement string                `json:"announcement"`
	Password     string                `json:"password"`
	JWTSecret    string                `json:"jwt_secret"`
	APISite      map[string]SiteConfig `json:"api_site"`
	mu           sync.RWMutex

	// filePassword/fileJWTSecret keep the values that came from (or were
	// generated for) the config file. When the matching environment variable
	// overrides them, Save must not write the environment secret to disk.
	filePassword     string
	fileJWTSecret    string
	passwordFromEnv  bool
	jwtSecretFromEnv bool
}

// ConfigSnapshot is the mutex-free, serializable view of Config.
// Returning this (instead of a Config value) avoids copying the embedded
// RWMutex, which is both a go vet error and undefined behavior.
type ConfigSnapshot struct {
	SiteName     string                `json:"site_name"`
	Announcement string                `json:"announcement"`
	Password     string                `json:"password"`
	JWTSecret    string                `json:"jwt_secret"`
	APISite      map[string]SiteConfig `json:"api_site"`
}

var (
	// globalConfig is published once at startup by Load() (or lazily by the
	// first Get()) and is immutable from then on: the config is read once and
	// never changes while the process runs. Reads are a single atomic pointer
	// load — no global mutex on the hot request path. loadMu only serializes
	// the rare writes and the lazy first-load fallback.
	globalConfig atomic.Pointer[Config]
	loadMu       sync.Mutex
)

// DefaultPath returns the config file path: WARHUTV_CONFIG when set, otherwise
// data/config.json (relative to the working directory).
func DefaultPath() string {
	if path := strings.TrimSpace(os.Getenv(configPathEnv)); path != "" {
		return path
	}
	return defaultConfigPath
}

func defaultConfig() *Config {
	return &Config{
		SiteName:     "WarHutTV",
		Announcement: "本网站仅提供影视信息搜索服务",
		Password:     DefaultPassword,
		JWTSecret:    DefaultJWTSecret,
		APISite:      make(map[string]SiteConfig),
	}
}

// Load reads the config file at path, applies environment overrides and stores
// the result as the process-wide config. path may be empty, in which case
// DefaultPath() is used. Called once at startup; calling it again re-reads the
// file (used by tests).
//
// Precedence is environment > file > defaults:
//   - PASSWORD overrides password (and is never persisted by Save)
//   - JWT_SECRET overrides jwt_secret (and is never persisted by Save)
//   - SITE_NAME overrides site_name
//
// On a missing file a config with a generated secret is created; a malformed
// file falls back to defaults (the server then refuses to start if the insecure
// default password survives).
func Load(path string) {
	loadMu.Lock()
	defer loadMu.Unlock()
	globalConfig.Store(load(path))
}

// Get returns the process-wide config. The config is immutable after startup,
// so this is a lock-free atomic load on every request.
func Get() *Config {
	if cfg := globalConfig.Load(); cfg != nil {
		return cfg
	}
	return lazyLoad()
}

// lazyLoad handles the (rare) case where Get() is called before Load(), e.g.
// in library-only use or some unit tests. It never runs on the hot path.
func lazyLoad() *Config {
	loadMu.Lock()
	defer loadMu.Unlock()
	if cfg := globalConfig.Load(); cfg != nil {
		return cfg
	}
	cfg := load(DefaultPath())
	globalConfig.Store(cfg)
	return cfg
}

// load parses and resolves path into a fully initialized *Config. It is pure
// with respect to global state: the caller (Load / lazyLoad) publishes it.
func load(path string) *Config {
	if strings.TrimSpace(path) == "" {
		path = DefaultPath()
	}

	cfg, save, err := resolveForLoad(path)
	if err != nil {
		log.Printf("config: cannot load %s: %v; starting with defaults", path, err)
		cfg = defaultConfig()
		applyEnv(cfg, true)
		save = false
	}

	if !cfg.passwordFromEnv && cfg.Password == DefaultPassword {
		log.Printf("warning: using default password %q; set PASSWORD or edit %s before exposing this instance", DefaultPassword, path)
	}
	if save {
		if err := cfg.Save(path); err != nil {
			log.Printf("failed to save generated config %s: %v", path, err)
		}
	}
	return cfg
}

// resolveForLoad parses path and returns a fully resolved config (file + env).
// It is pure: no global state, no writes. save reports whether the caller
// should persist the file (missing file or a regenerated jwt_secret).
func resolveForLoad(path string) (*Config, bool, error) {
	cfg := defaultConfig()
	created := false

	data, err := os.ReadFile(path)
	switch {
	case err == nil:
		parsed, perr := parseConfig(data)
		if perr != nil {
			return nil, false, perr
		}
		cfg = parsed
	case errors.Is(err, os.ErrNotExist):
		created = true
	default:
		return nil, false, fmt.Errorf("read config %s: %w", path, err)
	}

	generated := applyEnv(cfg, true)
	return cfg, created || generated, nil
}

func parseConfig(data []byte) (*Config, error) {
	cfg := defaultConfig()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return cfg, nil
}

// applyEnv finalizes cfg: ensures a non-nil APISite, optionally regenerates an
// empty/default jwt_secret, records file-backed secrets before env overrides,
// and applies PASSWORD / JWT_SECRET / SITE_NAME. It returns whether it
// generated a secret. cfg is a fresh, unshared value so no locking is needed.
func applyEnv(cfg *Config, generateSecret bool) bool {
	if cfg.APISite == nil {
		cfg.APISite = make(map[string]SiteConfig)
	}

	generated := false
	if generateSecret && (cfg.JWTSecret == "" || cfg.JWTSecret == DefaultJWTSecret) {
		if secret, err := generateJWTSecret(); err == nil {
			cfg.JWTSecret = secret
			generated = true
		} else {
			log.Printf("failed to generate jwt secret: %v", err)
		}
	}

	// Remember the file-backed values before the environment overrides them.
	cfg.filePassword = cfg.Password
	cfg.fileJWTSecret = cfg.JWTSecret

	if value, ok := os.LookupEnv("PASSWORD"); ok && value != "" {
		cfg.Password = value
		cfg.passwordFromEnv = true
	}
	if value, ok := os.LookupEnv("JWT_SECRET"); ok && value != "" {
		cfg.JWTSecret = value
		cfg.jwtSecretFromEnv = true
	}
	if value, ok := os.LookupEnv("SITE_NAME"); ok && value != "" {
		cfg.SiteName = value
	}
	return generated
}

func Snapshot() ConfigSnapshot {
	cfg := Get()
	cfg.mu.RLock()
	defer cfg.mu.RUnlock()
	return cfg.snapshotLocked()
}

func JWTSecret() string {
	cfg := Get()
	cfg.mu.RLock()
	defer cfg.mu.RUnlock()
	return cfg.JWTSecret
}

func Password() string {
	cfg := Get()
	cfg.mu.RLock()
	defer cfg.mu.RUnlock()
	return cfg.Password
}

// Save writes the config atomically (temp file + fsync + rename) with 0600
// permissions so the JWT secret is not world-readable.
func (c *Config) Save(path string) error {
	c.mu.RLock()
	snapshot := c.snapshotLocked()
	c.mu.RUnlock()

	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	tmp, err := os.CreateTemp(dir, ".config-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op once the rename succeeded

	if err := tmp.Chmod(0600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func (c *Config) snapshotLocked() ConfigSnapshot {
	password := c.Password
	jwtSecret := c.JWTSecret
	// Environment-provided secrets stay in memory only.
	if c.passwordFromEnv && c.filePassword != "" {
		password = c.filePassword
	}
	if c.jwtSecretFromEnv && c.fileJWTSecret != "" {
		jwtSecret = c.fileJWTSecret
	}
	return ConfigSnapshot{
		SiteName:     c.SiteName,
		Announcement: c.Announcement,
		Password:     password,
		JWTSecret:    jwtSecret,
		APISite:      cloneAPISite(c.APISite),
	}
}

func cloneAPISite(src map[string]SiteConfig) map[string]SiteConfig {
	dst := make(map[string]SiteConfig, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func generateJWTSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate random bytes: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

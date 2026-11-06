package config

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	DefaultPassword  = "admin123"
	DefaultJWTSecret = "change-me-in-production"

	// defaultConfigPath is relative to the process working directory, which is
	// the repository root for the Docker image and the backend directory for
	// `cd backend && go run .`.
	defaultConfigPath = "data/config.json"
	configPathEnv     = "WARHUTV_CONFIG"

	// configWatchIntervalEnv controls how often the config file is polled for
	// changes. "0"/"off"/"false" disables polling (SIGHUP still works on Unix).
	configWatchIntervalEnv = "CONFIG_WATCH_INTERVAL"
	defaultWatchInterval   = 2 * time.Second
	minWatchInterval       = 200 * time.Millisecond
	maxWatchInterval       = 5 * time.Minute
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
	// globalConfig is assigned exactly once (on the first Load/Get) and from
	// then on is only ever mutated IN PLACE under its own mu. This is the key
	// to hot reload: every reader keeps a stable *Config pointer and sees a
	// consistent set of fields, so Reload never has to swap pointers under
	// concurrency (which would race with Get()).
	globalConfig *Config
	loadMu       sync.Mutex // serializes Load / Reload / initial Get
	watchOnce    sync.Once  // guards Watch against spawning two pollers
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
// DefaultPath() is used.
//
// Precedence is environment > file > defaults:
//   - PASSWORD overrides password (and is never persisted by Save)
//   - JWT_SECRET overrides jwt_secret (and is never persisted by Save)
//   - SITE_NAME overrides site_name
//
// On the initial load a missing file is created with a generated secret and a
// malformed file falls back to defaults (the server then refuses to start if
// the insecure default password survives). Reload() is deliberately stricter.
func Load(path string) {
	loadMu.Lock()
	defer loadMu.Unlock()
	loadLocked(path)
}

func Get() *Config {
	loadMu.Lock()
	defer loadMu.Unlock()
	if globalConfig == nil {
		loadLocked(DefaultPath())
	}
	return globalConfig
}

// loadLocked must be called with loadMu held.
func loadLocked(path string) {
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

	publish(cfg)

	if !cfg.passwordFromEnv && cfg.Password == DefaultPassword {
		log.Printf("warning: using default password %q; set PASSWORD or edit %s before exposing this instance", DefaultPassword, path)
	}
	if save {
		if err := cfg.Save(path); err != nil {
			log.Printf("failed to save generated config %s: %v", path, err)
		}
	}
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

func validateConfig(cfg *Config) error {
	if cfg.Password == "" || cfg.Password == DefaultPassword {
		return errors.New("admin password is empty or equals the insecure default")
	}
	if cfg.JWTSecret == "" || cfg.JWTSecret == DefaultJWTSecret {
		return errors.New("jwt secret is empty or equals the insecure default")
	}
	return nil
}

// publish installs cfg as the process config: the first time it assigns the
// pointer, afterwards it copies the fields IN PLACE so existing readers (which
// hold the *Config returned by Get) observe the new values without ever being
// left with a stale or dangling pointer.
func publish(cfg *Config) {
	if globalConfig == nil {
		globalConfig = cfg
		return
	}
	globalConfig.applyFrom(cfg)
}

func (c *Config) applyFrom(src *Config) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.SiteName = src.SiteName
	c.Announcement = src.Announcement
	c.Password = src.Password
	c.JWTSecret = src.JWTSecret
	c.APISite = cloneAPISite(src.APISite)
	c.filePassword = src.filePassword
	c.fileJWTSecret = src.fileJWTSecret
	c.passwordFromEnv = src.passwordFromEnv
	c.jwtSecretFromEnv = src.jwtSecretFromEnv
}

// Reload re-reads path and atomically applies it to the live config. It is
// strict: a missing file, malformed JSON, or an insecure effective password /
// jwt_secret is rejected and the current config is kept. It never regenerates
// the jwt_secret (which would invalidate every active session) and never writes
// the file. Environment overrides still take precedence.
func Reload(path string) error {
	if strings.TrimSpace(path) == "" {
		path = DefaultPath()
	}
	loadMu.Lock()
	defer loadMu.Unlock()

	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read config %s: %w", path, err)
	}
	cfg, err := parseConfig(data)
	if err != nil {
		return fmt.Errorf("reload %s: %w", path, err)
	}
	applyEnv(cfg, false)
	if err := validateConfig(cfg); err != nil {
		return fmt.Errorf("refusing to reload %s: %w (keeping previous config)", path, err)
	}
	publish(cfg)
	return nil
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

// WatchInterval parses CONFIG_WATCH_INTERVAL. It accepts a plain number of
// seconds ("5") or a Go duration ("2500ms"), clamps to [200ms, 5m], and treats
// "0"/"off"/"false" as "polling disabled". An invalid value falls back to the
// default. The second return value reports whether polling is enabled.
func WatchInterval() (time.Duration, bool) {
	raw := strings.TrimSpace(os.Getenv(configWatchIntervalEnv))
	if raw == "" {
		return defaultWatchInterval, true
	}
	if raw == "0" || strings.EqualFold(raw, "off") || strings.EqualFold(raw, "false") {
		return 0, false
	}

	var d time.Duration
	if secs, err := strconv.Atoi(raw); err == nil {
		d = time.Duration(secs) * time.Second
	} else if parsed, err := time.ParseDuration(raw); err == nil {
		d = parsed
	} else {
		log.Printf("config: invalid %s %q; using %s", configWatchIntervalEnv, raw, defaultWatchInterval)
		return defaultWatchInterval, true
	}
	if d < minWatchInterval {
		d = minWatchInterval
	}
	if d > maxWatchInterval {
		d = maxWatchInterval
	}
	return d, true
}

// Watch starts a single background goroutine that reloads the config whenever
// the file content changes (polling) or a SIGHUP arrives (sighup may be nil on
// platforms without it). It returns immediately and stops when ctx is done.
// Change detection is content-based (sha256), so a quick editor "truncate +
// write" is retried on the next poll until the file is valid again; a broken
// file is logged once per distinct content, never spamming the log.
func Watch(ctx context.Context, path string, sighup <-chan os.Signal) {
	watchOnce.Do(func() {
		go watchLoop(ctx, path, sighup)
	})
}

func watchLoop(ctx context.Context, path string, sighup <-chan os.Signal) {
	interval, enabled := WatchInterval()

	var tickC <-chan time.Time
	if enabled {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		tickC = ticker.C
		log.Printf("config watcher started (poll %s): %s", interval, path)
	} else {
		log.Printf("config watcher: polling disabled (SIGHUP only): %s", path)
	}

	// Baseline the current content so the already-loaded config is not
	// needlessly re-applied on the first tick.
	lastAttempt := currentHash(path)

	for {
		select {
		case <-ctx.Done():
			return
		case <-tickC:
			if h := currentHash(path); h != lastAttempt {
				lastAttempt = h
				attemptReload(path)
			}
		case <-sighup:
			log.Printf("config: SIGHUP received")
			lastAttempt = currentHash(path)
			attemptReload(path)
		}
	}
}

func attemptReload(path string) {
	if err := Reload(path); err != nil {
		log.Printf("config: %v", err)
	} else {
		log.Printf("config: reloaded from %s", path)
	}
}

// currentHash returns the sha256 of the config file, or "" when it cannot be
// read. Using content rather than mtime avoids missing edits with the same
// size and a coarse filesystem timestamp.
func currentHash(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

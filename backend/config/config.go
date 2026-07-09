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
	"sync"
)

const (
	DefaultPassword  = "admin123"
	DefaultJWTSecret = "change-me-in-production"
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
	globalConfig *Config
	once         sync.Once
)

func defaultConfig() *Config {
	return &Config{
		SiteName:     "WarHutTV",
		Announcement: "本网站仅提供影视信息搜索服务",
		Password:     DefaultPassword,
		JWTSecret:    DefaultJWTSecret,
		APISite:      make(map[string]SiteConfig),
	}
}

func Load(path string) {
	cfg := defaultConfig()
	created := false

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			if secret, genErr := generateJWTSecret(); genErr == nil {
				cfg.JWTSecret = secret
				created = true
			} else {
				log.Printf("failed to generate jwt secret: %v", genErr)
			}
		} else {
			log.Printf("failed to read config %s: %v", path, err)
		}
	} else if err := json.Unmarshal(data, cfg); err != nil {
		log.Printf("failed to parse config %s: %v", path, err)
	}

	if cfg.APISite == nil {
		cfg.APISite = make(map[string]SiteConfig)
	}
	if cfg.JWTSecret == "" || cfg.JWTSecret == DefaultJWTSecret {
		if secret, genErr := generateJWTSecret(); genErr == nil {
			cfg.JWTSecret = secret
			created = true
		} else {
			log.Printf("failed to generate jwt secret: %v", genErr)
		}
	}
	if cfg.Password == DefaultPassword {
		log.Printf("warning: using default password %q; update data/config.json before production use", DefaultPassword)
	}

	globalConfig = cfg
	if created {
		if err := cfg.Save(path); err != nil {
			log.Printf("failed to save generated config %s: %v", path, err)
		}
	}
}

func Get() *Config {
	once.Do(func() {
		Load("data/config.json")
	})
	return globalConfig
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

func Update(siteName, announcement *string, apiSite *map[string]SiteConfig) {
	cfg := Get()
	cfg.mu.Lock()
	defer cfg.mu.Unlock()
	if siteName != nil {
		cfg.SiteName = *siteName
	}
	if announcement != nil {
		cfg.Announcement = *announcement
	}
	if apiSite != nil {
		cfg.APISite = cloneAPISite(*apiSite)
	}
}

func Save(path string) error {
	return Get().Save(path)
}

func (c *Config) Save(path string) error {
	c.mu.RLock()
	snapshot := c.snapshotLocked()
	c.mu.RUnlock()

	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (c *Config) snapshotLocked() ConfigSnapshot {
	return ConfigSnapshot{
		SiteName:     c.SiteName,
		Announcement: c.Announcement,
		Password:     c.Password,
		JWTSecret:    c.JWTSecret,
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

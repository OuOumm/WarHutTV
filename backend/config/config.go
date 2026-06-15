package config

import (
	"encoding/json"
	"os"
	"sync"
)

type SiteConfig struct {
	API    string `json:"api"`
	Name   string `json:"name"`
	Detail string `json:"detail,omitempty"`
}

type Config struct {
	SiteName       string                `json:"site_name"`
	Announcement   string                `json:"announcement"`
	Username       string                `json:"username"`
	Password       string                `json:"password"`
	JWTSecret      string                `json:"jwt_secret"`
	AdBlockEnabled bool                  `json:"ad_block_enabled"`
	APISite        map[string]SiteConfig `json:"api_site"`

	mu sync.RWMutex
}

var (
	globalConfig *Config
	configOnce   sync.Once
)

func Load(path string) (*Config, error) {
	var err error
	configOnce.Do(func() {
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			err = readErr
			return
		}

		globalConfig = &Config{}
		if jsonErr := json.Unmarshal(data, globalConfig); jsonErr != nil {
			err = jsonErr
			return
		}

		if pass := os.Getenv("PASSWORD"); pass != "" {
			globalConfig.Password = pass
		}
		if user := os.Getenv("USERNAME"); user != "" {
			globalConfig.Username = user
		}
		if secret := os.Getenv("JWT_SECRET"); secret != "" {
			globalConfig.JWTSecret = secret
		}
	})
	return globalConfig, err
}

func Get() *Config {
	if globalConfig == nil {
		Load("config/config.json")
	}
	return globalConfig
}

func (c *Config) Update(newConfig *Config) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if newConfig.APISite != nil {
		c.APISite = newConfig.APISite
	}
	if newConfig.SiteName != "" {
		c.SiteName = newConfig.SiteName
	}
	if newConfig.Announcement != "" {
		c.Announcement = newConfig.Announcement
	}
	if newConfig.AdBlockEnabled {
		c.AdBlockEnabled = newConfig.AdBlockEnabled
	}
}

func (c *Config) Save(path string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

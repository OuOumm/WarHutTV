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

type LiveSource struct {
	Key           string `json:"key"`
	Name          string `json:"name"`
	URL           string `json:"url"`
	UA            string `json:"ua,omitempty"`
	EPG           string `json:"epg,omitempty"`
	ChannelNumber int    `json:"channelNumber,omitempty"`
	Disabled      bool   `json:"disabled,omitempty"`
}

type Config struct {
	SiteName     string                `json:"site_name"`
	Announcement string                `json:"announcement"`
	Password     string                `json:"password"`
	JWTSecret    string                `json:"jwt_secret"`
	APISite      map[string]SiteConfig `json:"api_site"`
	LiveConfig   []LiveSource          `json:"live_config,omitempty"`

	mu sync.RWMutex
}

var globalConfig *Config

func defaultConfig() *Config {
	return &Config{
		SiteName:     "WarHutTV",
		Announcement: "本网站仅提供影视信息搜索服务",
		Password:     "admin123",
		JWTSecret:    "change-me-in-production",
		APISite:      make(map[string]SiteConfig),
	}
}

func Load(path string) {
	globalConfig = defaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		return
	}

	json.Unmarshal(data, globalConfig)

	if pass := os.Getenv("PASSWORD"); pass != "" {
		globalConfig.Password = pass
	}
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		globalConfig.JWTSecret = secret
	}
}

func Get() *Config {
	if globalConfig == nil {
		Load("data/config.json")
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
	if newConfig.LiveConfig != nil {
		c.LiveConfig = newConfig.LiveConfig
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

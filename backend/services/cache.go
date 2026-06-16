package services

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const cacheDir = "data/cache"

type CacheItem struct {
	Data      interface{}
	ExpiresAt time.Time
}

// 内存缓存
type Cache struct {
	items map[string]*CacheItem
	mu    sync.RWMutex
}

func NewCache() *Cache {
	os.MkdirAll(cacheDir, 0755)
	return &Cache{
		items: make(map[string]*CacheItem),
	}
}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()

	if ok && time.Now().Before(item.ExpiresAt) {
		return item.Data, true
	}

	// 尝试从磁盘读取
	return c.getFromDisk(key)
}

func (c *Cache) Set(key string, data interface{}, ttl time.Duration) {
	c.mu.Lock()
	c.items[key] = &CacheItem{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
	c.mu.Unlock()

	// 同时写入磁盘
	c.saveToDisk(key, data, ttl)
}

func (c *Cache) Clear() {
	c.mu.Lock()
	c.items = make(map[string]*CacheItem)
	c.mu.Unlock()
	os.RemoveAll(cacheDir)
	os.MkdirAll(cacheDir, 0755)
}

func (c *Cache) getFromDisk(key string) (interface{}, bool) {
	hash := md5.Sum([]byte(key))
	path := filepath.Join(cacheDir, fmt.Sprintf("%x.json", hash))

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}

	var entry struct {
		Data      json.RawMessage `json:"data"`
		ExpiresAt time.Time       `json:"expires_at"`
	}
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, false
	}

	if time.Now().After(entry.ExpiresAt) {
		os.Remove(path)
		return nil, false
	}

	var result interface{}
	json.Unmarshal(entry.Data, &result)

	// 写回内存缓存
	c.mu.Lock()
	c.items[key] = &CacheItem{
		Data:      result,
		ExpiresAt: entry.ExpiresAt,
	}
	c.mu.Unlock()

	return result, true
}

func (c *Cache) saveToDisk(key string, data interface{}, ttl time.Duration) {
	hash := md5.Sum([]byte(key))
	path := filepath.Join(cacheDir, fmt.Sprintf("%x.json", hash))

	entry := struct {
		Data      interface{} `json:"data"`
		ExpiresAt time.Time   `json:"expires_at"`
	}{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}

	jsonData, err := json.Marshal(entry)
	if err != nil {
		return
	}

	os.WriteFile(path, jsonData, 0644)
}

var AppCache = NewCache()

package services

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

const (
	defaultCacheDir      = "data/cache"
	maxCacheDiskBytes    = 256 << 20 // 256 MiB
	cacheJanitorInterval = 10 * time.Minute
)

type CacheItem struct {
	Data      interface{}
	ExpiresAt time.Time
}

// Cache is a two-level (memory + JSON on disk) TTL cache.
//
// Memory entries are pruned by a background janitor; disk entries are pruned
// when read after expiry, by the same janitor, and by a size cap that evicts
// the entries closest to expiry first.
type Cache struct {
	dir   string
	items map[string]*CacheItem
	mu    sync.RWMutex
	stop  chan struct{}
	once  sync.Once

	// writeMu is held for reading by every disk write and for writing while the
	// directory is removed, so Clear never deletes a file mid-write.
	writeMu sync.RWMutex
	// pending tracks in-flight writes so Close/Clear can drain them. closeMu
	// guards the Add-vs-Wait invariant: once closed, writes run synchronously.
	closeMu sync.Mutex
	closed  bool
	pending sync.WaitGroup
}

func NewCache(dirs ...string) *Cache {
	dir := defaultCacheDir
	if len(dirs) > 0 && dirs[0] != "" {
		dir = dirs[0]
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Printf("cache: create dir %s: %v", dir, err)
	}
	c := &Cache{
		dir:   dir,
		items: make(map[string]*CacheItem),
		stop:  make(chan struct{}),
	}
	go c.janitor()
	return c
}

// Close stops the background janitor and waits for in-flight disk writes so a
// caller (or a test) can safely remove the cache directory afterwards.
func (c *Cache) Close() {
	c.once.Do(func() { close(c.stop) })

	c.closeMu.Lock()
	c.closed = true
	c.closeMu.Unlock()

	c.pending.Wait()
}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()

	if ok {
		if time.Now().Before(item.ExpiresAt) {
			return item.Data, true
		}
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
	}

	return c.getFromDisk(key)
}

func (c *Cache) Set(key string, data interface{}, ttl time.Duration) {
	expiresAt := time.Now().Add(ttl)

	c.mu.Lock()
	c.items[key] = &CacheItem{Data: data, ExpiresAt: expiresAt}
	c.mu.Unlock()

	// Persisting is best-effort and must not block the response path (SSE
	// handlers call Set after the stream is done).
	c.closeMu.Lock()
	if c.closed {
		// After Close (tests, shutdown) writes become synchronous so the caller
		// never sees a half-finished directory.
		c.closeMu.Unlock()
		c.saveToDisk(key, data, expiresAt)
		return
	}
	c.pending.Add(1)
	c.closeMu.Unlock()

	go func() {
		defer c.pending.Done()
		c.saveToDisk(key, data, expiresAt)
	}()
}

func (c *Cache) Clear() {
	c.mu.Lock()
	c.items = make(map[string]*CacheItem)
	c.mu.Unlock()

	// Take the write lock exclusively: it waits for in-flight writes to finish
	// and blocks new ones, so RemoveAll cannot delete a file mid-write.
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	if err := os.RemoveAll(c.dir); err != nil {
		log.Printf("cache: clear %s: %v", c.dir, err)
	}
	if err := os.MkdirAll(c.dir, 0700); err != nil {
		log.Printf("cache: recreate %s: %v", c.dir, err)
	}
}

func (c *Cache) getFromDisk(key string) (interface{}, bool) {
	data, err := os.ReadFile(c.cachePath(key))
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
		_ = os.Remove(c.cachePath(key))
		return nil, false
	}

	var result interface{}
	if err := json.Unmarshal(entry.Data, &result); err != nil {
		return nil, false
	}

	c.mu.Lock()
	c.items[key] = &CacheItem{Data: result, ExpiresAt: entry.ExpiresAt}
	c.mu.Unlock()

	return result, true
}

func (c *Cache) saveToDisk(key string, data interface{}, expiresAt time.Time) {
	entry := struct {
		Data      interface{} `json:"data"`
		ExpiresAt time.Time   `json:"expires_at"`
	}{
		Data:      data,
		ExpiresAt: expiresAt,
	}

	jsonData, err := json.Marshal(entry)
	if err != nil {
		log.Printf("cache: marshal %s: %v", key, err)
		return
	}

	c.writeMu.RLock()
	defer c.writeMu.RUnlock()
	if err := writeFileAtomic(c.cachePath(key), jsonData); err != nil {
		log.Printf("cache: write %s: %v", key, err)
	}
}

func (c *Cache) cachePath(key string) string {
	hash := md5.Sum([]byte(key))
	return filepath.Join(c.dir, fmt.Sprintf("%x.json", hash))
}

func (c *Cache) janitor() {
	ticker := time.NewTicker(cacheJanitorInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.stop:
			return
		case <-ticker.C:
			c.pruneMemory()
			c.pruneDisk()
		}
	}
}

func (c *Cache) pruneMemory() {
	now := time.Now()
	c.mu.Lock()
	for key, item := range c.items {
		if now.After(item.ExpiresAt) {
			delete(c.items, key)
		}
	}
	c.mu.Unlock()
}

type diskEntry struct {
	path      string
	size      int64
	expiresAt time.Time
}

func (c *Cache) pruneDisk() {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return
	}

	now := time.Now()
	var files []diskEntry
	var total int64
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		path := filepath.Join(c.dir, e.Name())
		info, err := e.Info()
		if err != nil {
			continue
		}
		expiresAt := readExpiresAt(path)
		if !expiresAt.IsZero() && now.After(expiresAt) {
			_ = os.Remove(path)
			continue
		}
		files = append(files, diskEntry{path: path, size: info.Size(), expiresAt: expiresAt})
		total += info.Size()
	}

	if total <= maxCacheDiskBytes {
		return
	}

	// Evict the entries that expire soonest until the cache fits the cap.
	sort.Slice(files, func(i, j int) bool {
		return files[i].expiresAt.Before(files[j].expiresAt)
	})
	for _, f := range files {
		if total <= maxCacheDiskBytes {
			break
		}
		if err := os.Remove(f.path); err == nil {
			total -= f.size
		}
	}
}

func readExpiresAt(path string) time.Time {
	data, err := os.ReadFile(path)
	if err != nil {
		return time.Time{}
	}
	var entry struct {
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.Unmarshal(data, &entry); err != nil {
		return time.Time{}
	}
	return entry.ExpiresAt
}

func writeFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".cache-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

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

var AppCache = NewCache()

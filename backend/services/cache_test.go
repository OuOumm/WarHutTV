package services

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCacheMemoryHitAndExpiry(t *testing.T) {
	c := NewCache(t.TempDir())
	defer c.Close()

	c.Set("k", "v", time.Minute)
	if got, ok := c.Get("k"); !ok || got != "v" {
		t.Fatalf("Get = %v, %v; want v, true", got, ok)
	}

	c.Set("short", "v", -time.Second)
	if _, ok := c.Get("short"); ok {
		t.Fatal("expired memory entry should miss")
	}
}

func TestCacheDiskRoundTrip(t *testing.T) {
	dir := t.TempDir()
	c := NewCache(dir)
	c.Set("disk-key", map[string]string{"a": "b"}, time.Minute)
	c.Close()

	deadline := time.Now().Add(2 * time.Second)
	for {
		if _, err := os.Stat(c.cachePath("disk-key")); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("cache file was not written")
		}
		time.Sleep(10 * time.Millisecond)
	}

	// A fresh instance must restore from disk.
	c2 := NewCache(dir)
	defer c2.Close()
	got, ok := c2.Get("disk-key")
	if !ok {
		t.Fatal("expected disk cache hit")
	}
	m, ok := got.(map[string]interface{})
	if !ok || m["a"] != "b" {
		t.Fatalf("unexpected restored value: %#v", got)
	}
}

func TestCacheRemovesExpiredDiskEntry(t *testing.T) {
	dir := t.TempDir()
	c := NewCache(dir)
	defer c.Close()

	if err := writeFileAtomic(c.cachePath("gone"), []byte(`{"data":"x","expires_at":"2000-01-01T00:00:00Z"}`)); err != nil {
		t.Fatal(err)
	}
	if _, ok := c.Get("gone"); ok {
		t.Fatal("expired disk entry should miss")
	}
	if _, err := os.Stat(c.cachePath("gone")); !os.IsNotExist(err) {
		t.Fatalf("expired entry should be deleted, stat err = %v", err)
	}
}

func TestCachePruneDiskRespectsExpiry(t *testing.T) {
	dir := t.TempDir()
	c := NewCache(dir)
	defer c.Close()

	expired := filepath.Join(dir, "expired.json")
	if err := os.WriteFile(expired, []byte(`{"data":1,"expires_at":"2000-01-01T00:00:00Z"}`), 0600); err != nil {
		t.Fatal(err)
	}
	c.pruneDisk()
	if _, err := os.Stat(expired); !os.IsNotExist(err) {
		t.Fatal("pruneDisk should remove expired entries")
	}
}

func TestCacheClear(t *testing.T) {
	dir := t.TempDir()
	c := NewCache(dir)
	defer c.Close()

	c.Set("k", "v", time.Minute)
	c.Clear()
	if _, ok := c.Get("k"); ok {
		t.Fatal("Clear should drop memory entries")
	}
	if entries, err := os.ReadDir(dir); err != nil || len(entries) != 0 {
		t.Fatalf("cache dir should be empty, entries=%d err=%v", len(entries), err)
	}
}

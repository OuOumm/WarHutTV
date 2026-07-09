package config

import "testing"

func TestCloneAPISiteIsIndependent(t *testing.T) {
	src := map[string]SiteConfig{"a": {API: "https://x", Name: "A"}}
	dst := cloneAPISite(src)
	dst["a"] = SiteConfig{API: "https://y", Name: "B"}

	if src["a"].API == dst["a"].API {
		t.Fatal("clone must be independent of the source map")
	}
}

func TestCloneAPISiteNilSafe(t *testing.T) {
	if cloneAPISite(nil) == nil {
		t.Fatal("cloning nil should yield a non-nil empty map")
	}
}

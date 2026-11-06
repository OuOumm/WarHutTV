package handlers

import (
	"testing"
	"time"
)

func TestSiteSearchTimeout(t *testing.T) {
	// Pin the product requirement explicitly (the constant itself must be 10s),
	// not just via a self-referential defaultSiteSearchTimeout comparison.
	if defaultSiteSearchTimeout != 10*time.Second {
		t.Fatalf("default per-site timeout = %s; want 10s", defaultSiteSearchTimeout)
	}
	cases := []struct {
		name string
		env  string
		want time.Duration
	}{
		{"default (unset)", "", defaultSiteSearchTimeout},
		{"plain seconds", "5", 5 * time.Second},
		{"go duration", "2500ms", 2500 * time.Millisecond},
		{"invalid falls back to default", "abc", defaultSiteSearchTimeout},
		{"zero is clamped to minimum", "0", minSiteSearchTimeout},
		{"below minimum is clamped", "100ms", minSiteSearchTimeout},
		{"above global is clamped", "999s", searchTimeout},
		{"negative is clamped", "-3", minSiteSearchTimeout},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SEARCH_SITE_TIMEOUT", tc.env)
			if got := siteSearchTimeout(); got != tc.want {
				t.Fatalf("siteSearchTimeout() = %v; want %v", got, tc.want)
			}
		})
	}
}

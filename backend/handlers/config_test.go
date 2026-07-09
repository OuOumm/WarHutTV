package handlers

import (
	"testing"

	"warhutv/config"
)

func TestValidateAPISite(t *testing.T) {
	valid := map[string]config.SiteConfig{
		"a": {API: "https://example.com/api", Name: "A"},
	}
	if err := validateAPISite(valid); err != nil {
		t.Fatalf("expected valid config, got: %v", err)
	}

	cases := []map[string]config.SiteConfig{
		{"x": {API: ""}},
		{"x": {API: "ftp://example.com"}},
		{"x": {API: "not-a-url"}},
	}
	for i, c := range cases {
		if err := validateAPISite(c); err == nil {
			t.Fatalf("case %d: expected validation error", i)
		}
	}
}

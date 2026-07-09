package services

import (
	"strings"
	"testing"
)

func TestReadLimitedWithinBound(t *testing.T) {
	data := strings.NewReader(strings.Repeat("a", 100))
	out, err := ReadLimited(data, 200)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 100 {
		t.Fatalf("got %d bytes, want 100", len(out))
	}
}

func TestReadLimitedExceedsBound(t *testing.T) {
	data := strings.NewReader(strings.Repeat("a", 100))
	if _, err := ReadLimited(data, 50); err == nil {
		t.Fatal("expected error when response exceeds limit")
	}
}

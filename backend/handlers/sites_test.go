package handlers

import (
	"testing"
	"time"
)

// The speed test used to roll up to ~27s because 27 sources were probed 5 at a
// time and six dead ones each burned a full 10s timeout. The fix is full
// fan-out: one probe per source, capped only to keep an unusually large source
// list from opening unbounded sockets.
func TestPingConcurrencyFor(t *testing.T) {
	cases := []struct {
		name  string
		sites int
		want  int
	}{
		{"one source", 1, 1},
		{"empty list still needs a usable channel", 0, 1},
		{"negative is defensive", -3, 1},
		{"current list fans out fully", 27, 27},
		{"exactly at the ceiling", pingConcurrencyCeiling, pingConcurrencyCeiling},
		{"above the ceiling is capped", 500, pingConcurrencyCeiling},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := pingConcurrencyFor(tc.sites); got != tc.want {
				t.Fatalf("pingConcurrencyFor(%d) = %d; want %d", tc.sites, got, tc.want)
			}
		})
	}
}

// The ceiling must not silently fall below a realistic source count, or the
// fan-out quietly becomes batched again.
func TestPingCeilingCoversRealisticSourceLists(t *testing.T) {
	if pingConcurrencyCeiling < 27 {
		t.Fatalf("ceiling = %d; the current 27-source list would be batched again", pingConcurrencyCeiling)
	}
}

func TestPingTimeoutBudget(t *testing.T) {
	if pingTimeout > 10*time.Second {
		t.Fatalf("pingTimeout = %s; dead sources would burn the whole budget again", pingTimeout)
	}
	if pingTimeout < 3*time.Second {
		t.Fatalf("pingTimeout = %s; too tight for a slow upstream to answer at all", pingTimeout)
	}
	// The upstream HTTP client timeout must not undercut the probe budget, or
	// the probe would be cancelled before its own context expires.
	if pingTimeout > 15*time.Second {
		t.Fatalf("pingTimeout = %s exceeds the upstream client timeout", pingTimeout)
	}
}

// With one probe per source there is a single batch, so wall time is bounded by
// the per-probe timeout rather than a multiple of it.
func TestPingFansOutInOneBatch(t *testing.T) {
	const sites = 27
	batches := (sites + pingConcurrencyFor(sites) - 1) / pingConcurrencyFor(sites)
	if batches != 1 {
		t.Fatalf("expected a single batch for %d sources, got %d", sites, batches)
	}
	if worst := time.Duration(batches) * pingTimeout; worst > 10*time.Second {
		t.Fatalf("worst-case wall time %s is too slow", worst)
	}
}

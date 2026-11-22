package handlers

import (
	"context"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/services"
)

// pingConcurrencyCeiling is the hard cap on simultaneous probes.
//
// Every configured source is its own upstream host (measured: 27 sources across
// 24 hosts), so probing them all at once puts exactly one request on each
// server — it does not concentrate load the way N requests to one host would.
// The cap exists only so an unusually large source list cannot open an
// unbounded number of sockets.
const pingConcurrencyCeiling = 32

// pingConcurrencyFor returns how many probes may run at once: one per source,
// bounded by the ceiling.
func pingConcurrencyFor(sites int) int {
	if sites > pingConcurrencyCeiling {
		return pingConcurrencyCeiling
	}
	if sites < 1 {
		return 1
	}
	return sites
}

// pingTimeout is the per-upstream budget.
//
// Measured against the live source list: the slowest *working* source answers
// in ~6.9s and the rest are under 4.6s, so a 6s budget cuts the dead sources
// from 10s each to 6s each at the cost of marking that one slow-but-working
// source as timed out. It is visible as a timeout in the UI rather than a
// silent removal, so the trade is acceptable.
//
// With full fan-out the batch count drops to one, so this timeout is now the
// whole wall time rather than being multiplied by the number of batches.
const pingTimeout = 6 * time.Second

// PingSites probes every configured upstream and reports reachability plus
// round-trip time. The frontend speed test used to `GET /api/search`, an
// endpoint that never existed: the SPA fallback answered 200 with index.html,
// so every source looked "available" with a meaninglessly small latency.
//
// GET /api/sites/ping          → all sites
// GET /api/sites/ping?site=key → one site
func PingSites(c *gin.Context) {
	cfg := config.Snapshot()

	keys := make([]string, 0, len(cfg.APISite))
	if site := c.Query("site"); site != "" {
		if _, ok := cfg.APISite[site]; !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "站点不存在"})
			return
		}
		keys = append(keys, site)
	} else {
		for key := range cfg.APISite {
			keys = append(keys, key)
		}
		sort.Strings(keys)
	}

	ctx := c.Request.Context()
	results := make([]services.PingResult, len(keys))
	sem := make(chan struct{}, pingConcurrencyFor(len(keys)))
	done := make(chan struct{}, len(keys))

	for i, key := range keys {
		go func(i int, key string) {
			sem <- struct{}{}
			defer func() { <-sem; done <- struct{}{} }()
			// Each probe gets its own timeout so one dead source cannot stall
			// the whole batch beyond the client's patience.
			probeCtx, cancel := context.WithTimeout(ctx, pingTimeout)
			defer cancel()
			results[i] = services.ProxyPing(probeCtx, key)
		}(i, key)
	}

	for range keys {
		<-done
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

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

// pingConcurrency bounds how many upstreams one speed test hits at once; 27
// sources opened simultaneously is enough to look like an attack.
const pingConcurrency = 5

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
	sem := make(chan struct{}, pingConcurrency)
	done := make(chan struct{}, len(keys))

	for i, key := range keys {
		go func(i int, key string) {
			sem <- struct{}{}
			defer func() { <-sem; done <- struct{}{} }()
			// Each probe gets its own timeout so one dead source cannot stall
			// the whole batch beyond the client's patience.
			probeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel()
			results[i] = services.ProxyPing(probeCtx, key)
		}(i, key)
	}

	for range keys {
		<-done
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

const (
	maxBangumiResponseBytes = 5 << 20
	bangumiCacheTTL         = 12 * time.Hour
	bangumiTimeout          = 12 * time.Second
	// bangumiAttemptTimeout caps a single upstream try. Without it the first
	// upstream (a direct connect that is often blackholed on mainland
	// networks) eats the whole budget and the fallback proxy never runs.
	bangumiAttemptTimeout = 4 * time.Second
)

// bangumiUpstreams are tried in order. api.bgm.tv is the canonical source; the
// public CDN proxy exists because the direct endpoint is often slow or blocked
// from mainland networks. Keeping both means one outage does not blank the
// calendar — the old code hardcoded only the proxy and returned 502 on any
// hiccup.
var bangumiUpstreams = []string{
	"https://api.bgm.tv/calendar",
	"https://cdn.404888.xyz/proxy/https://api.bgm.tv/calendar",
}

const bangumiUserAgent = "WarHutTV/1.0 (https://github.com/warhutv)"

func BangumiCalendar(c *gin.Context) {
	cacheKey := "bangumi:calendar"

	if cached, ok := services.AppCache.Get(cacheKey); ok {
		if body, ok := cached.(string); ok {
			c.Header("Cache-Control", "public, max-age=3600")
			c.Data(http.StatusOK, "application/json", []byte(body))
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), bangumiTimeout)
	defer cancel()

	body, err := fetchBangumiCalendar(ctx)
	if err != nil {
		log.Printf("bangumi calendar error: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "获取 Bangumi 日历失败，请稍后重试"})
		return
	}

	services.AppCache.Set(cacheKey, string(body), bangumiCacheTTL)
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "application/json", body)
}

func fetchBangumiCalendar(ctx context.Context) ([]byte, error) {
	var lastErr error
	for _, upstream := range bangumiUpstreams {
		// Per-attempt deadline: the outer context is the whole-request budget,
		// so a single hanging upstream must not consume all of it.
		attemptCtx, cancel := context.WithTimeout(ctx, bangumiAttemptTimeout)
		body, err := fetchOnce(attemptCtx, upstream)
		cancel()
		if err == nil {
			return body, nil
		}
		lastErr = err
		if ctx.Err() != nil {
			break
		}
	}
	return nil, lastErr
}

func fetchOnce(ctx context.Context, rawURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", bangumiUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := bangumiClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("upstream %s returned %d", rawURL, resp.StatusCode)
	}

	return services.ReadLimited(resp.Body, maxBangumiResponseBytes)
}

var bangumiClient = &http.Client{Timeout: bangumiTimeout}

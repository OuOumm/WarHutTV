package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

const (
	doubanCacheTTL    = 2 * time.Hour
	doubanTimeout     = 12 * time.Second
	maxDoubanRespSize = 4 << 20
	// doubanAttemptTimeout bounds one mirror attempt so a blackholed host does
	// not consume the whole budget and starve the fallbacks.
	doubanAttemptTimeout = 4 * time.Second
)

// doubanAPIHosts are mirrors of m.douban.com (rexxar API). The first entry is
// the community mirror; the last is the origin, which is unreachable from many
// networks but is the correct fallback when the mirrors are down.
var doubanAPIHosts = []string{
	"https://m.douban.cmliussss.net",
	"https://m.douban.cmliussss.com",
	"https://m.douban.com",
}

// doubanMovieHosts mirror movie.douban.com (search_subjects).
var doubanMovieHosts = []string{
	"https://movie.douban.cmliussss.net",
	"https://movie.douban.cmliussss.com",
	"https://movie.douban.com",
}

var doubanClient = &http.Client{Timeout: doubanTimeout}

// DoubanProxy forwards a whitelisted subset of the Douban API through the
// backend. Before this existed the browser talked to third-party mirrors
// directly: availability, CORS and rate limits were entirely theirs, the
// spoofed User-Agent/Referer headers were silently dropped by the browser, and
// the mirror choice was baked into the frontend.
//
// GET /api/douban/rexxar/api/v2/<...>?<query>
// GET /api/douban/j/search_subjects?<query>
func DoubanProxy(c *gin.Context) {
	path := strings.TrimPrefix(c.Param("path"), "/")
	path = strings.TrimPrefix(path, "/")

	hosts, ok := doubanHostsFor(path)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "不支持的豆瓣接口"})
		return
	}

	rawQuery := c.Request.URL.RawQuery
	cacheKey := "douban:" + path
	if rawQuery != "" {
		cacheKey += "?" + rawQuery
	}

	if cached, ok := services.AppCache.Get(cacheKey); ok {
		if body, ok := cached.(string); ok {
			c.Header("Cache-Control", "public, max-age=600")
			c.Data(http.StatusOK, "application/json", []byte(body))
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), doubanTimeout)
	defer cancel()

	body, err := fetchDouban(ctx, hosts, path, rawQuery)
	if err != nil {
		log.Printf("douban proxy error for %s: %v", path, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "获取豆瓣数据失败，请稍后重试"})
		return
	}

	services.AppCache.Set(cacheKey, string(body), doubanCacheTTL)
	c.Header("Cache-Control", "public, max-age=600")
	c.Data(http.StatusOK, "application/json", body)
}

// doubanHostsFor implements the allowlist. Anything outside these two shapes is
// rejected so the endpoint cannot be used as an open proxy.
func doubanHostsFor(path string) ([]string, bool) {
	switch {
	case strings.HasPrefix(path, "rexxar/api/v2/"):
		return doubanAPIHosts, true
	case path == "j/search_subjects":
		return doubanMovieHosts, true
	default:
		return nil, false
	}
}

func fetchDouban(ctx context.Context, hosts []string, path, rawQuery string) ([]byte, error) {
	var lastErr error
	for _, host := range hosts {
		target := host + "/" + path
		if rawQuery != "" {
			target += "?" + rawQuery
		}

		attemptCtx, cancel := context.WithTimeout(ctx, doubanAttemptTimeout)
		body, err := fetchDoubanOnce(attemptCtx, target)
		cancel()
		if err == nil {
			return body, nil
		}
		lastErr = err
		// A deadline or a cancelled request won't be fixed by another mirror.
		if ctx.Err() != nil {
			break
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no douban mirror available")
	}
	return nil, lastErr
}

func fetchDoubanOnce(ctx context.Context, rawURL string) ([]byte, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid douban url")
	}
	if services.IsBlockedHost(parsed.Host) {
		return nil, fmt.Errorf("blocked douban host %s", parsed.Host)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	// These are sent by the server, so they are actually honoured (unlike the
	// browser-side attempt this replaces).
	req.Header.Set("User-Agent",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://movie.douban.com/")
	req.Header.Set("Accept", "application/json")

	resp, err := doubanClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("upstream %s returned %d", parsed.Host, resp.StatusCode)
	}

	return services.ReadLimited(resp.Body, maxDoubanRespSize)
}

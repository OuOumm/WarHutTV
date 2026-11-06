package handlers

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/middleware"
	"warhutv/services"
	"warhutv/utils"
)

const (
	searchTimeout            = 20 * time.Second
	defaultSiteSearchTimeout = 10 * time.Second
	minSiteSearchTimeout     = 500 * time.Millisecond
	searchCacheTTL           = 2 * time.Hour
	searchHeartbeat          = 15 * time.Second
	maxKeywordLength         = 100
	maxSearchPage            = 100
	maxSearchPageSize        = 100
)

// siteSearchTimeout is the per-upstream budget. A single dead or slow source is
// discarded after this long instead of holding the whole SSE stream open. It is
// read from SEARCH_SITE_TIMEOUT on every request so operators can tune it
// without rebuilding; both plain seconds ("10") and Go durations ("2500ms") are
// accepted. The value is clamped to [minSiteSearchTimeout, searchTimeout].
// The 10s default keeps most slow-but-usable sources (several take 4–6s) while
// still capping a hung source well below the 20s global budget.
func siteSearchTimeout() time.Duration {
	raw := os.Getenv("SEARCH_SITE_TIMEOUT")
	if raw == "" {
		return defaultSiteSearchTimeout
	}
	var d time.Duration
	if seconds, err := strconv.Atoi(raw); err == nil {
		d = time.Duration(seconds) * time.Second
	} else if parsed, err := time.ParseDuration(raw); err == nil {
		d = parsed
	} else {
		log.Printf("search: invalid SEARCH_SITE_TIMEOUT %q; using %s", raw, defaultSiteSearchTimeout)
		return defaultSiteSearchTimeout
	}
	if d < minSiteSearchTimeout {
		d = minSiteSearchTimeout
	}
	if d > searchTimeout {
		d = searchTimeout
	}
	return d
}

type siteResult struct {
	SiteKey string               `json:"site_key"`
	Name    string               `json:"name"`
	List    []services.VideoItem `json:"list"`
	Error   string               `json:"error,omitempty"`
}

func setSSEHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
}

func writeSSE(c *gin.Context, event string, data interface{}) bool {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return false
	}
	if _, err := fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, jsonData); err != nil {
		return false
	}
	c.Writer.Flush()
	return true
}

// searchCacheKey includes a fingerprint of the configured site set so that
// adding or removing a source never serves results from the previous set.
func searchCacheKey(keyword string, pg int, sites map[string]config.SiteConfig) string {
	keys := make([]string, 0, len(sites))
	for key := range sites {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	sum := md5.Sum([]byte(strings.Join(keys, ",")))
	return fmt.Sprintf("search:%x:%s:%d", sum[:8], keyword, pg)
}

func replayCachedSearch(c *gin.Context, cached interface{}, keyword string) bool {
	var results []siteResult
	cacheJSON, err := json.Marshal(cached)
	if err != nil || json.Unmarshal(cacheJSON, &results) != nil {
		return false
	}

	if !writeSSE(c, "start", map[string]interface{}{
		"keyword":    keyword,
		"site_count": len(results),
	}) {
		return true
	}
	for i, r := range results {
		if !writeSSE(c, "result", map[string]interface{}{
			"site":      r.SiteKey,
			"name":      r.Name,
			"data":      r,
			"completed": i + 1,
			"total":     len(results),
		}) {
			return true
		}
	}
	writeSSE(c, "done", map[string]interface{}{"completed": len(results), "total": len(results)})
	return true
}

func SearchStream(c *gin.Context) {
	token, ok := middleware.ExtractToken(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
		return
	}
	if _, err := utils.ValidateToken(token, config.JWTSecret()); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌"})
		return
	}

	keyword := strings.TrimSpace(c.Query("wd"))
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "搜索关键词不能为空"})
		return
	}
	if len([]rune(keyword)) > maxKeywordLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("搜索关键词不能超过 %d 个字符", maxKeywordLength)})
		return
	}

	pg := 1
	if pgStr := c.Query("pg"); pgStr != "" {
		parsed, err := strconv.Atoi(pgStr)
		if err != nil || parsed < 1 || parsed > maxSearchPage {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("页码必须是 1-%d 之间的整数", maxSearchPage)})
			return
		}
		pg = parsed
	}

	cacheKey := searchCacheKey(keyword, pg, config.Snapshot().APISite)
	if cached, ok := services.AppCache.Get(cacheKey); ok {
		setSSEHeaders(c)
		if _, ok := c.Writer.(http.Flusher); !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming not supported"})
			return
		}
		c.Status(http.StatusOK)
		if replayCachedSearch(c, cached, keyword) {
			return
		}
	}

	setSSEHeaders(c)

	if _, ok := c.Writer.(http.Flusher); !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming not supported"})
		return
	}
	c.Status(http.StatusOK)

	sites := config.Snapshot().APISite
	siteCount := len(sites)
	if siteCount == 0 {
		writeSSE(c, "start", map[string]interface{}{"keyword": keyword, "site_count": 0})
		writeSSE(c, "done", map[string]interface{}{"completed": 0, "total": 0})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), searchTimeout)
	defer cancel()

	// Each upstream gets its own (shorter) deadline. A dead or slow source is
	// discarded after perSite instead of pinning the whole stream open until the
	// global searchTimeout — that is what used to leave the UI stuck at "24/27".
	perSite := siteSearchTimeout()

	// All events go through one writer goroutine: gin's ResponseWriter is not
	// safe for concurrent writes, and a worker must never write after the
	// handler returned.
	events := make(chan sseEvent, siteCount*2+8)
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		for ev := range events {
			if !writeSSE(c, ev.event, ev.data) {
				cancel()
				return
			}
		}
	}()

	emit := func(event string, data interface{}) bool {
		select {
		case events <- sseEvent{event: event, data: data}:
			return true
		case <-ctx.Done():
			return false
		}
	}

	if !emit("start", map[string]interface{}{"keyword": keyword, "site_count": siteCount}) {
		close(events)
		<-writerDone
		return
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	completed := 0
	errCount := 0
	results := make([]siteResult, 0, siteCount)

	for siteKey, site := range sites {
		wg.Add(1)
		go func(key string, site config.SiteConfig) {
			defer wg.Done()

			// A per-site context is derived from (not replacing) the global ctx,
			// so a client disconnect still cancels everything in flight.
			siteCtx, siteCancel := context.WithTimeout(ctx, perSite)
			defer siteCancel()
			result, err := services.ProxySearch(siteCtx, key, keyword, pg)

			mu.Lock()
			completed++
			current := completed
			if err != nil {
				errCount++
			}
			mu.Unlock()

			if err != nil {
				// A source that exceeded its per-site budget is *discarded* and
				// still counts as completed, so the progress bar reaches
				// total/total instead of stalling. Other failures are reported
				// the same way.
				reason := "上游请求失败"
				if errors.Is(siteCtx.Err(), context.DeadlineExceeded) {
					reason = fmt.Sprintf("超时丢弃（>%s）", perSite)
					log.Printf("search: site %s discarded after %s: %v", key, perSite, err)
				} else {
					log.Printf("search: site %s failed: %v", key, err)
				}
				emit("error", map[string]interface{}{
					"site":      key,
					"name":      site.Name,
					"error":     reason,
					"discarded": true,
					"completed": current,
					"total":     siteCount,
				})
				return
			}

			for i := range result.List {
				result.List[i].SourceName = site.Name
				result.List[i].SiteKey = key
			}

			siteData := siteResult{
				SiteKey: key,
				Name:    site.Name,
				List:    result.List,
			}

			mu.Lock()
			results = append(results, siteData)
			mu.Unlock()

			emit("result", map[string]interface{}{
				"site":      key,
				"name":      site.Name,
				"data":      siteData,
				"completed": current,
				"total":     siteCount,
			})
		}(siteKey, site)
	}

	workersDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(workersDone)
	}()

	heartbeatDone := make(chan struct{})
	go func() {
		defer close(heartbeatDone)
		ticker := time.NewTicker(searchHeartbeat)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if !emit("ping", map[string]interface{}{"time": time.Now().Unix()}) {
					return
				}
			case <-workersDone:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	timedOut := false
	select {
	case <-workersDone:
	case <-ctx.Done():
		timedOut = errors.Is(ctx.Err(), context.DeadlineExceeded)
		// Cancel in-flight upstream requests and let the workers drain before
		// closing the event channel (they select on ctx, so they exit fast).
		cancel()
		<-workersDone
	}

	<-heartbeatDone

	mu.Lock()
	finalCompleted := completed
	finalErrCount := errCount
	finalResults := append([]siteResult(nil), results...)
	mu.Unlock()

	if timedOut {
		emit("timeout", map[string]interface{}{
			"completed": finalCompleted,
			"total":     siteCount,
		})
	}
	emit("done", map[string]interface{}{
		"completed": finalCompleted,
		"total":     siteCount,
	})

	close(events)
	<-writerDone

	// Only complete runs without upstream errors are cached; a timeout or a
	// partially failing run must not poison the cache for two hours.
	if !timedOut && finalErrCount == 0 && finalCompleted == siteCount {
		services.AppCache.Set(cacheKey, finalResults, searchCacheTTL)
	}
}

type sseEvent struct {
	event string
	data  interface{}
}

package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/services"
)

func Search(c *gin.Context) {
	site := c.Query("site")
	keyword := c.Query("wd")
	pg := 1

	if pgStr := c.Query("pg"); pgStr != "" {
		if p, err := strconv.Atoi(pgStr); err == nil {
			pg = p
		}
	}

	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "搜索关键词不能为空"})
		return
	}

	cacheKey := fmt.Sprintf("search:%s:%s:%d", site, keyword, pg)
	if cached, ok := services.AppCache.Get(cacheKey); ok {
		c.JSON(http.StatusOK, cached)
		return
	}

	// 单站点搜索
	if site != "" {
		result, err := services.ProxySearch(site, keyword, pg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		services.AppCache.Set(cacheKey, result, 1*time.Hour)
		c.JSON(http.StatusOK, result)
		return
	}

	// 多站点并行搜索，每个结果附带来源站点名
	// 整体超时 9 秒，慢站点不阻塞整体响应
	ctx := c.Request.Context()
	timedCtx, cancel := context.WithTimeout(ctx, 9*time.Second)
	defer cancel()

	cfg := config.Get()
	allResults := make(map[string]interface{})
	var mu sync.Mutex
	var wg sync.WaitGroup

	for siteKey := range cfg.APISite {
		wg.Add(1)
		go func(key string) {
			defer wg.Done()
			result, err := services.ProxySearch(key, keyword, pg)
			if err == nil {
				siteName := cfg.APISite[key].Name
				for i := range result.List {
					result.List[i].SourceName = siteName
					result.List[i].SiteKey = key
				}
				mu.Lock()
				allResults[key] = result
				mu.Unlock()
			}
		}(siteKey)
	}

	// 等待所有站点完成或超时，先到先回
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-timedCtx.Done():
		// 超时了，返回已收集到的结果
	}

	// 只缓存有数据的结果（至少一个站点返回了实际列表项）
	hasData := false
	for _, r := range allResults {
		if res, ok := r.(*services.SearchResult); ok && len(res.List) > 0 {
			hasData = true
			break
		}
	}
	if hasData {
		services.AppCache.Set(cacheKey, allResults, 1*time.Hour)
	}
	c.JSON(http.StatusOK, allResults)
}

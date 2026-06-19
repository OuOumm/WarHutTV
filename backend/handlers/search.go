package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"warhutv/config"
	"warhutv/services"
	"warhutv/utils"

	"github.com/gin-gonic/gin"
)

type siteResult struct {
	SiteKey string              `json:"site_key"`
	Name    string              `json:"name"`
	List    []services.VideoItem `json:"list"`
	Error   string              `json:"error,omitempty"`
}

func SearchStream(c *gin.Context) {
	// SSE 无法设置 header，通过 query 参数校验 token
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
		return
	}
	cfg := config.Get()
	if _, err := utils.ValidateToken(token, cfg.JWTSecret); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌"})
		return
	}

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

	siteCount := len(cfg.APISite)

	// 检查缓存
	cacheKey := fmt.Sprintf("search:%s:%d", keyword, pg)
	if cached, ok := services.AppCache.Get(cacheKey); ok {
		// 有缓存，直接流式返回
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")

		if _, ok := c.Writer.(http.Flusher); !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming not supported"})
			return
		}

		// 从缓存恢复类型（磁盘读取的 JSON 会丢失类型）
		var results []siteResult
		cacheJSON, _ := json.Marshal(cached)
		if err := json.Unmarshal(cacheJSON, &results); err == nil && len(results) > 0 {
			jsonData, _ := json.Marshal(map[string]interface{}{"keyword": keyword, "site_count": len(results)})
			fmt.Fprintf(c.Writer, "event: start\ndata: %s\n\n", jsonData)

			for i, r := range results {
				jsonData, _ := json.Marshal(map[string]interface{}{
					"site":      r.SiteKey,
					"name":      r.Name,
					"data":      r,
					"completed": i + 1,
					"total":     len(results),
				})
				fmt.Fprintf(c.Writer, "event: result\ndata: %s\n\n", jsonData)
				c.Writer.Flush()
			}

			doneData, _ := json.Marshal(map[string]interface{}{"completed": len(results), "total": len(results)})
			fmt.Fprintf(c.Writer, "event: done\ndata: %s\n\n", doneData)
			c.Writer.Flush()
			return
		}
	}

	// SSE 响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// 检查是否支持 Flush
	if _, ok := c.Writer.(http.Flusher); !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming not supported"})
		return
	}

	// 用于检测客户端是否断开
	clientGone := c.Request.Context().Done()

	// 安全发送 SSE 的辅助函数
	var writeMu sync.Mutex
	sendSSE := func(event string, data interface{}) bool {
		select {
		case <-clientGone:
			return false
		default:
		}

		writeMu.Lock()
		defer writeMu.Unlock()

		jsonData, _ := json.Marshal(data)
		_, err := fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, jsonData)
		if err != nil {
			return false
		}
		c.Writer.Flush()
		return true
	}

	// 发送开始事件
	if !sendSSE("start", map[string]interface{}{
		"keyword":    keyword,
		"site_count": siteCount,
	}) {
		return
	}

	timedCtx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	var mu sync.Mutex
	var wg sync.WaitGroup
	completed := 0
	var results []siteResult

	for siteKey := range cfg.APISite {
		wg.Add(1)
		go func(key string) {
			defer wg.Done()

			result, err := services.ProxySearch(key, keyword, pg)
			if err != nil {
				sendSSE("error", map[string]interface{}{
					"site":  key,
					"name":  cfg.APISite[key].Name,
					"error": err.Error(),
				})
				return
			}

			siteName := cfg.APISite[key].Name
			for i := range result.List {
				result.List[i].SourceName = siteName
				result.List[i].SiteKey = key
			}

			mu.Lock()
			completed++
			current := completed
			results = append(results, siteResult{
				SiteKey: key,
				Name:    siteName,
				List:    result.List,
			})
			mu.Unlock()

			sendSSE("result", map[string]interface{}{
				"site":      key,
				"name":      siteName,
				"data":      result,
				"completed": current,
				"total":     siteCount,
			})
		}(siteKey)
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-timedCtx.Done():
		mu.Lock()
		current := completed
		mu.Unlock()
		sendSSE("timeout", map[string]interface{}{
			"completed": current,
			"total":     siteCount,
		})
	}

	// 发送完成事件
	mu.Lock()
	finalCompleted := completed
	mu.Unlock()
	sendSSE("done", map[string]interface{}{
		"completed": finalCompleted,
		"total":     siteCount,
	})

	// 缓存结果
	services.AppCache.Set(cacheKey, results, 2*time.Hour)
}

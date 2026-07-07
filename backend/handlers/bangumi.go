package handlers

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

const maxBangumiResponseBytes = 5 << 20

var bangumiClient = &http.Client{
	Timeout: 30 * time.Second,
}

func BangumiCalendar(c *gin.Context) {
	cacheKey := "bangumi:calendar"

	if cached, ok := services.AppCache.Get(cacheKey); ok {
		if body, ok := cached.(string); ok {
			c.Data(http.StatusOK, "application/json", []byte(body))
			return
		}
	}

	url := "https://cdn.404888.xyz/proxy/https://api.bgm.tv/calendar"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "获取 Bangumi 日历失败"})
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

	resp, err := bangumiClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "获取 Bangumi 日历失败"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("获取 Bangumi 日历失败: 上游状态 %d", resp.StatusCode)})
		return
	}

	body, err := readLimitedBody(resp.Body, maxBangumiResponseBytes)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "获取 Bangumi 日历失败"})
		return
	}

	services.AppCache.Set(cacheKey, string(body), 12*time.Hour)
	c.Data(http.StatusOK, "application/json", body)
}

func readLimitedBody(r io.Reader, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("response exceeds %d bytes", limit)
	}
	return body, nil
}

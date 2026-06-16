package handlers

import (
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

var bangumiClient = &http.Client{
	Timeout: 3 * time.Second,
}

func BangumiCalendar(c *gin.Context) {
	cacheKey := "bangumi:calendar"

	if cached, ok := services.AppCache.Get(cacheKey); ok {
		c.Data(http.StatusOK, "application/json", cached.([]byte))
		return
	}

	url := "https://api.bgm.tv/calendar"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	req.Header.Set("User-Agent", "WarHutTV/1.0")

	resp, err := bangumiClient.Do(req)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	// 番剧日历每周更新一次，缓存12小时
	services.AppCache.Set(cacheKey, body, 12*time.Hour)

	c.Data(http.StatusOK, "application/json", body)
}

package handlers

import (
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

var bangumiClient = &http.Client{
	Timeout: 30 * time.Second,
}

func BangumiCalendar(c *gin.Context) {
	cacheKey := "bangumi:calendar"

	if cached, ok := services.AppCache.Get(cacheKey); ok {
		c.Data(http.StatusOK, "application/json", []byte(cached.(string)))
		return
	}

	url := "https://cdn.404888.xyz/proxy/https://api.bgm.tv/calendar"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

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

	services.AppCache.Set(cacheKey, string(body), 12*time.Hour)
	c.Data(http.StatusOK, "application/json", body)
}

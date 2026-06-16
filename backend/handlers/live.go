package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

func GetLiveChannels(c *gin.Context) {
	channels := []services.LiveChannel{
		{Name: "CCTV-1", URL: "http://example.com/cctv1.m3u8", Group: "央视频道"},
		{Name: "CCTV-5", URL: "http://example.com/cctv5.m3u8", Group: "央视频道"},
	}

	c.JSON(http.StatusOK, gin.H{
		"channels": channels,
	})
}

func StreamLive(c *gin.Context) {
	streamURL := c.Query("url")
	if streamURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少直播流URL"})
		return
	}

	if err := services.ProxyLiveStream(streamURL, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "直播流获取失败"})
		return
	}
}

package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

// GetLiveSources returns all enabled live sources
func GetLiveSources(c *gin.Context) {
	sources := services.GetLiveSources()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    sources,
	})
}

// GetLiveChannels returns channels for a specific source
func GetLiveChannels(c *gin.Context) {
	sourceKey := c.Query("source")
	if sourceKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少直播源参数"})
		return
	}

	data, err := services.GetCachedLiveChannels(sourceKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "频道信息未找到"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data.Channels,
	})
}

// PrecheckLiveStream checks the stream type
func PrecheckLiveStream(c *gin.Context) {
	url := c.Query("url")
	if url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}

	ua := getUA(c.Query("moontv-source"))
	streamType, err := services.CheckStreamType(url, ua)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "检测失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "type": streamType})
}

// StreamLive proxies a live stream
func StreamLive(c *gin.Context) {
	streamURL := c.Query("url")
	if streamURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少直播流URL"})
		return
	}

	ua := getUA(c.Query("moontv-source"))
	if err := services.ProxyLiveStream(streamURL, ua, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "直播流获取失败"})
		return
	}
}

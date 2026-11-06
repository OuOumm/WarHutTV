package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

// Play resolves one episode's playable URL.
//
// Query: site, ids (vod id), episode (optional episode name). With no episode
// the first episode of the first line is returned, which keeps old links and
// the "just open the detail page" flow working.
func Play(c *gin.Context) {
	site := c.Query("site")
	vodID := c.Query("ids")
	episode := c.Query("episode")

	if site == "" || vodID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少站点或视频ID"})
		return
	}

	playURL, err := services.ProxyPlay(c.Request.Context(), site, vodID, episode)
	if err != nil {
		log.Printf("play proxy error (site=%s ids=%s episode=%q): %v", site, vodID, episode, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "上游请求失败，请稍后重试"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": playURL,
	})
}

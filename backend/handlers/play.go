package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

func Play(c *gin.Context) {
	site := c.Query("site")
	vodID := c.Query("ids")
	episode := c.Query("episode")

	if site == "" || vodID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少站点或视频ID"})
		return
	}

	playURL, err := services.ProxyPlay(site, vodID, episode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": playURL,
	})
}

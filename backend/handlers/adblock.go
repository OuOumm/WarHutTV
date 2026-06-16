package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/services"
)

type AdBlockRequest struct {
	Enabled bool `json:"enabled"`
}

func GetAdBlockStatus(c *gin.Context) {
	cfg := config.Get()
	c.JSON(http.StatusOK, gin.H{
		"enabled": cfg.AdBlockEnabled,
	})
}

func SetAdBlockStatus(c *gin.Context) {
	var req AdBlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
		return
	}

	cfg := config.Get()
	cfg.AdBlockEnabled = req.Enabled
	services.DefaultAdBlocker.SetEnabled(req.Enabled)

	c.JSON(http.StatusOK, gin.H{
		"enabled": cfg.AdBlockEnabled,
		"message": "广告过滤设置已更新",
	})
}

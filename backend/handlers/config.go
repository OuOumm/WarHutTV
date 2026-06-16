package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/config"
)

func GetConfig(c *gin.Context) {
	cfg := config.Get()
	c.JSON(http.StatusOK, gin.H{
		"site_name":    cfg.SiteName,
		"announcement": cfg.Announcement,
		"ad_block":     cfg.AdBlockEnabled,
		"api_site":     cfg.APISite,
	})
}

type UpdateConfigRequest struct {
	SiteName       *string                    `json:"site_name,omitempty"`
	Announcement   *string                    `json:"announcement,omitempty"`
	AdBlockEnabled *bool                      `json:"ad_block,omitempty"`
	APISite        *map[string]config.SiteConfig `json:"api_site,omitempty"`
}

func UpdateConfig(c *gin.Context) {
	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
		return
	}

	cfg := config.Get()

	if req.SiteName != nil {
		cfg.SiteName = *req.SiteName
	}
	if req.Announcement != nil {
		cfg.Announcement = *req.Announcement
	}
	if req.AdBlockEnabled != nil {
		cfg.AdBlockEnabled = *req.AdBlockEnabled
	}
	if req.APISite != nil {
		cfg.APISite = *req.APISite
	}

	if err := cfg.Save("data/config.json"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "配置已更新"})
}

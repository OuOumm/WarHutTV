package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/utils"
)

func GetConfig(c *gin.Context) {
	cfg := config.Snapshot()

	resp := gin.H{
		"site_name":    cfg.SiteName,
		"announcement": cfg.Announcement,
	}

	// 已登录才返回 api_site
	if isAuthed(c) {
		resp["api_site"] = cfg.APISite
	}

	c.JSON(http.StatusOK, resp)
}

func isAuthed(c *gin.Context) bool {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return false
	}
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		return false
	}
	_, err := utils.ValidateToken(tokenString, config.JWTSecret())
	return err == nil
}

type UpdateConfigRequest struct {
	SiteName     *string                    `json:"site_name,omitempty"`
	Announcement *string                    `json:"announcement,omitempty"`
	APISite      *map[string]config.SiteConfig `json:"api_site,omitempty"`
}

func UpdateConfig(c *gin.Context) {
	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
		return
	}

	config.Update(req.SiteName, req.Announcement, req.APISite)

	if err := config.Save("data/config.json"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "配置已更新"})
}

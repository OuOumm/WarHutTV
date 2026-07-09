package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/middleware"
	"warhutv/services"
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
	token, ok := middleware.ExtractToken(c)
	if !ok {
		return false
	}
	_, err := utils.ValidateToken(token, config.JWTSecret())
	return err == nil
}

type UpdateConfigRequest struct {
	SiteName     *string                       `json:"site_name,omitempty"`
	Announcement *string                       `json:"announcement,omitempty"`
	APISite      *map[string]config.SiteConfig `json:"api_site,omitempty"`
}

// validateAPISite ensures every configured source points at a parseable
// http/https endpoint, rejecting junk that would surface as a runtime/SSRF error.
func validateAPISite(apiSite map[string]config.SiteConfig) error {
	for key, site := range apiSite {
		if strings.TrimSpace(site.API) == "" {
			return fmt.Errorf("api_site[%q] 缺少 api 地址", key)
		}
		u, err := url.Parse(site.API)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return fmt.Errorf("api_site[%q] 的 api 地址非法（仅支持 http/https）: %s", key, site.API)
		}
		if services.IsBlockedHost(u.Host) {
			return fmt.Errorf("api_site[%q] 指向内网/保留地址，已被 SSRF 防护拦截: %s", key, site.API)
		}
	}
	return nil
}

func UpdateConfig(c *gin.Context) {
	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求"})
		return
	}

	if req.APISite != nil {
		if err := validateAPISite(*req.APISite); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	config.Update(req.SiteName, req.Announcement, req.APISite)

	if err := config.Save("data/config.json"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "配置已更新"})
}

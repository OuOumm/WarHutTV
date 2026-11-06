package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/middleware"
	"warhutv/utils"
)

func GetConfig(c *gin.Context) {
	cfg := config.Snapshot()

	resp := gin.H{
		"site_name":    cfg.SiteName,
		"announcement": cfg.Announcement,
	}

	// 已登录才返回 api_site（播放页用它校验 :site 参数）
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

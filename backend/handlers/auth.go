package handlers

import (
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/utils"
)

type LoginRequest struct {
	Password string `json:"password" binding:"required"`
}

// setAuthCookie issues the session token as an HttpOnly cookie so it is never
// exposed to JavaScript (defends against token theft via XSS). Secure is set
// only when the connection is (or is fronted by) TLS, so plain-HTTP dev works.
func setAuthCookie(c *gin.Context, token string) {
	secure := c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https"
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("token", token, int((7 * 24 * time.Hour).Seconds()), "/", "", secure, true)
}

func clearAuthCookie(c *gin.Context) {
	secure := c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https"
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("token", "", -1, "/", "", secure, true)
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码不能为空"})
		return
	}

	if subtle.ConstantTimeCompare([]byte(req.Password), []byte(config.Password())) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密码错误"})
		return
	}

	token, err := utils.GenerateToken(config.JWTSecret(), 7*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	// Token travels only in the HttpOnly cookie — never in the JSON body.
	setAuthCookie(c, token)
	c.JSON(http.StatusOK, gin.H{"message": "登录成功"})
}

func Logout(c *gin.Context) {
	clearAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "已退出登录"})
}

func Verify(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"valid": true,
	})
}

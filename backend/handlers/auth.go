package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/utils"
)

type LoginRequest struct {
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码不能为空"})
		return
	}

	cfg := config.Get()

	if req.Password != cfg.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密码错误"})
		return
	}

	token, err := utils.GenerateToken(cfg.JWTSecret, 7*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     token,
		"expiresAt": time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
}

func Verify(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"valid": true,
	})
}

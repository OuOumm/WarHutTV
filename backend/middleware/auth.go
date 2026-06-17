package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/utils"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的认证格式"})
			c.Abort()
			return
		}

		cfg := config.Get()
		_, err := utils.ValidateToken(tokenString, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ValidateToken 验证 JWT token（用于 SSE 等无法设置 header 的场景）
func ValidateToken(token string) bool {
	cfg := config.Get()
	_, err := utils.ValidateToken(token, cfg.JWTSecret)
	return err == nil
}

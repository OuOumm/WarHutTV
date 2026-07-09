package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/utils"
)

// ExtractToken returns the bearer token from the Authorization header, falling
// back to the HttpOnly "token" cookie. This lets the SPA use cookie auth (XSS
// can't read the token) while still supporting header-based API clients.
func ExtractToken(c *gin.Context) (string, bool) {
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token != authHeader {
			return token, true
		}
	}
	if cookie, err := c.Cookie("token"); err == nil && cookie != "" {
		return cookie, true
	}
	return "", false
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := ExtractToken(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
			c.Abort()
			return
		}

		if _, err := utils.ValidateToken(token, config.JWTSecret()); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌"})
			c.Abort()
			return
		}

		c.Next()
	}
}

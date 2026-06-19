package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	limit "github.com/yangxikun/gin-limit-by-key"
	"golang.org/x/time/rate"
)

func LoginRateLimit() gin.HandlerFunc {
	return limit.NewRateLimiter(func(c *gin.Context) string {
		return c.ClientIP()
	}, func(c *gin.Context) (*rate.Limiter, time.Duration) {
		// 30分钟内最多5次，即每6分钟1个令牌，突发容量5
		return rate.NewLimiter(rate.Every(6*time.Minute), 5), 30 * time.Minute
	}, func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
			"error": "登录尝试过多，请30分钟后再试",
		})
	})
}

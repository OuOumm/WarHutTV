package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders applies defensive HTTP response headers to every response.
// HSTS is only emitted when the request arrived over (or behind) TLS so we
// don't break plain-HTTP dev deployments.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		c.Header("Content-Security-Policy", csp())

		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		c.Next()
	}
}

// csp 当前为全通配模式（所有者决策）：放开所有源、'unsafe-inline'/'unsafe-eval'
// 以及 data:/blob:/filesystem:/mediastream:，所有指令（含 manifest-src、media-src
// 等）均允许任意加载。后续如需收紧，再按业务白名单收敛。
func csp() string {
	return "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: filesystem: mediastream:; " +
		"script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
		"style-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
		"img-src * data: blob:; " +
		"font-src * data:; " +
		"connect-src * data: blob:; " +
		"media-src * data: blob:; " +
		"worker-src * 'unsafe-inline' data: blob:; " +
		"manifest-src * data: blob:; " +
		"object-src *; " +
		"frame-ancestors *; " +
		"base-uri *; " +
		"form-action *"
}

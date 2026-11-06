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
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		c.Header("Content-Security-Policy", csp())

		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		c.Next()
	}
}

// csp 其余指令保持全通配（所有者决策：视频源、豆瓣/Bangumi 图床、Artplayer
// 的 eval 都无法预先枚举）。但 frame-ancestors 必须收紧：浏览器里 CSP 优先于
// X-Frame-Options，写 * 会让上面的 DENY 完全失效，点击劫持防护形同虚设。
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
		"frame-ancestors 'self'; " +
		"base-uri *; " +
		"form-action *"
}

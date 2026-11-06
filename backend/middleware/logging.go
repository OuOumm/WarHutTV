package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// requestIDHeader lets a reverse proxy supply its own correlation id.
const requestIDHeader = "X-Request-Id"

// RequestID assigns a correlation id to every request and echoes it back.
//
// The default gin logger prints one line per request but has no request
// identity, so a client report ("it 500'd at 20:14") cannot be tied to the
// matching upstream error line. The id is server-generated (never trusted from
// the client unless a proxy set it) and is stable enough to grep for.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := strings.TrimSpace(c.GetHeader(requestIDHeader))
		if id == "" || len(id) > 64 {
			id = newRequestID()
		}
		c.Set("request_id", id)
		c.Writer.Header().Set(requestIDHeader, id)
		c.Next()
	}
}

// RequestLogger emits one structured line per request.
//
// Replaces gin's text logger, which dumped the raw query string — that meant
// every search keyword ended up in the server log, which is a privacy leak and
// makes the log noisy. Here only the path is logged; query values stay out.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		// SSE responses report 200 as soon as headers flush; keep the event so
		// long streams are still visible in the log.
		log.Printf(
			"request id=%s method=%s path=%s status=%d latency_ms=%d ip=%s ua=%q",
			c.GetString("request_id"),
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			time.Since(start).Milliseconds(),
			c.ClientIP(),
			truncate(c.Request.UserAgent(), 120),
		)
	}
}

func newRequestID() string {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(buf[:])
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

const (
	loginRateInterval = 6 * time.Minute // 5 attempts per 30 minutes
	loginRateBurst    = 5
	loginRateTTL      = 30 * time.Minute

	searchRateInterval = 3 * time.Second
	searchRateBurst    = 20
	searchRateTTL      = 2 * time.Minute
)

// Limiter throttles requests per key (usually a client IP).
//
// Login uses it explicitly from the handler instead of as a middleware: a
// middleware runs before the password check and therefore also counts
// successful logins, locking out users who log in normally five times.
// Search uses it as middleware because every search costs several upstream
// requests.
type Limiter struct {
	mu       sync.Mutex
	entries  map[string]*limiterEntry
	interval time.Duration
	burst    int
	ttl      time.Duration
}

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewLimiter(interval time.Duration, burst int, ttl time.Duration) *Limiter {
	return &Limiter{
		entries:  make(map[string]*limiterEntry),
		interval: interval,
		burst:    burst,
		ttl:      ttl,
	}
}

// Allow consumes one token for key and reports whether it was within the
// limit. Call Reset when a failure window should be cleared (successful login).
func (l *Limiter) Allow(key string) bool {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	l.pruneLocked(now)

	entry, ok := l.entries[key]
	if !ok {
		entry = &limiterEntry{
			limiter: rate.NewLimiter(rate.Every(l.interval), l.burst),
		}
		l.entries[key] = entry
	}
	entry.lastSeen = now
	return entry.limiter.Allow()
}

func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

func (l *Limiter) pruneLocked(now time.Time) {
	for key, entry := range l.entries {
		if now.Sub(entry.lastSeen) > l.ttl {
			delete(l.entries, key)
		}
	}
}

var (
	loginLimiter  = NewLimiter(loginRateInterval, loginRateBurst, loginRateTTL)
	searchLimiter = NewLimiter(searchRateInterval, searchRateBurst, searchRateTTL)
)

// LoginLimiterInstance returns the process-wide limiter shared by the login
// handler (consumed only on failed attempts).
func LoginLimiterInstance() *Limiter {
	return loginLimiter
}

// SearchRateLimit limits how often one client can start an aggregated search.
func SearchRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !searchLimiter.Allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "请求过于频繁，请稍后再试",
			})
			return
		}
		c.Next()
	}
}

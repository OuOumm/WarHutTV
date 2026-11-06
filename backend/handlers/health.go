package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Healthz is an unauthenticated liveness probe for Docker/Kubernetes.
//
// It deliberately does not touch upstream sources: a health check that fails
// because one of 30 third-party APIs is down would restart a perfectly healthy
// container. It answers "the process is up and serving HTTP".
func Healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

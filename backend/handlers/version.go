package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// Version is injected by main at startup (build-time -X main.version). When it
// is unset, fall back to the `version` file shipped with release bundles.
var Version = "dev"

// versionFileCandidates covers the two layouts we actually run in: the release
// image (WORKDIR /app, version copied next to the binary → "version") and
// `cd backend && go run .` (the file lives one level up → "../version").
var versionFileCandidates = []string{"version", filepath.Join("..", "version")}

func GetVersion(c *gin.Context) {
	value := strings.TrimSpace(Version)
	if value == "" || value == "dev" {
		for _, candidate := range versionFileCandidates {
			data, err := os.ReadFile(candidate)
			if err != nil {
				continue
			}
			if trimmed := strings.TrimSpace(string(data)); trimmed != "" {
				value = trimmed
				break
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"version": value})
}

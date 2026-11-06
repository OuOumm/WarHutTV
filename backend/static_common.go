package main

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// staticAssetExt lists the file extensions the SPA build can emit. A request
// for one of these that does not exist on disk must return 404 instead of the
// SPA shell, otherwise missing images/scripts are served as HTML and the
// browser reports a confusing MIME error.
var staticAssetExt = map[string]bool{
	".js":          true,
	".mjs":         true,
	".css":         true,
	".map":         true,
	".json":        true,
	".webmanifest": true,
	".svg":         true,
	".png":         true,
	".jpg":         true,
	".jpeg":        true,
	".webp":        true,
	".gif":         true,
	".ico":         true,
	".woff":        true,
	".woff2":       true,
	".ttf":         true,
	".otf":         true,
	".txt":         true,
	".xml":         true,
	".wasm":        true,
}

func mountStaticFS(r *gin.Engine, distFS fs.FS) {
	fileServer := http.FileServer(http.FS(distFS))

	r.GET("/", func(c *gin.Context) {
		serveIndex(c, distFS)
	})

	r.NoRoute(func(c *gin.Context) {
		reqPath := c.Request.URL.Path

		// Unknown API endpoints must be JSON 404s. Falling back to index.html
		// (200 text/html) hides client bugs and breaks API clients that rely on
		// the status code.
		if reqPath == "/api" || strings.HasPrefix(reqPath, "/api/") {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "接口不存在"})
			return
		}

		if reqPath == "/index.html" || reqPath == "/index.htm" {
			serveIndex(c, distFS)
			return
		}

		if isStaticAssetPath(reqPath) {
			filePath := strings.TrimPrefix(path.Clean(reqPath), "/")
			if filePath == "" || !fs.ValidPath(filePath) {
				c.String(http.StatusNotFound, "404 page not found")
				return
			}
			if _, err := fs.Stat(distFS, filePath); err != nil {
				c.String(http.StatusNotFound, "404 page not found")
				return
			}
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		// Everything else is a client-side route (e.g. /play/123): serve the
		// SPA shell, but only for navigations.
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.String(http.StatusNotFound, "404 page not found")
			return
		}
		serveIndex(c, distFS)
	})
}

func serveIndex(c *gin.Context, distFS fs.FS) {
	data, err := fs.ReadFile(distFS, "index.html")
	if err != nil {
		c.String(http.StatusInternalServerError, "index.html not found")
		return
	}
	// index.html references hashed bundles; never let a stale copy pin an old
	// build after a deploy.
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "text/html; charset=utf-8", data)
}

func isStaticAssetPath(p string) bool {
	if strings.HasPrefix(p, "/assets/") {
		return true
	}
	return staticAssetExt[strings.ToLower(path.Ext(p))]
}

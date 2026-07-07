package main

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func mountStaticFS(r *gin.Engine, distFS fs.FS) {
	r.GET("/", func(c *gin.Context) {
		serveIndex(c, distFS)
	})

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/index.html" || path == "/index.htm" {
			serveIndex(c, distFS)
			return
		}

		if isStaticAssetPath(path) {
			filePath := path[1:]
			if _, err := fs.Stat(distFS, filePath); err == nil {
				http.FileServer(http.FS(distFS)).ServeHTTP(c.Writer, c.Request)
				return
			}
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
	c.Data(http.StatusOK, "text/html; charset=utf-8", data)
}

func isStaticAssetPath(path string) bool {
	return strings.HasPrefix(path, "/assets/") || strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".svg") || strings.HasSuffix(path, ".json") || strings.HasSuffix(path, ".ico") || strings.HasSuffix(path, ".png") || strings.HasSuffix(path, ".woff2") || strings.HasSuffix(path, ".woff")
}

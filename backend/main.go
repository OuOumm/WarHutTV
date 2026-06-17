package main

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/handlers"
	"warhutv/middleware"
)

//go:embed frontend/dist/*
var frontendFS embed.FS

func main() {
	config.Load("data/config.json")

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	r := gin.Default()
	r.Use(middleware.CORSMiddleware())

	api := r.Group("/api")
	{
		api.POST("/auth/login", handlers.Login)
		api.GET("/proxy/m3u8", handlers.ProxyM3U8)
		api.GET("/proxy/logo", handlers.ProxyLogo)
		api.GET("/search/stream", handlers.SearchStream)
	}

	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/auth/verify", handlers.Verify)
		auth.GET("/search", handlers.Search)

		auth.GET("/detail", handlers.Detail)
		auth.GET("/play", handlers.Play)
		auth.GET("/live/sources", handlers.GetLiveSources)
		auth.GET("/live/channels", handlers.GetLiveChannels)
		auth.GET("/live/precheck", handlers.PrecheckLiveStream)
		auth.GET("/live/stream", handlers.StreamLive)

		auth.GET("/config", handlers.GetConfig)
		auth.POST("/config", handlers.UpdateConfig)
		auth.GET("/bangumi/calendar", handlers.BangumiCalendar)
	}

	// 嵌入前端静态资源
	distFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err == nil {
		// 根路由直接返回index.html
		r.GET("/", func(c *gin.Context) {
			data, err := fs.ReadFile(distFS, "index.html")
			if err != nil {
				c.String(http.StatusInternalServerError, "index.html not found")
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", data)
		})

		// 静态资源请求
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path

			// 处理 index.html 请求
			if path == "/index.html" || path == "/index.htm" {
				data, err := fs.ReadFile(distFS, "index.html")
				if err != nil {
					c.String(http.StatusInternalServerError, "index.html not found")
					return
				}
				c.Data(http.StatusOK, "text/html; charset=utf-8", data)
				return
			}

			// 尝试从嵌入的文件系统中读取静态文件
			if strings.HasPrefix(path, "/assets/") || strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".svg") || strings.HasSuffix(path, ".json") || strings.HasSuffix(path, ".ico") || strings.HasSuffix(path, ".png") || strings.HasSuffix(path, ".woff2") || strings.HasSuffix(path, ".woff") {
				filePath := path[1:] // 去掉开头的 /
				f, err := distFS.Open(filePath)
				if err == nil {
					f.Close()
					http.FileServer(http.FS(distFS)).ServeHTTP(c.Writer, c.Request)
					return
				}
			}

			// 其他路由返回index.html（SPA模式）
			data, err := fs.ReadFile(distFS, "index.html")
			if err != nil {
				c.String(http.StatusInternalServerError, "index.html not found")
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", data)
		})
	}

	r.Run(":" + port)
}

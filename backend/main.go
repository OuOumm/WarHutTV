package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/handlers"
	"warhutv/middleware"
)

func main() {
	_, err := config.Load("config/config.json")
	if err != nil {
		log.Printf("Warning: failed to load config: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	r := gin.Default()
	r.Use(middleware.CORSMiddleware())

	api := r.Group("/api")
	{
		api.POST("/auth/login", handlers.Login)
	}

	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/auth/verify", handlers.Verify)
		auth.GET("/search", handlers.Search)
		auth.GET("/detail", handlers.Detail)
		auth.GET("/play", handlers.Play)
		auth.GET("/adblock/status", handlers.GetAdBlockStatus)
		auth.POST("/adblock/status", handlers.SetAdBlockStatus)
		auth.GET("/live/channels", handlers.GetLiveChannels)
		auth.GET("/live/stream", handlers.StreamLive)
		auth.GET("/config", handlers.GetConfig)
		auth.POST("/config", handlers.UpdateConfig)
	}

	frontendDist := "../frontend/dist"
	if _, err := os.Stat(frontendDist); err == nil {
		r.Static("/assets", filepath.Join(frontendDist, "assets"))
		r.StaticFile("/favicon.ico", filepath.Join(frontendDist, "favicon.ico"))
		r.StaticFile("/logo.png", filepath.Join(frontendDist, "logo.png"))

		r.NoRoute(func(c *gin.Context) {
			c.File(filepath.Join(frontendDist, "index.html"))
		})
	}

	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}

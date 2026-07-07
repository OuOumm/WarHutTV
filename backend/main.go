package main

import (
	"os"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/handlers"
	"warhutv/middleware"
)

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
		rateLimit := middleware.LoginRateLimit()
		api.POST("/auth/login", rateLimit, handlers.Login)
		api.GET("/search/stream", handlers.SearchStream)
		api.GET("/config", handlers.GetConfig)
		api.GET("/version", handlers.GetVersion)
	}

	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/auth/verify", handlers.Verify)

		auth.GET("/detail", handlers.Detail)
		auth.GET("/play", handlers.Play)

		auth.POST("/config", handlers.UpdateConfig)
		auth.GET("/bangumi/calendar", handlers.BangumiCalendar)
	}

	mountStaticAssets(r)

	r.Run(":" + port)
}

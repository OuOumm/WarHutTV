package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"warhutv/config"
	"warhutv/handlers"
	"warhutv/middleware"
)

func main() {
	// Run in release mode so gin.Recovery returns a generic 500 instead of
	// leaking stack traces to clients.
	gin.SetMode(gin.ReleaseMode)
	config.Load("data/config.json")

	// Refuse to start with the baked-in insecure defaults. Operators MUST set
	// a real password / jwt_secret in data/config.json.
	if config.Password() == "" || config.Password() == config.DefaultPassword {
		log.Fatal("refusing to start: admin password is empty or equals the insecure default. Set a real password in data/config.json.")
	}
	if config.JWTSecret() == "" || config.JWTSecret() == config.DefaultJWTSecret {
		log.Fatal("refusing to start: JWT secret is empty or equals the insecure default. Set a real jwt_secret in data/config.json.")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	r := gin.Default()
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CORSMiddleware())

	api := r.Group("/api")
	{
		rateLimit := middleware.LoginRateLimit()
		api.POST("/auth/login", rateLimit, handlers.Login)
		api.POST("/auth/logout", handlers.Logout)
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

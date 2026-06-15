package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	r := gin.Default()

	// TODO: 添加路由和中间件

	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}

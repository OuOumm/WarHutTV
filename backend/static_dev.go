//go:build !embed

package main

import (
	"os"

	"github.com/gin-gonic/gin"
)

func mountStaticAssets(r *gin.Engine) {
	for _, dir := range []string{"frontend/dist", "../frontend/dist"} {
		if _, err := os.Stat(dir + "/index.html"); err == nil {
			mountStaticFS(r, os.DirFS(dir))
			return
		}
	}
}

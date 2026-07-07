//go:build embed

package main

import (
	"embed"
	"io/fs"

	"github.com/gin-gonic/gin"
)

//go:embed frontend/dist/*
var frontendFS embed.FS

func mountStaticAssets(r *gin.Engine) {
	distFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		return
	}
	mountStaticFS(r, distFS)
}

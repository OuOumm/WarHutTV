package handlers

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetVersion(c *gin.Context) {
	data, err := os.ReadFile("version")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"version": ""})
		return
	}
	c.JSON(http.StatusOK, gin.H{"version": strings.TrimSpace(string(data))})
}

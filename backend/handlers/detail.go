package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

func Detail(c *gin.Context) {
	site := c.Query("site")
	vodID := c.Query("ids")

	if site == "" || vodID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少站点或视频ID"})
		return
	}

	result, err := services.ProxyDetail(site, vodID)
	if err != nil {
		log.Printf("detail proxy error: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "上游请求失败，请稍后重试"})
		return
	}

	// 设置 site_key 到每个结果项
	for i := range result.List {
		result.List[i].SiteKey = site
	}

	c.JSON(http.StatusOK, result)
}

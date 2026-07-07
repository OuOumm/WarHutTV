package handlers

import (
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
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败: " + err.Error()})
		return
	}

	// 设置 site_key 到每个结果项
	for i := range result.List {
		result.List[i].SiteKey = site
	}

	c.JSON(http.StatusOK, result)
}

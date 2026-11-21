package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

// Detail returns the upstream vod detail as-is. The client parses
// vod_play_url itself (同名去重 + m3u8 优先, see ADR-0001), so no `episodes`
// field is emitted here: parsing on the server only added bytes and a
// second, divergent implementation.
func Detail(c *gin.Context) {
	site := c.Query("site")
	vodID := c.Query("ids")

	if site == "" || vodID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少站点或视频ID"})
		return
	}

	result, err := services.ProxyDetail(c.Request.Context(), site, vodID)
	if err != nil {
		log.Printf("detail proxy error (site=%s ids=%s): %v", site, vodID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "上游请求失败，请稍后重试"})
		return
	}

	for i := range result.List {
		result.List[i].SiteKey = site
	}

	c.JSON(http.StatusOK, gin.H{
		"code": result.Code,
		"msg":  result.Msg,
		"list": result.List,
	})
}

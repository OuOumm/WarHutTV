package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"warhutv/services"
)

// Detail returns the upstream vod detail plus the parsed episode list.
//
// Clients used to re-implement the vod_play_url parser (线路$$$集名$url#...),
// and every client had to be tolerant of the format's quirks. Parsing it here
// keeps one implementation, and `episodes` is what the player actually needs.
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
		"code":     result.Code,
		"msg":      result.Msg,
		"list":     result.List,
		"episodes": services.ParsePlaylist(firstPlayURL(result.List)),
	})
}

func firstPlayURL(items []services.VideoDetail) string {
	if len(items) == 0 {
		return ""
	}
	return items[0].VodPlayURL
}

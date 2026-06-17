package handlers

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"warhutv/config"
)

var proxyClient = &http.Client{Timeout: 30 * time.Second}

const defaultUA = "Mozilla/5.0"

func getUA(sourceKey string) string {
	if sourceKey == "" {
		return defaultUA
	}
	for _, s := range config.Get().LiveConfig {
		if s.Key == sourceKey && s.UA != "" {
			return s.UA
		}
	}
	return defaultUA
}

// ProxyM3U8 proxies M3U8 stream requests and rewrites relative URLs
func ProxyM3U8(c *gin.Context) {
	m3u8URL := c.Query("url")
	if m3u8URL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}

	sourceKey := c.Query("moontv-source")
	ua := getUA(sourceKey)

	req, err := http.NewRequest("GET", m3u8URL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "请求创建失败"})
		return
	}
	req.Header.Set("User-Agent", ua)

	resp, err := proxyClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "no-cache")
	c.Header("Access-Control-Allow-Origin", "*")

	// If this is an m3u8 manifest, rewrite relative URLs to go through proxy
	if strings.Contains(contentType, "mpegurl") || strings.Contains(contentType, "m3u8") || strings.HasSuffix(m3u8URL, ".m3u8") {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "读取响应失败"})
			return
		}

		// Parse base URL for resolving relative paths
		m3u8Content := string(body)
		baseURL, _ := url.Parse(m3u8URL)
		basePath := ""
		if baseURL != nil {
			idx := strings.LastIndex(baseURL.Path, "/")
			if idx >= 0 {
				basePath = baseURL.Path[:idx+1]
			}
		}

		lines := strings.Split(m3u8Content, "\n")
		for i, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			// Absolute URL - proxy it
			if strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://") {
				lines[i] = "/api/proxy/m3u8?url=" + url.QueryEscape(line)
				if sourceKey != "" {
					lines[i] += "&moontv-source=" + url.QueryEscape(sourceKey)
				}
				continue
			}

			// Relative URL - resolve and proxy it
			resolvedPath := basePath + line
			if baseURL != nil {
				resolved := baseURL.Scheme + "://" + baseURL.Host + resolvedPath
				lines[i] = "/api/proxy/m3u8?url=" + url.QueryEscape(resolved)
				if sourceKey != "" {
					lines[i] += "&moontv-source=" + url.QueryEscape(sourceKey)
				}
			}
		}

		c.Writer.Write([]byte(strings.Join(lines, "\n")))
	} else {
		io.Copy(c.Writer, resp.Body)
	}
}

// ProxyLogo proxies logo image requests
func ProxyLogo(c *gin.Context) {
	url := c.Query("url")
	if url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}

	ua := getUA(c.Query("source"))

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "请求创建失败"})
		return
	}
	req.Header.Set("User-Agent", ua)

	resp, err := proxyClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败"})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/png"
	}

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=86400")
	c.Header("Access-Control-Allow-Origin", "*")

	io.Copy(c.Writer, resp.Body)
}

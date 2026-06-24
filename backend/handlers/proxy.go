package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var proxyClient = &http.Client{
	Timeout: 30 * time.Second,
	// 让 http.Client 自动跟随重定向，我们通过 resp.Request.URL 拿到最终地址
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return fmt.Errorf("stopped after 10 redirects")
		}
		// 复制 UA 到重定向后的请求
		if len(via) > 0 {
			req.Header.Set("User-Agent", via[0].Header.Get("User-Agent"))
		}
		return nil
	},
}

const defaultUA = "Mozilla/5.0"

// getUA 根据直播源 key 查找对应 UA（不再使用直播配置，返回默认 UA）
func getUA(sourceKey string) string {
	return defaultUA
}

// fetchWithUA 用指定 UA 发起 GET 请求，返回响应（调用方负责关闭 body）
func fetchWithUA(targetURL, sourceKey string) (*http.Response, error) {
	ua := getUA(sourceKey)
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ua)
	return proxyClient.Do(req)
}

// fetchWithHeaders 转发客户端关键 header（Referer、Origin、Range）到上游
func fetchWithHeaders(c *gin.Context, targetURL, sourceKey string) (*http.Response, error) {
	ua := getUA(sourceKey)
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ua)
	if referer := c.GetHeader("Referer"); referer != "" {
		req.Header.Set("Referer", referer)
	}
	if origin := c.GetHeader("Origin"); origin != "" {
		req.Header.Set("Origin", origin)
	}
	if rn := c.GetHeader("Range"); rn != "" {
		req.Header.Set("Range", rn)
	}
	return proxyClient.Do(req)
}

// setProxyHeaders 设置代理响应通用头（CORS + 禁用缓存）
func setProxyHeaders(c *gin.Context, contentType string) {
	h := c.Writer.Header()
	if contentType != "" {
		h.Set("Content-Type", contentType)
	}
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type, Range, Origin, Accept")
	h.Set("Access-Control-Expose-Headers", "Content-Length, Content-Range")
	h.Set("Cache-Control", "no-cache")
}

// ProxyM3U8 代理 M3U8 播放列表，重写其中的相对/绝对 URL 指向本地代理
func ProxyM3U8(c *gin.Context) {
	m3u8URL := c.Query("url")
	if m3u8URL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}

	sourceKey := c.Query("moontv-source")
	allowCORS := c.Query("allowCORS") == "true"

	resp, err := fetchWithHeaders(c, m3u8URL, sourceKey)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")

	// 判断是否为可能 M3U8 播放列表（需要读取 Body 进一步确认）
	// 注意：使用重定向后的最终 URL 做后缀判断，因为源站可能 302 到真正的 .m3u8 地址
	if resp.Request != nil && resp.Request.URL != nil {
		m3u8URL = resp.Request.URL.String()
	}
	isManifest := strings.Contains(strings.ToLower(contentType), "mpegurl") ||
		strings.Contains(strings.ToLower(contentType), "octet-stream") ||
		strings.HasSuffix(strings.ToLower(m3u8URL), ".m3u8") ||
		strings.HasSuffix(strings.ToLower(m3u8URL), ".m3u")

	// 非 M3U8 内容直接流式透传（不重写）
	if !isManifest {
		setProxyHeaders(c, contentType)
		c.Writer.WriteHeader(resp.StatusCode)
		io.Copy(c.Writer, resp.Body)
		return
	}

	// 超大响应直接透传，避免占用内存
	const maxM3U8Size int64 = 10 * 1024 * 1024
	if resp.ContentLength > maxM3U8Size {
		setProxyHeaders(c, contentType)
		c.Writer.WriteHeader(resp.StatusCode)
		io.Copy(c.Writer, resp.Body)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取响应失败"})
		return
	}

	// 二次确认：内容必须以 #EXTM3U 开头才是真实播放列表
	if !bytes.HasPrefix(bytes.TrimSpace(body), []byte("#EXTM3U")) {
		setProxyHeaders(c, contentType)
		c.Writer.WriteHeader(resp.StatusCode)
		c.Writer.Write(body)
		return
	}

	// 关键：使用重定向后的最终 URL 作为 base，避免源站 302 导致路径解析错误
	finalURL := m3u8URL
	if resp.Request != nil && resp.Request.URL != nil {
		finalURL = resp.Request.URL.String()
	}

	setProxyHeaders(c, contentType)
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Write([]byte(rewriteM3U8Content(string(body), finalURL, m3u8URL, sourceKey, c, allowCORS)))
}

// proxyBase 拼装本地代理前缀，如 http://127.0.0.1:3000/api/proxy
func proxyBase(c *gin.Context) string {
	// 优先用 X-Forwarded 协议头，否则用请求协议
	scheme := "http"
	if req := c.Request; req != nil {
		if req.TLS != nil {
			scheme = "https"
		}
		if xfp := req.Header.Get("X-Forwarded-Proto"); xfp != "" {
			scheme = xfp
		}
	}
	host := c.Request.Host
	return fmt.Sprintf("%s://%s/api/proxy", scheme, host)
}

// resolveURL 把相对路径解析为绝对 URL（参考 LunaTV resolveUrl 实现）
func resolveURL(base, relative string) string {
	// 完整 URL 直接返回
	if strings.HasPrefix(relative, "http://") || strings.HasPrefix(relative, "https://") {
		return relative
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return relative
	}
	// 协议相对路径 //host/path
	if strings.HasPrefix(relative, "//") {
		return baseURL.Scheme + ":" + relative
	}
	// 使用 url 库解析相对路径（自动处理 ../ ./ /path 等情况）
	refURL, err := baseURL.Parse(relative)
	if err != nil {
		return relative
	}
	return refURL.String()
}

var (
	keyUriRe   = regexp.MustCompile(`URI="([^"]+)"`)
	streamInfRe = regexp.MustCompile(`^#EXT-X-STREAM-INF:`)
)

// rewriteM3U8Content 重写 M3U8 内容：把媒体段、key、map、子 m3u8 的 URL 改写为本地代理
// manifestURL 是原始请求的播放列表 URL（用于检测 URL 碰撞，避免循环）
func rewriteM3U8Content(content, baseURL, manifestURL, sourceKey string, c *gin.Context, allowCORS bool) string {
	proxy := proxyBase(c)
	lines := strings.Split(content, "\n")

	for i := 0; i < len(lines); i++ {
		raw := lines[i]
		line := strings.TrimSpace(raw)

		// 空行保留
		if line == "" {
			continue
		}

		// 处理 #EXT-X-KEY 标签中的 URI（加密 key）
		if strings.HasPrefix(line, "#EXT-X-KEY:") {
			lines[i] = rewriteUriAttr(raw, baseURL, proxy+"/key", sourceKey)
			continue
		}

		// 处理 #EXT-X-MAP 标签中的 URI（初始化段 INIT SECTION）
		if strings.HasPrefix(line, "#EXT-X-MAP:") {
			lines[i] = rewriteUriAttr(raw, baseURL, proxy+"/segment", sourceKey)
			continue
		}

		// 处理 #EXT-X-STREAM-INF（多码率子 m3u8）：本行为标签，下一行为 URL
		if streamInfRe.MatchString(line) {
			if i+1 < len(lines) {
				next := strings.TrimSpace(lines[i+1])
				if next != "" && !strings.HasPrefix(next, "#") {
					resolved := resolveURL(baseURL, next)
					if resolved == manifestURL {
						lines[i+1] = resolved
					} else {
						lines[i+1] = buildProxyURL(proxy+"/m3u8", resolved, sourceKey, false)
					}
				}
			}
			continue
		}

		// 处理普通媒体段（TS / fmp4 等）：非注释行
		if !strings.HasPrefix(line, "#") {
			resolved := resolveURL(baseURL, line)
			// 检测 URL 碰撞：如果分片 URL 与播放列表 URL 相同（部分源站共用 URL），
			// 直接暴露给浏览器直连，避免代理请求再次返回播放列表造成循环
			if resolved == manifestURL {
				lines[i] = resolved
			} else if allowCORS {
				lines[i] = resolved
			} else {
				lines[i] = buildProxyURL(proxy+"/segment", resolved, sourceKey, false)
			}
			continue
		}
	}

	return strings.Join(lines, "\n")
}

// rewriteUriAttr 重写标签行内的 URI="..." 属性
func rewriteUriAttr(line, baseURL, proxyPath, sourceKey string) string {
	loc := keyUriRe.FindStringSubmatchIndex(line)
	if loc == nil {
		return line
	}
	original := line[loc[2]:loc[3]]
	resolved := resolveURL(baseURL, original)
	replaced := buildProxyURL(proxyPath, resolved, sourceKey, false)
	return line[:loc[2]] + replaced + line[loc[3]:]
}

// buildProxyURL 构造本地代理 URL：proxyPath?url=...&moontv-source=...
func buildProxyURL(proxyPath, targetURL, sourceKey string, _ bool) string {
	u := proxyPath + "?url=" + url.QueryEscape(targetURL)
	if sourceKey != "" {
		u += "&moontv-source=" + url.QueryEscape(sourceKey)
	}
	return u
}

// ProxySegment 代理媒体段（TS / fmp4 等），流式透传
func ProxySegment(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}
	proxyStreamWithHeaders(c, targetURL, c.Query("moontv-source"), "video/mp2t")
}

// ProxyKey 代理加密 key（HLS AES key）
func ProxyKey(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}
	// key 一般是 application/octet-stream，但保留源站类型
	customType := ""
	resp, err := fetchWithHeaders(c, targetURL, c.Query("moontv-source"))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败"})
		return
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		customType = ct
	} else {
		customType = "application/octet-stream"
	}
	setProxyHeaders(c, customType)
	// key 允许缓存 1 小时，减少重复请求
	c.Writer.Header().Set("Cache-Control", "public, max-age=3600")
	c.Writer.WriteHeader(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

// proxyStream 通用流式透传：透传源站响应头 + body
func proxyStream(c *gin.Context, targetURL, sourceKey, defaultType string) {
	resp, err := fetchWithUA(targetURL, sourceKey)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败"})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = defaultType
	}
	setProxyHeaders(c, contentType)
	// 媒体段支持 Range（HLS 可能发 Range 请求）
	c.Writer.Header().Set("Accept-Ranges", "bytes")
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		c.Writer.Header().Set("Content-Length", cl)
	}
	c.Writer.WriteHeader(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

// proxyStreamWithHeaders 带客户端 header 转发的流式透传
func proxyStreamWithHeaders(c *gin.Context, targetURL, sourceKey, defaultType string) {
	resp, err := fetchWithHeaders(c, targetURL, sourceKey)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "请求失败"})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = defaultType
	}
	setProxyHeaders(c, contentType)
	c.Writer.Header().Set("Accept-Ranges", "bytes")
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		c.Writer.Header().Set("Content-Length", cl)
	}
	c.Writer.WriteHeader(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

// ProxyLogo proxies logo image requests
func ProxyLogo(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少URL参数"})
		return
	}

	resp, err := fetchWithHeaders(c, targetURL, c.Query("source"))
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

	// 限制最大 5MB，防止超大响应耗尽带宽
	const maxLogoSize int64 = 5 * 1024 * 1024
	if resp.ContentLength > maxLogoSize {
		c.Status(http.StatusBadGateway)
		return
	}
	io.Copy(c.Writer, io.LimitReader(resp.Body, maxLogoSize))
}

package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
	"warhutv/config"
)

type VideoItem struct {
	VodID      interface{} `json:"vod_id"`
	VodName    string      `json:"vod_name"`
	VodPic     string      `json:"vod_pic"`
	VodYear    string      `json:"vod_year"`
	VodRemarks string      `json:"vod_remarks"`
	TypeID     interface{} `json:"type_id"`
	TypeName   string      `json:"type_name"`
	SourceName string      `json:"source_name,omitempty"`
	SiteKey    string      `json:"site_key,omitempty"`
}

type SearchResult struct {
	Code  int         `json:"code"`
	Msg   string      `json:"msg"`
	Total int         `json:"total"`
	List  []VideoItem `json:"list"`
}

type VideoDetail struct {
	VodID       interface{} `json:"vod_id"`
	VodName     string      `json:"vod_name"`
	VodPic      string      `json:"vod_pic"`
	VodYear     string      `json:"vod_year"`
	VodRemarks  string      `json:"vod_remarks"`
	VodContent  string      `json:"vod_content"`
	VodPlayFrom string      `json:"vod_play_from"`
	VodPlayURL  string      `json:"vod_play_url"`
	TypeID      interface{} `json:"type_id"`
	TypeName    string      `json:"type_name"`
	SiteKey     string      `json:"site_key,omitempty"`
}

type DetailResult struct {
	Code int           `json:"code"`
	Msg  string        `json:"msg"`
	List []VideoDetail `json:"list"`
}

type PlayResult struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	List []struct {
		URL string `json:"url"`
	} `json:"list"`
}

const maxUpstreamResponseBytes = 10 << 20

var client = &http.Client{
	Timeout: 15 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		if IsBlockedHost(req.URL.Host) {
			return fmt.Errorf("redirect blocked: target host not allowed")
		}
		return nil
	},
}

func ProxySearch(siteKey, keyword string, pg int) (*SearchResult, error) {
	site, err := getSite(siteKey)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s?ac=detail&wd=%s&pg=%d", site.API, url.QueryEscape(keyword), pg)
	return doRequest[SearchResult](url)
}

func ProxyDetail(siteKey, vodID string) (*DetailResult, error) {
	site, err := getSite(siteKey)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s?ac=detail&ids=%s", site.API, url.QueryEscape(vodID))
	return doRequest[DetailResult](url)
}

func ProxyPlay(siteKey, vodID string) (string, error) {
	site, err := getSite(siteKey)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s?ac=play&ids=%s", site.API, url.QueryEscape(vodID))
	playResult, err := doRequest[PlayResult](url)
	if err != nil {
		return "", err
	}

	if len(playResult.List) > 0 {
		return playResult.List[0].URL, nil
	}

	return "", fmt.Errorf("no play URL found")
}

func getSite(siteKey string) (config.SiteConfig, error) {
	cfg := config.Snapshot()
	site, ok := cfg.APISite[siteKey]
	if !ok {
		return config.SiteConfig{}, fmt.Errorf("site not found: %s", siteKey)
	}
	return site, nil
}

func doRequest[T any](rawURL string) (*T, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid upstream URL")
	}
	if IsBlockedHost(u.Host) {
		log.Printf("SSRF guard blocked upstream host %q", u.Host)
		return nil, fmt.Errorf("upstream host not allowed")
	}
	resp, err := client.Get(rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		excerpt, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		message := strings.TrimSpace(string(excerpt))
		if message == "" {
			message = resp.Status
		}
		return nil, fmt.Errorf("upstream status %d: %s", resp.StatusCode, message)
	}

	body, err := ReadLimited(resp.Body, maxUpstreamResponseBytes)
	if err != nil {
		return nil, err
	}

	var result T
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ReadLimited reads r but rejects responses larger than limit bytes.
// Shared by all upstream fetches to bound memory usage.
func ReadLimited(r io.Reader, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("upstream response exceeds %d bytes", limit)
	}
	return body, nil
}

// IsBlockedHost reports whether host (with or without port) resolves to a
// private, loopback, link-local, or otherwise internal address. It is the SSRF
// guard applied to admin-configured upstream sites and to HTTP redirects.
func IsBlockedHost(host string) bool {
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if ip := net.ParseIP(host); ip != nil {
		return isPrivateIP(ip)
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		// Unresolvable at request time; let the HTTP layer surface the error
		// rather than blocking (avoids breaking legitimate CDN-backed hosts).
		return false
	}
	for _, ip := range ips {
		if isPrivateIP(ip) {
			return true
		}
	}
	return false
}

func isPrivateIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsPrivate() || ip.IsUnspecified()
}

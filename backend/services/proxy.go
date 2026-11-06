package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
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

const (
	maxUpstreamResponseBytes = 10 << 20
	upstreamTimeout          = 15 * time.Second
	// hostResolveTimeout bounds the SSRF pre-check's DNS lookup. Without a
	// deadline a stalled resolver could pin a per-site search goroutine well
	// past its 3s budget; the dialer's own (context-aware) lookup is the
	// authoritative guard.
	hostResolveTimeout = 2 * time.Second
)

// client resolves names through the SSRF-guarded dialer. Doing the check inside
// DialContext closes the DNS-rebinding window that a separate LookupIP before
// the request leaves open: the address actually dialed is the one validated.
var client = &http.Client{
	Timeout: upstreamTimeout,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		if IsBlockedHost(req.URL.Host) {
			return fmt.Errorf("redirect blocked: target host not allowed")
		}
		return nil
	},
	Transport: &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           guardedDialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	},
}

func guardedDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("no address for %s", host)
	}

	var lastErr error
	dialer := &net.Dialer{Timeout: upstreamTimeout}
	for _, resolved := range ips {
		if isPrivateIP(resolved.IP) {
			return nil, fmt.Errorf("blocked non-public address %s for %s", resolved.IP, host)
		}
		conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(resolved.IP.String(), port))
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

// ProxySearch queries one upstream. MacCMS exposes search as `ac=videolist`;
// some forks only answer `ac=detail` with a `wd` parameter, so the second form
// is used as a fallback when the first succeeds with an empty list.
func ProxySearch(ctx context.Context, siteKey, keyword string, pg int) (*SearchResult, error) {
	site, err := getSite(siteKey)
	if err != nil {
		return nil, err
	}

	query := url.QueryEscape(keyword)
	primary := fmt.Sprintf("%s?ac=videolist&wd=%s&pg=%d", site.API, query, pg)
	result, err := doRequest[SearchResult](ctx, primary)
	if err == nil && len(result.List) > 0 {
		return result, nil
	}

	fallback := fmt.Sprintf("%s?ac=detail&wd=%s&pg=%d", site.API, query, pg)
	fallbackResult, fallbackErr := doRequest[SearchResult](ctx, fallback)
	if fallbackErr == nil && len(fallbackResult.List) > 0 {
		return fallbackResult, nil
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

// PingResult is the outcome of a lightweight upstream reachability probe.
type PingResult struct {
	Site  string `json:"site"`
	Name  string `json:"name"`
	OK    bool   `json:"ok"`
	Ms    int64  `json:"ms"`
	Count int    `json:"count"`
	Error string `json:"error,omitempty"`
}

// ProxyPing probes one upstream by fetching its latest-videos page and timing
// it. It replaces the old frontend speed test, which called a non-existent
// `/api/search` endpoint and therefore reported every source as reachable.
func ProxyPing(ctx context.Context, siteKey string) PingResult {
	site, err := getSite(siteKey)
	if err != nil {
		return PingResult{Site: siteKey, OK: false, Error: err.Error()}
	}

	start := time.Now()
	result, err := doRequest[SearchResult](ctx, fmt.Sprintf("%s?ac=videolist&pg=1", site.API))
	elapsed := time.Since(start)

	ping := PingResult{Site: siteKey, Name: site.Name, Ms: elapsed.Milliseconds()}
	if err != nil {
		ping.Error = err.Error()
		return ping
	}
	ping.OK = true
	ping.Count = len(result.List)
	return ping
}

func ProxyDetail(ctx context.Context, siteKey, vodID string) (*DetailResult, error) {
	site, err := getSite(siteKey)
	if err != nil {
		return nil, err
	}

	rawURL := fmt.Sprintf("%s?ac=detail&ids=%s", site.API, url.QueryEscape(vodID))
	return doRequest[DetailResult](ctx, rawURL)
}

// ProxyPlay resolves a playable URL for one episode by reading the vod detail
// playlist. MacCMS has no `ac=play` endpoint; the sources are encoded in
// vod_play_from ("线路1$$$线路2") and vod_play_url
// ("集名$url#集名$url$$$线路2..."). When episode is empty the first episode of
// the first line is returned.
func ProxyPlay(ctx context.Context, siteKey, vodID, episode string) (string, error) {
	detail, err := ProxyDetail(ctx, siteKey, vodID)
	if err != nil {
		return "", err
	}
	if len(detail.List) == 0 {
		return "", fmt.Errorf("empty detail response")
	}

	vod := detail.List[0]
	episodes := ParsePlaylist(vod.VodPlayURL)
	if len(episodes) == 0 {
		return "", fmt.Errorf("no playable source in detail response")
	}

	if episode == "" {
		return episodes[0].URL, nil
	}
	for _, ep := range episodes {
		if ep.Name == episode {
			return ep.URL, nil
		}
	}
	return "", fmt.Errorf("episode %q not found", episode)
}

// PlayEpisode is one entry of a parsed vod_play_url playlist.
type PlayEpisode struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// ParsePlaylist flattens vod_play_url into episodes, keeping every line
// (线路) in order so the first entry of the first line is a stable default.
func ParsePlaylist(raw string) []PlayEpisode {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	var episodes []PlayEpisode
	for _, line := range strings.Split(raw, "$$$") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		// A line is "EP01$http://...#EP02$http://...". URLs never contain '#'
		// in MacCMS playlists, so splitting on it is safe.
		for _, item := range strings.Split(line, "#") {
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			name, target, ok := strings.Cut(item, "$")
			if !ok {
				// Bare URL without a name.
				episodes = append(episodes, PlayEpisode{Name: "", URL: item})
				continue
			}
			target = strings.TrimSpace(target)
			if target == "" {
				continue
			}
			episodes = append(episodes, PlayEpisode{Name: strings.TrimSpace(name), URL: target})
		}
	}
	return episodes
}

func getSite(siteKey string) (config.SiteConfig, error) {
	cfg := config.Snapshot()
	site, ok := cfg.APISite[siteKey]
	if !ok {
		return config.SiteConfig{}, fmt.Errorf("site not found: %s", siteKey)
	}
	return site, nil
}

func doRequest[T any](ctx context.Context, rawURL string) (*T, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid upstream URL")
	}
	if IsBlockedHostContext(ctx, u.Host) {
		log.Printf("SSRF guard blocked upstream host %q", u.Host)
		return nil, fmt.Errorf("upstream host not allowed")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("invalid upstream URL")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "WarHutTV/1.0")

	resp, err := client.Do(req)
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

// CGNAT (100.64.0.0/10, RFC 6598) is neither private nor loopback as far as
// net.IP is concerned, but it is internal carrier space and must not be
// reachable through an admin-supplied upstream URL.
var cgnatRange = &net.IPNet{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)}

// IsBlockedHost reports whether host (with or without port) resolves to a
// private, loopback, link-local, or otherwise internal address. It is the SSRF
// guard applied to admin-configured upstream sites and to HTTP redirects.
//
// A DNS failure returns false so that a transient resolver outage surfaces as
// a connection error; the dialer performs the authoritative check.
func IsBlockedHost(host string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), hostResolveTimeout)
	defer cancel()
	return IsBlockedHostContext(ctx, host)
}

// IsBlockedHostContext is IsBlockedHost with a caller-supplied deadline.
// Upstream requests pass their per-site context so a stalled DNS lookup cannot
// outlive the source's timeout budget.
func IsBlockedHostContext(ctx context.Context, host string) bool {
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if ip := net.ParseIP(host); ip != nil {
		return isPrivateIP(ip)
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return false
	}
	for _, resolved := range ips {
		if isPrivateIP(resolved.IP) {
			return true
		}
	}
	return false
}

func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsPrivate() || ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	if v4 := ip.To4(); v4 != nil && cgnatRange.Contains(v4) {
		return true
	}
	return false
}

// ensure syscall stays referenced on platforms where the dialer already
// returns the needed error type.
var _ = syscall.ECONNREFUSED

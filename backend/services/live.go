package services

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"warhutv/config"
)

type LiveChannel struct {
	ID    string `json:"id"`
	TvgID string `json:"tvgId"`
	Name  string `json:"name"`
	URL   string `json:"url"`
	Logo  string `json:"logo,omitempty"`
	Group string `json:"group,omitempty"`
}

type LiveChannelsData struct {
	ChannelNumber int            `json:"channelNumber"`
	Channels      []LiveChannel  `json:"channels"`
	EPGUrl        string         `json:"epgUrl"`
}

var (
	liveClient = &http.Client{Timeout: 30 * time.Second}
	channelCache = make(map[string]*LiveChannelsData)
	cacheMu      sync.RWMutex

	// Pre-compiled regexes for M3U parsing
	tvgIDRe  = regexp.MustCompile(`tvg-id="([^"]*)"`)
	tvgLogoRe = regexp.MustCompile(`tvg-logo="([^"]*)"`)
	groupRe   = regexp.MustCompile(`group-title="([^"]*)"`)
	tvgURLRe  = regexp.MustCompile(`(?:x-tvg-url|url-tvg)="([^"]*)"`)
)

const defaultUA = "AptvPlayer/1.4.10"

// GetLiveSources returns all enabled live sources from config
func GetLiveSources() []config.LiveSource {
	cfg := config.Get()
	var sources []config.LiveSource
	for _, s := range cfg.LiveConfig {
		if !s.Disabled {
			sources = append(sources, s)
		}
	}
	return sources
}

// GetCachedLiveChannels returns cached channels or fetches and parses M3U
func GetCachedLiveChannels(sourceKey string) (*LiveChannelsData, error) {
	cacheMu.RLock()
	cached, exists := channelCache[sourceKey]
	cacheMu.RUnlock()

	if exists {
		return cached, nil
	}

	cfg := config.Get()
	var liveSource *config.LiveSource
	for i := range cfg.LiveConfig {
		if cfg.LiveConfig[i].Key == sourceKey && !cfg.LiveConfig[i].Disabled {
			liveSource = &cfg.LiveConfig[i]
			break
		}
	}

	if liveSource == nil {
		return nil, fmt.Errorf("live source not found: %s", sourceKey)
	}

	data, err := fetchAndParseM3U(liveSource)
	if err != nil {
		return nil, err
	}

	cacheMu.Lock()
	channelCache[sourceKey] = data
	cacheMu.Unlock()

	liveSource.ChannelNumber = data.ChannelNumber
	cfg.Save("data/config.json")

	return data, nil
}

// DeleteCachedLiveChannels removes cached data for a source
func DeleteCachedLiveChannels(key string) {
	cacheMu.Lock()
	delete(channelCache, key)
	cacheMu.Unlock()
}

func fetchAndParseM3U(source *config.LiveSource) (*LiveChannelsData, error) {
	ua := source.UA
	if ua == "" {
		ua = defaultUA
	}

	req, err := http.NewRequest("GET", source.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ua)

	resp, err := liveClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	content := string(body)

	if strings.Contains(content, "#EXTM3U") || strings.Contains(content, "#EXTINF") {
		return parseStandardM3U(source.Key, content)
	}
	return parseTxtPlaylist(source.Key, content)
}

// parseStandardM3U parses standard M3U format with #EXTM3U and #EXTINF tags
func parseStandardM3U(sourceKey string, content string) (*LiveChannelsData, error) {
	var channels []LiveChannel
	var epgUrl string
	channelIndex := 0

	lines := strings.Split(content, "\n")
	var currentTvgID, currentName, currentLogo, currentGroup string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "#EXTM3U") {
			if m := tvgURLRe.FindStringSubmatch(line); len(m) > 1 {
				epgUrl = strings.Split(m[1], ",")[0]
			}
			continue
		}

		if strings.HasPrefix(line, "#EXTINF:") {
			currentTvgID, currentName, currentLogo, currentGroup = "", "", "", "其他"
			if m := tvgIDRe.FindStringSubmatch(line); len(m) > 1 {
				currentTvgID = m[1]
			}
			if m := tvgLogoRe.FindStringSubmatch(line); len(m) > 1 {
				currentLogo = m[1]
			}
			if m := groupRe.FindStringSubmatch(line); len(m) > 1 && m[1] != "" {
				currentGroup = m[1]
			}
			if parts := strings.Split(line, ","); len(parts) > 1 {
				currentName = strings.TrimSpace(parts[len(parts)-1])
			}
			continue
		}

		if strings.HasPrefix(line, "#") {
			continue
		}

		if currentName != "" && line != "" {
			channels = append(channels, LiveChannel{
				ID:    fmt.Sprintf("%s-%d", sourceKey, channelIndex),
				TvgID: currentTvgID,
				Name:  currentName,
				URL:   line,
				Logo:  currentLogo,
				Group: currentGroup,
			})
			channelIndex++
			currentName = ""
		}
	}

	return &LiveChannelsData{
		ChannelNumber: len(channels),
		Channels:      channels,
		EPGUrl:        epgUrl,
	}, nil
}

// parseTxtPlaylist parses txt playlist format (iyouhun style)
// Format: GroupName,#genre# then ChannelName,URL
func parseTxtPlaylist(sourceKey string, content string) (*LiveChannelsData, error) {
	var channels []LiveChannel
	channelIndex := 0
	currentGroup := "其他"

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Normalize: replace \r, handle different line endings
		line = strings.TrimRight(line, "\r")

		// Split by comma (Chinese or English)
		var parts []string
		if strings.Contains(line, "，") {
			parts = strings.SplitN(line, "，", 2)
		} else {
			parts = strings.SplitN(line, ",", 2)
		}
		if len(parts) != 2 {
			continue
		}

		name := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Group marker: GroupName,#genre#
		if value == "#genre#" {
			currentGroup = name
			continue
		}

		// Skip non-URL lines
		if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
			continue
		}



		channels = append(channels, LiveChannel{
			ID:    fmt.Sprintf("%s-%d", sourceKey, channelIndex),
			Name:  name,
			URL:   value,
			Group: currentGroup,
		})
		channelIndex++
	}

	return &LiveChannelsData{
		ChannelNumber: len(channels),
		Channels:      channels,
	}, nil
}

// CheckStreamType checks the content type of a stream URL
func CheckStreamType(url string, ua string) (string, error) {
	if ua == "" {
		ua = defaultUA
	}

	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", ua)

	resp, err := liveClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.Body != nil {
		io.Copy(io.Discard, resp.Body)
	}

	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "video/mp4") {
		return "mp4", nil
	}
	if strings.Contains(contentType, "video/x-flv") {
		return "flv", nil
	}
	return "m3u8", nil
}

// ProxyLiveStream proxies a live stream
func ProxyLiveStream(url string, ua string, w http.ResponseWriter) error {
	if ua == "" {
		ua = defaultUA
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", ua)

	resp, err := liveClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	_, err = io.Copy(w, resp.Body)
	return err
}

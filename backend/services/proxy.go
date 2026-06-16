package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	Code int          `json:"code"`
	Msg  string       `json:"msg"`
	List []VideoDetail `json:"list"`
}

type PlayResult struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	List []struct {
		URL string `json:"url"`
	} `json:"list"`
}

var client = &http.Client{
	Timeout: 15 * time.Second,
}

func ProxySearch(siteKey, keyword string, pg int) (*SearchResult, error) {
	cfg := config.Get()
	site, ok := cfg.APISite[siteKey]
	if !ok {
		return nil, fmt.Errorf("site not found: %s", siteKey)
	}

	url := fmt.Sprintf("%s?ac=detail&wd=%s&pg=%d", site.API, keyword, pg)
	return doRequest[SearchResult](url)
}

func ProxyDetail(siteKey, vodID string) (*DetailResult, error) {
	cfg := config.Get()
	site, ok := cfg.APISite[siteKey]
	if !ok {
		return nil, fmt.Errorf("site not found: %s", siteKey)
	}

	url := fmt.Sprintf("%s?ac=detail&ids=%s", site.API, vodID)
	return doRequest[DetailResult](url)
}

func ProxyPlay(siteKey, vodID, episode string) (string, error) {
	cfg := config.Get()
	site, ok := cfg.APISite[siteKey]
	if !ok {
		return "", fmt.Errorf("site not found: %s", siteKey)
	}

	url := fmt.Sprintf("%s?ac=play&ids=%s", site.API, vodID)
	playResult, err := doRequest[PlayResult](url)
	if err != nil {
		return "", err
	}

	if len(playResult.List) > 0 {
		return playResult.List[0].URL, nil
	}

	return "", fmt.Errorf("no play URL found")
}

func doRequest[T any](url string) (*T, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result T
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

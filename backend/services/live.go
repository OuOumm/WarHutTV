package services

import (
	"io"
	"net/http"
	"time"
)

type LiveChannel struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	Logo  string `json:"logo,omitempty"`
	Group string `json:"group,omitempty"`
}

var liveClient = &http.Client{
	Timeout: 30 * time.Second,
}

func ProxyLiveStream(url string, w http.ResponseWriter) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0")

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

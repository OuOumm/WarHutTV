package services

import (
	"regexp"
	"strings"
)

type AdBlocker struct {
	enabled   bool
	adPattern *regexp.Regexp
}

func NewAdBlocker(enabled bool) *AdBlocker {
	return &AdBlocker{
		enabled:   enabled,
		adPattern: regexp.MustCompile(`(?i)(ad|commercial|sponsor|promo)`),
	}
}

func (a *AdBlocker) IsAdSegment(segmentURI string) bool {
	if !a.enabled {
		return false
	}

	lowerURI := strings.ToLower(segmentURI)
	return a.adPattern.MatchString(lowerURI)
}

func (a *AdBlocker) FilterM3U8(content string) string {
	if !a.enabled {
		return content
	}

	lines := strings.Split(content, "\n")
	var filtered []string
	skipNext := false

	for _, line := range lines {
		if skipNext {
			skipNext = false
			continue
		}

		if strings.HasPrefix(line, "#") {
			if strings.Contains(line, "DISCONTINUITY") {
				continue
			}
			filtered = append(filtered, line)
		} else if a.IsAdSegment(line) {
			skipNext = true
			continue
		} else {
			filtered = append(filtered, line)
		}
	}

	return strings.Join(filtered, "\n")
}

func (a *AdBlocker) SetEnabled(enabled bool) {
	a.enabled = enabled
}

func (a *AdBlocker) IsEnabled() bool {
	return a.enabled
}

var DefaultAdBlocker *AdBlocker

func init() {
	DefaultAdBlocker = NewAdBlocker(true)
}

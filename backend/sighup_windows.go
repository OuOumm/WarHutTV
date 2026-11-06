//go:build windows

package main

import "os"

// Windows has no SIGHUP. Hot reload still works through the config file
// watcher (see config.Watch), which is started regardless of platform.
func newSighupChan() (<-chan os.Signal, func()) {
	return nil, func() {}
}

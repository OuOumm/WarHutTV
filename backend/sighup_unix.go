//go:build !windows

package main

import (
	"os"
	"os/signal"
	"syscall"
)

// newSighupChan registers for SIGHUP, the conventional "reload config" signal.
// The returned func unregisters the channel on shutdown.
func newSighupChan() (<-chan os.Signal, func()) {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGHUP)
	return ch, func() { signal.Stop(ch) }
}

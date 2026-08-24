package daemon

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type WatchdogStatus struct {
	Enabled          bool   `json:"enabled"`
	TargetHost       string `json:"target_host"`
	LastCheckTime    int64  `json:"last_check_time"`
	IsConnected      bool   `json:"is_connected"`
	ConsecutiveFails int    `json:"consecutive_fails"`
	FailThreshold    int    `json:"fail_threshold"`
	ActionTaken      string `json:"action_taken"`
}

type Watchdog struct {
	targetHost    string
	interval      time.Duration
	failThreshold int
	stopChan      chan struct{}
	mu            sync.Mutex
	status        WatchdogStatus
	isTesting     bool
	pingFunc      func(host string) bool
}

func NewWatchdog(targetHost string, interval time.Duration, failThreshold int) *Watchdog {
	if targetHost == "" {
		targetHost = "1.1.1.1"
	}
	if interval <= 0 {
		interval = 30 * time.Second
	}
	if failThreshold <= 0 {
		failThreshold = 3
	}

	w := &Watchdog{
		targetHost:    targetHost,
		interval:      interval,
		failThreshold: failThreshold,
		stopChan:      make(chan struct{}),
		status: WatchdogStatus{
			Enabled:       true,
			TargetHost:    targetHost,
			FailThreshold: failThreshold,
			IsConnected:   true,
		},
	}
	w.pingFunc = w.defaultPing
	return w
}

func (w *Watchdog) defaultPing(host string) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, "53"), 3*time.Second)
	if err == nil {
		_ = conn.Close()
		return true
	}
	// Fallback to HTTP port 80 check if port 53 dial failed
	connHTTP, errHTTP := net.DialTimeout("tcp", net.JoinHostPort(host, "80"), 3*time.Second)
	if errHTTP == nil {
		_ = connHTTP.Close()
		return true
	}
	return false
}

// Start launches watchdog loop in a goroutine
func (w *Watchdog) Start() {
	go func() {
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				w.CheckOnce()
			case <-w.stopChan:
				log.Println("[Watchdog] Stopping Watchdog daemon goroutine")
				return
			}
		}
	}()
}

// Stop cleanly terminates the watchdog loop
func (w *Watchdog) Stop() {
	close(w.stopChan)
}

func (w *Watchdog) CheckOnce() {
	w.mu.Lock()
	defer w.mu.Unlock()

	now := time.Now().Unix()
	w.status.LastCheckTime = now

	success := w.pingFunc(w.targetHost)
	if success {
		w.status.IsConnected = true
		w.status.ConsecutiveFails = 0
		w.status.ActionTaken = "none"
	} else {
		w.status.ConsecutiveFails++
		w.status.IsConnected = false
		log.Printf("[Watchdog] Warning: Ping check failed for %s (fail count: %d/%d)",
			w.targetHost, w.status.ConsecutiveFails, w.failThreshold)

		if w.status.ConsecutiveFails >= w.failThreshold {
			w.status.ActionTaken = "recovery_triggered"
			log.Printf("[Watchdog] ALERT: Connection lost! Recovery threshold reached (%d consecutive fails)",
				w.status.ConsecutiveFails)
		}
	}

	w.writeStatusFile()
}

func (w *Watchdog) GetStatus() WatchdogStatus {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.status
}

func (w *Watchdog) writeStatusFile() {
	data, err := json.MarshalIndent(w.status, "", "  ")
	if err != nil {
		return
	}

	tmpDir := os.TempDir()
	if _, err := os.Stat("/tmp"); err == nil {
		tmpDir = "/tmp"
	}

	targetFile := filepath.Join(tmpDir, "qmanager_watchdog_status.json")
	tmpFile := fmt.Sprintf("%s.tmp", targetFile)

	if err := os.WriteFile(tmpFile, data, 0644); err == nil {
		_ = os.Rename(tmpFile, targetFile)
	}
}

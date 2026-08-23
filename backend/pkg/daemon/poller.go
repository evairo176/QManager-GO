package daemon

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"qmanager-backend/pkg/at"
)

type Poller struct {
	atClient at.Executor
	interval time.Duration
}

func NewPoller(atClient at.Executor, interval time.Duration) *Poller {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &Poller{
		atClient: atClient,
		interval: interval,
	}
}

// Start runs background polling loop in a goroutine
func (p *Poller) Start() {
	go func() {
		ticker := time.NewTicker(p.interval)
		defer ticker.Stop()

		for range ticker.C {
			p.pollOnce()
		}
	}()
}

func (p *Poller) pollOnce() {
	// Query Serving Cell AT command
	resp, err := p.atClient.Exec(`AT+QENG="servingcell"`)

	status := map[string]interface{}{
		"timestamp":            time.Now().Unix(),
		"system_state":         "ready",
		"modem_reachable":      err == nil && !strings.Contains(resp, "ERROR"),
		"last_successful_poll": time.Now().Unix(),
		"network": map[string]interface{}{
			"type":     "NR5G-SA",
			"sim_slot": 1,
		},
		"raw_response": resp,
	}

	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return
	}

	tmpDir := os.TempDir()
	if _, err := os.Stat("/tmp"); err == nil {
		tmpDir = "/tmp"
	}

	tmpFile := filepath.Join(tmpDir, "qmanager_status.json.tmp")
	targetFile := filepath.Join(tmpDir, "qmanager_status.json")

	if err := os.WriteFile(tmpFile, data, 0644); err == nil {
		_ = os.Rename(tmpFile, targetFile)
	} else {
		log.Printf("[Poller] Warning: Failed to write cache file: %v", err)
	}
}

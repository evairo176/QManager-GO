package daemon

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"qmanager-backend/pkg/at"
)

func TestPoller(t *testing.T) {
	mockAT := at.NewMockClient()
	poller := NewPoller(mockAT, 100*time.Millisecond)

	poller.pollOnce()

	tmpDir := os.TempDir()
	if _, err := os.Stat("/tmp"); err == nil {
		tmpDir = "/tmp"
	}
	statusFile := filepath.Join(tmpDir, "qmanager_status.json")
	if _, err := os.Stat(statusFile); err != nil {
		t.Errorf("expected %s to be created by pollOnce", statusFile)
	}

	poller.Start()
	time.Sleep(200 * time.Millisecond)
}

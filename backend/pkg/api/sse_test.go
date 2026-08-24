package api

import (
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestHandleSSEStream(t *testing.T) {
	server := &Server{}

	tmpDir := os.TempDir()
	if _, err := os.Stat("/tmp"); err == nil {
		tmpDir = "/tmp"
	}
	statusFile := filepath.Join(tmpDir, "qmanager_status.json")
	_ = os.WriteFile(statusFile, []byte(`{"sim_status":"ready"}`), 0644)
	defer os.Remove(statusFile)

	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest("GET", "/cgi-bin/quecmanager/api/stream/status", nil).WithContext(ctx)
	w := httptest.NewRecorder()

	go func() {
		time.Sleep(150 * time.Millisecond)
		cancel()
	}()

	done := make(chan bool)
	go func() {
		server.HandleSSEStream(w, req)
		done <- true
	}()

	select {
	case <-done:
		if w.Header().Get("Content-Type") != "text/event-stream" {
			t.Errorf("expected Content-Type text/event-stream, got %s", w.Header().Get("Content-Type"))
		}
	case <-time.After(3 * time.Second):
		t.Fatal("SSE handler timed out")
	}
}

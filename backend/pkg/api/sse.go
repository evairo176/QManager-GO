package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// HandleSSEStream streams real-time status telemetry via Server-Sent Events (SSE)
func (s *Server) HandleSSEStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming_unsupported"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	tmpDir := os.TempDir()
	if _, err := os.Stat("/tmp"); err == nil {
		tmpDir = "/tmp"
	}
	statusFile := filepath.Join(tmpDir, "qmanager_status.json")

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// Initial comment to establish stream
	fmt.Fprintf(w, ": sse connected\n\n")
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			data, err := os.ReadFile(statusFile)
			if err != nil {
				data = []byte(`{"status":"loading"}`)
			}

			fmt.Fprintf(w, "event: telemetry\ndata: %s\n\n", string(data))
			flusher.Flush()
		}
	}
}

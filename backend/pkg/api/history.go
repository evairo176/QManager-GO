package api

import (
	"bufio"
	"bytes"
	"net/http"
	"os"
)

// HandleFetchSignalHistory reads NDJSON from /tmp/qmanager_signal_history.json and returns a JSON array
func (s *Server) HandleFetchSignalHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	serveNDJSONAsArray(w, "/tmp/qmanager_signal_history.json")
}

// HandleFetchPingHistory reads NDJSON from /tmp/qmanager_ping_history.json and returns a JSON array
func (s *Server) HandleFetchPingHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	serveNDJSONAsArray(w, "/tmp/qmanager_ping_history.json")
}

func serveNDJSONAsArray(w http.ResponseWriter, path string) {
	file, err := os.Open(path)
	if err != nil {
		_, _ = w.Write([]byte("[]"))
		return
	}
	defer file.Close()

	var buf bytes.Buffer
	buf.WriteString("[")
	first := true

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		if !first {
			buf.WriteString(",")
		}
		buf.Write(line)
		first = false
	}

	buf.WriteString("]")
	if buf.Len() == 2 {
		_, _ = w.Write([]byte("[]"))
		return
	}

	_, _ = w.Write(buf.Bytes())
}

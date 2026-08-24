package speedtest

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSpeedtest(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/__down" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(make([]byte, 1024*1024))
			return
		}
		if r.URL.Path == "/__up" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	tester := NewTester(ts.URL)
	tester.downloadMB = 1
	tester.uploadMB = 1

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := tester.Execute(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Status != "success" {
		t.Errorf("expected success status, got %s", result.Status)
	}
	if result.DownloadMbps <= 0 {
		t.Errorf("expected download mbps > 0, got %f", result.DownloadMbps)
	}
}

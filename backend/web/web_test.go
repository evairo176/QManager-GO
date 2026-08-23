package web

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestWebEmbedding(t *testing.T) {
	fs := GetFileSystem()
	if fs == nil {
		t.Fatalf("GetFileSystem returned nil")
	}

	handler := ServeEmbeddedWeb()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected HTTP 200 for root, got %d", rec.Code)
	}

	// SPA Route Fallback Test
	reqSPA := httptest.NewRequest(http.MethodGet, "/cellular/tower-lock", nil)
	recSPA := httptest.NewRecorder()
	handler.ServeHTTP(recSPA, reqSPA)

	if recSPA.Code != http.StatusOK {
		t.Errorf("expected HTTP 200 for SPA route, got %d", recSPA.Code)
	}

	tempDir := filepath.Join(os.TempDir(), "qmanager_web_test")
	_ = os.MkdirAll(tempDir, 0755)
	defer os.RemoveAll(tempDir)

	if !LocalDirExists(tempDir) {
		t.Errorf("expected LocalDirExists to be true for existing dir")
	}
}

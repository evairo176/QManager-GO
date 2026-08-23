package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"qmanager-backend/pkg/at"
)

func TestAPIWithMockClient(t *testing.T) {
	mockAT := at.NewMockClient()
	server := NewServer(mockAT)

	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	t.Run("HandleBandsCurrent", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/cgi-bin/quecmanager/bands/current.sh", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200, got %d", rec.Code)
		}

		var res map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("failed to unmarshal JSON response: %v", err)
		}

		if res["success"] != true {
			t.Errorf("expected success: true, got %v", res["success"])
		}

		current, ok := res["current"].(map[string]interface{})
		if !ok || current["lte_bands"] != "1:3:7:28" {
			t.Errorf("expected lte_bands '1:3:7:28', got %v", current["lte_bands"])
		}
	})

	t.Run("HandleTowerLock 5G NR", func(t *testing.T) {
		payload := []byte(`{"type":"nr_sa","action":"lock","pci":108,"arfcn":627464,"scs":30,"band":78}`)
		req := httptest.NewRequest(http.MethodPost, "/cgi-bin/quecmanager/tower/lock.sh", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200, got %d", rec.Code)
		}

		var res map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("failed to unmarshal JSON: %v", err)
		}

		if res["success"] != true || res["locked"] != true {
			t.Errorf("expected lock success, got %v", res)
		}

		// Verify executed AT command in mock history
		history := mockAT.GetHistory()
		lastCmd := history[len(history)-1]
		expectedCmd := `AT+QNWLOCK="common/5g",108,627464,30,78`
		if lastCmd != expectedCmd {
			t.Errorf("expected AT command %q, got %q", expectedCmd, lastCmd)
		}
	})

	t.Run("HandleCellularSettings GET", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/cgi-bin/quecmanager/cellular/settings.sh", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200, got %d", rec.Code)
		}

		var res map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("failed to unmarshal JSON: %v", err)
		}

		if res["success"] != true {
			t.Errorf("expected success true, got %v", res)
		}
	})

	t.Run("HandleAPN GET", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/cgi-bin/quecmanager/cellular/apn.sh", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200, got %d", rec.Code)
		}

		var res map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("failed to unmarshal JSON: %v", err)
		}

		if res["success"] != true {
			t.Errorf("expected success true, got %v", res)
		}
	})
}

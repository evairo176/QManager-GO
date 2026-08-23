package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
)

type CellularSettingsResponse struct {
	Success  bool                   `json:"success"`
	Settings map[string]interface{} `json:"settings"`
	Error    string                 `json:"error,omitempty"`
}

type CellularSettingsUpdateRequest struct {
	SimSlot  int    `json:"sim_slot"`
	PrefMode string `json:"pref_mode"`
}

// HandleCellularSettings handles GET and POST for modem cellular basic settings
func (s *Server) HandleCellularSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		// Read SIM slot and mode from AT command
		simSlotResp, _ := s.atClient.Exec(`AT+QUIMSLOT?`)

		slot := 1
		if atContains(simSlotResp, "+QUIMSLOT: 2") {
			slot = 2
		}

		_ = json.NewEncoder(w).Encode(CellularSettingsResponse{
			Success: true,
			Settings: map[string]interface{}{
				"sim_slot":    slot,
				"pref_mode":   "AUTO",
				"auto_switch": false,
			},
		})
		return
	}

	if r.Method == http.MethodPost {
		var req CellularSettingsUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_json"})
			return
		}

		if req.SimSlot == 1 || req.SimSlot == 2 {
			atCmd := fmt.Sprintf(`AT+QUIMSLOT=%d`, req.SimSlot)
			_, _ = s.atClient.Exec(atCmd)
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}

	http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
}

type IMEISettingsRequest struct {
	IMEI string `json:"imei"`
}

// HandleIMEISettings handles GET and POST for IMEI modification
func (s *Server) HandleIMEISettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		resp, _ := s.atClient.Exec(`AT+GSN`)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"imei":    resp,
		})
		return
	}

	if r.Method == http.MethodPost {
		var req IMEISettingsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IMEI) != 15 {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "invalid_imei",
				"detail":  "IMEI must be 15 digits",
			})
			return
		}

		atCmd := fmt.Sprintf(`AT+EGMR=1,7,"%s"`, req.IMEI)
		resp, err := s.atClient.Exec(atCmd)
		if err != nil || atHasError(resp) {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
}

type TTLSettingsRequest struct {
	Enabled bool `json:"enabled"`
	Value   int  `json:"value"`
}

// HandleTTLSettings handles GET and POST for network TTL override
func (s *Server) HandleTTLSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"ttl": map[string]interface{}{
				"enabled": true,
				"value":   64,
			},
		})
		return
	}

	if r.Method == http.MethodPost {
		var req TTLSettingsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_json"})
			return
		}

		// Apply TTL using iptables wrapper
		if _, err := exec.LookPath("iptables"); err == nil && req.Enabled {
			val := req.Value
			if val <= 0 {
				val = 64
			}
			cmdStr := fmt.Sprintf("iptables -t mangle -A POSTROUTING -j TTL --ttl-set %d", val)
			_ = exec.Command("sh", "-c", cmdStr).Run()
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
}

func atContains(resp, substr string) bool {
	return strings.Contains(resp, substr)
}

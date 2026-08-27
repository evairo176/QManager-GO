package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
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

		// Preferred network mode via AT+CNMP (Quectel): 2=4G only, 9=5G only,
		// 13=4G/5G auto, 0=AUTO all. Fall back to "AUTO" if unsupported.
		prefMode := "AUTO"
		if resp, err := s.atClient.Exec(`AT+CNMP?`); err == nil {
			switch {
			case atContains(resp, "+CNMP: 2"):
				prefMode = "4G_ONLY"
			case atContains(resp, "+CNMP: 9"):
				prefMode = "5G_ONLY"
			case atContains(resp, "+CNMP: 13"):
				prefMode = "4G_5G"
			case atContains(resp, "+CNMP: 0"):
				prefMode = "AUTO"
			}
		}

		_ = json.NewEncoder(w).Encode(CellularSettingsResponse{
			Success: true,
			Settings: map[string]interface{}{
				"sim_slot":    slot,
				"pref_mode":   prefMode,
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

		if req.PrefMode != "" {
			cnmp := map[string]string{
				"4G_ONLY": "2",
				"5G_ONLY": "9",
				"4G_5G":   "13",
				"AUTO":    "0",
			}[req.PrefMode]
			if cnmp != "" {
				_, _ = s.atClient.Exec(`AT+CNMP=` + cnmp)
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}

	http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
}

type IMEISettingsRequest struct {
	Action     string `json:"action"`
	IMEI       string `json:"imei"`
	Enabled    *bool  `json:"enabled,omitempty"`
	BackupIMEI string `json:"backup_imei,omitempty"`
}

// HandleIMEISettings handles GET and POST for IMEI modification
func (s *Server) HandleIMEISettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		resp, _ := s.atClient.Exec(`AT+GSN`)
		cleanIMEI := strings.TrimSpace(resp)
		// Extract 15 digits if output includes OK or extra newlines
		for _, line := range strings.Split(cleanIMEI, "\n") {
			line = strings.TrimSpace(line)
			if len(line) == 15 && isDigits(line) {
				cleanIMEI = line
				break
			}
		}

		backupEnabled := false
		backupImeiStr := ""
		if data, err := os.ReadFile("/etc/qmanager/imei_backup.json"); err == nil {
			var bData struct {
				Enabled bool   `json:"enabled"`
				IMEI    string `json:"imei"`
			}
			if err := json.Unmarshal(data, &bData); err == nil {
				backupEnabled = bData.Enabled
				backupImeiStr = bData.IMEI
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":      true,
			"current_imei": cleanIMEI,
			"backup": map[string]interface{}{
				"enabled": backupEnabled,
				"imei":    backupImeiStr,
			},
		})
		return
	}

	if r.Method == http.MethodPost {
		var req IMEISettingsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "invalid_json",
			})
			return
		}

		imeiToSet := req.IMEI
		if req.Action == "save_backup" {
			enabled := false
			if req.Enabled != nil {
				enabled = *req.Enabled
			}
			bData := map[string]interface{}{
				"enabled": enabled,
				"imei":    req.BackupIMEI,
			}
			if bytes, err := json.Marshal(bData); err == nil {
				_ = os.MkdirAll("/etc/qmanager", 0755)
				_ = os.WriteFile("/etc/qmanager/imei_backup.json", bytes, 0644)
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
			return
		}

		if req.Action == "reboot" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
			go func() {
				time.Sleep(1 * time.Second)
				_, _ = s.atClient.Exec(`AT+CFUN=1,1`)
			}()
			return
		}

		if len(imeiToSet) != 15 || !isDigits(imeiToSet) {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "invalid_imei",
				"detail":  "IMEI must be 15 digits",
			})
			return
		}

		atCmd := fmt.Sprintf(`AT+EGMR=1,7,"%s"`, imeiToSet)
		resp, err := s.atClient.Exec(atCmd)
		if err != nil || atHasError(resp) {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":         true,
			"reboot_required": true,
		})
		return
	}
}

func isDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
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

// HandleNetworkPriority handles GET and POST for RAT acquisition order priority
func (s *Server) HandleNetworkPriority(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		resp, err := s.atClient.Exec(`AT+QNWPREFCFG="rat_acq_order"`)
		orderStr := "NR5G:LTE:WCDMA"
		if err == nil && !strings.Contains(resp, "ERROR") {
			for _, line := range strings.Split(resp, "\n") {
				line = strings.TrimSpace(line)
				if strings.Contains(line, "rat_order_pref") || strings.Contains(line, "+QNWPREFCFG:") {
					parts := strings.Split(line, ",")
					if len(parts) >= 2 {
						orderStr = strings.Trim(strings.TrimSpace(parts[1]), `"`)
						break
					}
				}
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"order":   orderStr,
		})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Order string `json:"order"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Order == "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_json"})
			return
		}

		atCmd := fmt.Sprintf(`AT+QNWPREFCFG="rat_acq_order",%s`, req.Order)
		resp, err := s.atClient.Exec(atCmd)
		if err != nil || atHasError(resp) {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}

	http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
}

func atContains(resp, substr string) bool {
	return strings.Contains(resp, substr)
}

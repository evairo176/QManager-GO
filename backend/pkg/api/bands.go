package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
)

type BandLockRequest struct {
	BandType string `json:"band_type"`
	Bands    string `json:"bands"`
}

type FailoverToggleRequest struct {
	Enable  *bool `json:"enable"`
	Enabled *bool `json:"enabled"`
}

// HandleBandsCurrent returns currently locked bands and failover mechanism state
func (s *Server) HandleBandsCurrent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	lteBands := ""
	if resp, err := s.atClient.Exec(`AT+QNWPREFCFG="lte_band"`); err == nil {
		lteBands = parseSingleLineParam(resp, `+QNWPREFCFG: "lte_band",`)
	}

	nsaBands := ""
	if resp, err := s.atClient.Exec(`AT+QNWPREFCFG="nsa_nr5g_band"`); err == nil {
		nsaBands = parseSingleLineParam(resp, `+QNWPREFCFG: "nsa_nr5g_band",`)
	}

	saBands := ""
	if resp, err := s.atClient.Exec(`AT+QNWPREFCFG="nr5g_band"`); err == nil {
		saBands = parseSingleLineParam(resp, `+QNWPREFCFG: "nr5g_band",`)
	}

	nrdcBands := ""
	if resp, err := s.atClient.Exec(`AT+QNWPREFCFG="nrdc_nr5g_band"`); err == nil {
		nrdcBands = parseSingleLineParam(resp, `+QNWPREFCFG: "nrdc_nr5g_band",`)
	}

	failoverEnabled := fileExists("/etc/qmanager/band_failover.enabled") || fileExistsAndEquals("/etc/qmanager/band_failover_enabled", "1")
	failoverActivated := fileExists("/tmp/qmanager_band_failover")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"current": map[string]string{
			"lte_bands":       lteBands,
			"nsa_nr5g_bands":  nsaBands,
			"sa_nr5g_bands":   saBands,
			"nrdc_nr5g_bands": nrdcBands,
		},
		"failover": map[string]bool{
			"enabled":   failoverEnabled,
			"activated": failoverActivated,
		},
	})
}

// HandleBandsLock applies band locks for lte, nsa_nr5g, or sa_nr5g
func (s *Server) HandleBandsLock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req BandLockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BandType == "" || req.Bands == "" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "missing_fields",
			"detail":  "band_type and bands fields are required",
		})
		return
	}

	var atCmdType string
	switch req.BandType {
	case "lte":
		atCmdType = "lte_band"
	case "nsa_nr5g":
		atCmdType = "nsa_nr5g_band"
	case "sa_nr5g":
		atCmdType = "nr5g_band"
	case "nrdc_nr5g":
		atCmdType = "nrdc_nr5g_band"
	default:
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_band_type",
			"detail":  "band_type must be lte, nsa_nr5g, sa_nr5g, or nrdc_nr5g",
		})
		return
	}

	// Validate bands format (e.g. "1:3:7:28" or "all")
	if req.Bands != "all" && !regexp.MustCompile(`^[0-9]+(:[0-9]+)*$`).MatchString(req.Bands) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_bands",
			"detail":  "bands must be colon-delimited numbers or 'all'",
		})
		return
	}

	atCmd := fmt.Sprintf(`AT+QNWPREFCFG="%s",%s`, atCmdType, req.Bands)
	resp, err := s.atClient.Exec(atCmd)
	if err != nil || atHasError(resp) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "modem_error",
			"detail":  "Failed to send band lock command to modem",
		})
		return
	}

	// Clear failover flag
	_ = os.Remove("/tmp/qmanager_band_failover")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"band_type":      req.BandType,
		"bands":          req.Bands,
		"failover_armed": false,
	})
}

// HandleBandsFailoverToggle enables or disables the band failover safety mechanism
func (s *Server) HandleBandsFailoverToggle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req FailoverToggleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_payload",
		})
		return
	}

	_ = os.MkdirAll("/etc/qmanager", 0755)

	isEnabled := false
	if req.Enabled != nil {
		isEnabled = *req.Enabled
	} else if req.Enable != nil {
		isEnabled = *req.Enable
	}

	if isEnabled {
		_ = os.WriteFile("/etc/qmanager/band_failover.enabled", []byte("1\n"), 0644)
		_ = os.WriteFile("/etc/qmanager/band_failover_enabled", []byte("1\n"), 0644)
	} else {
		_ = os.Remove("/etc/qmanager/band_failover.enabled")
		_ = os.Remove("/etc/qmanager/band_failover_enabled")
		_ = os.Remove("/tmp/qmanager_band_failover")
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"enabled": isEnabled,
	})
}

// HandleBandsFailoverStatus checks current band failover status
func (s *Server) HandleBandsFailoverStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	failoverEnabled := fileExists("/etc/qmanager/band_failover.enabled") || fileExistsAndEquals("/etc/qmanager/band_failover_enabled", "1")
	failoverActivated := fileExists("/tmp/qmanager_band_failover")
	watcherRunning := fileExists("/tmp/qmanager_band_failover.pid")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"enabled":         failoverEnabled,
		"activated":       failoverActivated,
		"watcher_running": watcherRunning,
	})
}

func parseSingleLineParam(resp, prefix string) string {
	for _, line := range strings.Split(resp, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, prefix) {
			val := strings.TrimPrefix(line, prefix)
			val = strings.TrimSpace(val)
			val = strings.Trim(val, `"`)
			return val
		}
	}
	return ""
}

func atHasError(resp string) bool {
	return resp == "" || strings.Contains(resp, "ERROR")
}

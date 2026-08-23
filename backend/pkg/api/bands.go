package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
)

type BandLockRequest struct {
	BandType string `json:"band_type"`
	Bands    string `json:"bands"`
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
	default:
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_band_type",
			"detail":  "band_type must be lte, nsa_nr5g, or sa_nr5g",
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

func atHasError(resp string) bool {
	return resp == "" || resp == "ERROR"
}

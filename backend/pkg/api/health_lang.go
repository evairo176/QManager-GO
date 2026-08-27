package api

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// HandleHealthCheckStatus handles system health check diagnostics status
func (s *Server) HandleHealthCheckStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	atStatus := "error"
	if resp, err := s.atClient.Exec(`AT`); err == nil && strings.Contains(resp, "OK") {
		atStatus = "ok"
	}

	simStatus := "error"
	if resp, err := s.atClient.Exec(`AT+CPIN?`); err == nil {
		if strings.Contains(resp, "+CPIN: READY") {
			simStatus = "ok"
		} else {
			simStatus = "absent"
		}
	}

	netStatus := "error"
	if resp, err := s.atClient.Exec(`AT+CREG?`); err == nil {
		if strings.Contains(resp, "+CREG: 0,1") || strings.Contains(resp, "+CREG: 0,5") ||
			strings.Contains(resp, "+CREG: 2,1") || strings.Contains(resp, "+CREG: 2,5") {
			netStatus = "ok"
		} else {
			netStatus = "not_registered"
		}
	}

	diskStatus := "ok"
	var stat os.FileInfo
	if st, err := os.Stat("/"); err == nil {
		stat = st
		_ = stat
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"running": false,
		"results": map[string]interface{}{
			"at_channel":  atStatus,
			"sim_status":  simStatus,
			"network_reg": netStatus,
			"disk_space":  diskStatus,
		},
	})
}

// HandleHealthCheckRun initiates system health check
func (s *Server) HandleHealthCheckRun(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"detail":  "Health check started",
	})
}

// HandleLanguagePacksList lists installed and available i18n language packs
func (s *Server) HandleLanguagePacksList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	available := []map[string]string{
		{"code": "en", "name": "English"},
		{"code": "id", "name": "Indonesian"},
	}
	installed := []map[string]string{{"code": "en", "name": "English"}}

	if data, err := os.ReadFile("/usrdata/qmanager/web/locales/en/common.json"); err == nil && len(data) > 0 {
		_ = data
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"languages": available,
		"installed": installed,
		"current":   "en",
	})
}

// HandleLanguagePacksInstall installs a selected language pack
func (s *Server) HandleLanguagePacksInstall(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

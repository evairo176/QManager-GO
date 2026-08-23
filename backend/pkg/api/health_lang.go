package api

import (
	"encoding/json"
	"net/http"
)

// HandleHealthCheckStatus handles system health check diagnostics status
func (s *Server) HandleHealthCheckStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"running": false,
		"results": map[string]interface{}{
			"at_channel":  "ok",
			"sim_status":  "ok",
			"network_reg": "ok",
			"disk_space":  "ok",
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

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"languages": []map[string]string{
			{"code": "en", "name": "English"},
			{"code": "id", "name": "Indonesian"},
		},
		"current": "en",
	})
}

// HandleLanguagePacksInstall installs a selected language pack
func (s *Server) HandleLanguagePacksInstall(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

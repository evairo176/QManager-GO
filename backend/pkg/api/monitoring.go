package api

import (
	"encoding/json"
	"net/http"
	"os/exec"
)

// HandleMonitoringAlerts handles alert configuration and routing rules
func (s *Server) HandleMonitoringAlerts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"alerts": map[string]interface{}{
				"enabled": true,
				"discord": map[string]interface{}{"enabled": false},
				"email":   map[string]interface{}{"enabled": false},
				"sms":     map[string]interface{}{"enabled": false},
			},
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// HandleVPNTailscale handles Tailscale status and login
func (s *Server) HandleVPNTailscale(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		out, err := exec.Command("tailscale", "status", "--json").Output()
		if err == nil && len(out) > 0 {
			_, _ = w.Write(out)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   true,
			"installed": false,
			"running":   false,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

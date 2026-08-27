package api

import (
	"encoding/json"
	"net/http"
	"os/exec"

	"qmanager-backend/pkg/speedtest"
)

type RebootRequest struct {
	Action string `json:"action"`
}

// HandleSystemReboot handles reboot and network reconnect requests
func (s *Server) HandleSystemReboot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req RebootRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Action == "" {
		req.Action = "reboot"
	}

	if req.Action == "reconnect" {
		_, _ = s.atClient.Exec("AT+COPS=2")
		_, _ = s.atClient.Exec("AT+COPS=0")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"detail":  "Network reconnect initiated",
		})
		return
	}

	// Device reboot
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"detail":  "Device rebooting...",
	})

	go func() {
		_ = exec.Command("reboot").Run()
	}()
}

// HandleSystemLogs returns system log lines from logread or dmesg
func (s *Server) HandleSystemLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	out, err := exec.Command("logread", "-l", "100").Output()
	if err != nil {
		out, _ = exec.Command("dmesg").Output()
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"logs":    string(out),
	})
}

// HandleSpeedtestCheck returns whether speedtest binary is available
func (s *Server) HandleSpeedtestCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"available": true,
		"installed": true,
		"binary":    "embedded",
	})
}

// HandleSpeedtestServers returns nearby test servers
func (s *Server) HandleSpeedtestServers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"servers": []map[string]interface{}{
			{
				"id":       "1",
				"name":     "Jakarta Cloud",
				"location": "Jakarta",
				"country":  "Indonesia",
				"host":     "speed.cloudflare.com",
			},
		},
	})
}

// HandleSpeedtestStart initiates a background speed test run
func (s *Server) HandleSpeedtestStart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mgr := speedtest.GetManager()
	err := mgr.StartTest("http://speed.cloudflare.com")
	if err != nil {
		if err.Error() == "already_running" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "already_running",
			})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"status":  "running",
	})
}

// HandleSpeedtestStatus returns current speed test execution progress
func (s *Server) HandleSpeedtestStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mgr := speedtest.GetManager()
	statusData := mgr.GetStatus()
	_ = json.NewEncoder(w).Encode(statusData)
}

// HandlePublicOverview returns non-sensitive pre-auth device info
func (s *Server) HandlePublicOverview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"system_name":   "QManager RM520N",
		"auth_required": true,
	})
}

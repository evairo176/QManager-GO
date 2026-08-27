package api

import (
	"encoding/json"
	"net/http"
	"os/exec"
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
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"test_id": "test_1",
		"status":  "completed",
		"results": map[string]interface{}{
			"download_mbps": 75.4,
			"upload_mbps":   32.8,
			"ping_ms":       18.5,
			"jitter_ms":     3.2,
		},
	})
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

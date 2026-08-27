package api

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

// ---------------------------------------------------------------------------
// NetBird VPN — GET status + POST actions.
// Frontend: /cgi-bin/quecmanager/vpn/netbird.sh (use-netbird.ts)
// ---------------------------------------------------------------------------

func (s *Server) HandleNetBird(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.netbirdGet(w)
		return
	}
	if r.Method == http.MethodPost {
		s.netbirdPost(w, r)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "method_not_allowed"})
}

func netbirdBinary() string {
	for _, p := range []string{"/usr/bin/netbird", "/opt/sbin/netbird", "/usr/local/bin/netbird"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func (s *Server) netbirdGet(w http.ResponseWriter) {
	bin := netbirdBinary()
	base := map[string]any{
		"success":            true,
		"installed":          bin != "",
		"daemon_running":     false,
		"enabled_on_boot":    false,
		"install_hint":       "NetBird is not installed. Install the client package to get started.",
	}

	if bin == "" {
		_ = json.NewEncoder(w).Encode(base)
		return
	}
	delete(base, "install_hint")

	// daemon / service state
	svc := exec.Command("systemctl", "is-active", "netbird")
	if out, err := svc.Output(); err == nil && strings.TrimSpace(string(out)) == "active" {
		base["daemon_running"] = true
	}
	en := exec.Command("systemctl", "is-enabled", "netbird")
	if out, err := en.Output(); err == nil && strings.TrimSpace(string(out)) == "enabled" {
		base["enabled_on_boot"] = true
	}

	// netbird status --json
	statusOut, err := exec.Command(bin, "status", "--json").Output()
	if err != nil || len(statusOut) == 0 {
		_ = json.NewEncoder(w).Encode(base)
		return
	}
	var st struct {
		DaemonRunning bool   `json:"daemon_running"`
		BackendState  string `json:"backend_state"`
		Management    string `json:"management"`
		Signal        string `json:"signal"`
		FQDN          string `json:"fqdn"`
		NetbirdIP     string `json:"netbird_ip"`
		Peers         []any  `json:"peers"`
	}
	if json.Unmarshal(statusOut, &st) != nil {
		_ = json.NewEncoder(w).Encode(base)
		return
	}
	base["daemon_running"] = st.DaemonRunning
	base["backend_state"] = st.BackendState
	base["management"] = st.Management
	base["signal"] = st.Signal
	base["fqdn"] = st.FQDN
	base["netbird_ip"] = st.NetbirdIP
	base["peers_total"] = len(st.Peers)
	base["peers_connected"] = 0
	_ = json.NewEncoder(w).Encode(base)
}

func (s *Server) netbirdPost(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "invalid_json"})
		return
	}
	action, _ := body["action"].(string)
	bin := netbirdBinary()

	switch action {
	case "connect":
		if bin == "" {
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "not_installed"})
			return
		}
		args := []string{"up"}
		if key, ok := body["setup_key"].(string); ok && key != "" {
			args = append(args, "--setup-key", key)
		}
		if err := exec.Command(bin, args...).Run(); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "connect_failed", "detail": err.Error()})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	case "disconnect":
		_ = exec.Command(bin, "down").Run()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	case "start_service":
		_ = exec.Command("systemctl", "start", "netbird").Run()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	case "stop_service":
		_ = exec.Command("systemctl", "stop", "netbird").Run()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	case "set_boot_enabled":
		if v, ok := body["enabled"].(bool); ok {
			if v {
				_ = exec.Command("systemctl", "enable", "netbird").Run()
			} else {
				_ = exec.Command("systemctl", "disable", "netbird").Run()
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	case "install_status":
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "status": "idle"})
	case "uninstall":
		_ = exec.Command("systemctl", "stop", "netbird").Run()
		_ = exec.Command("systemctl", "disable", "netbird").Run()
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	default:
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "unknown_action", "detail": action})
	}
}

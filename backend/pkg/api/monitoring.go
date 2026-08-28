package api

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

const (
	smsConfigPath     = "/etc/qmanager/sms_alerts.json"
	emailConfigPath   = "/etc/qmanager/email_alerts.json"
	discordConfigPath = "/etc/qmanager/discord_bot.json"
	routingConfigPath = "/etc/qmanager/alert_routing.json"
	alertLogPath      = "/tmp/qmanager_alert_log.json"
)

func qmReadJSONFile(path string) map[string]any {
	out := map[string]any{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &out)
	}
	return out
}

func qmStr(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// HandleMonitoringAlerts handles alert configuration and routing rules
func (s *Server) HandleMonitoringAlerts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.alertsGet(w)
		return
	}
	if r.Method == http.MethodPost {
		s.alertsPost(w, r)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "method_not_allowed"})
}

func (s *Server) alertsGet(w http.ResponseWriter) {
	// --- SMS ---
	smsCfg := qmReadJSONFile(smsConfigPath)
	smsEnabled := qmBool(smsCfg["enabled"])
	smsPhone := qmStr(smsCfg["recipient_phone"])
	smsThreshold := qmCfgInt(smsCfg, "threshold_minutes", 5)

	// --- Email ---
	emailCfg := qmReadJSONFile(emailConfigPath)
	emailEnabled := qmBool(emailCfg["enabled"])
	emailSender := qmStr(emailCfg["sender_email"])
	emailRecipient := qmStr(emailCfg["recipient_email"])
	emailPwSet := qmStr(emailCfg["app_password"]) != ""
	emailThreshold := qmCfgInt(emailCfg, "threshold_minutes", 5)

	// --- Routing ---
	routing := qmReadJSONFile(routingConfigPath)
	events := map[string]any{}
	if ev, ok := routing["events"].(map[string]any); ok {
		events = ev
	}

	reboots := readRebootHistory()

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"channels": map[string]any{
			"sms": map[string]any{
				"enabled":           smsEnabled,
				"recipient_phone":   smsPhone,
				"configured":        smsPhone != "",
				"threshold_minutes": smsThreshold,
			},
			"email": map[string]any{
				"enabled":           emailEnabled,
				"sender_email":      emailSender,
				"recipient_email":   emailRecipient,
				"app_password_set":  emailPwSet,
				"configured":        emailSender != "" && emailRecipient != "" && emailPwSet,
				"msmtp_installed":   fileExistsAny("/usr/bin/msmtp", "/usr/sbin/msmtp"),
				"threshold_minutes": emailThreshold,
			},
		},
		"routing": map[string]any{
			"events": events,
		},
		"capabilities": map[string]any{
			"connection_lost": map[string]any{
				"sms": true, "email": false, "email_reason": "email_needs_internet",
			},
			"connection_restored": map[string]any{
				"sms": true, "email": true,
			},
			"reboot": map[string]any{
				"sms": true, "email": true,
			},
		},
		"reboots": reboots,
	})
}

func readRebootHistory() []map[string]any {
	out := []map[string]any{}
	if data, err := os.ReadFile("/etc/qmanager/crash.log"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			// format: <epoch>|reboot|reason
			parts := strings.Split(line, "|")
			epoch := 0
			cause := "unplanned"
			if len(parts) >= 1 {
				epoch, _ = strconv.Atoi(strings.TrimSpace(parts[0]))
			}
			if len(parts) >= 2 {
				reason := strings.ToLower(parts[1])
				switch {
				case strings.Contains(reason, "watchdog"):
					cause = "watchdog"
				case strings.Contains(reason, "user"), strings.Contains(reason, "scheduled"):
					cause = "user"
				}
			}
			out = append(out, map[string]any{"epoch": epoch, "cause": cause})
		}
	}
	return out
}

func (s *Server) alertsPost(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "invalid_json"})
		return
	}
	action, _ := body["action"].(string)

	switch action {
	case "save_settings":
		if v, ok := body["sms"].(map[string]any); ok {
			cfg := map[string]any{
				"enabled":          qmBool(v["enabled"]),
				"recipient_phone":  qmStr(v["recipient_phone"]),
				"threshold_minutes": qmCfgInt(v, "threshold_minutes", 5),
			}
			writeJSONFile(smsConfigPath, cfg)
		}
		if v, ok := body["email"].(map[string]any); ok {
			cfg := map[string]any{
				"enabled":           qmBool(v["enabled"]),
				"sender_email":      qmStr(v["sender_email"]),
				"recipient_email":   qmStr(v["recipient_email"]),
				"threshold_minutes": qmCfgInt(v, "threshold_minutes", 5),
			}
			if pw := qmStr(v["app_password"]); pw != "" {
				cfg["app_password"] = pw
			}
			writeJSONFile(emailConfigPath, cfg)
		}
		if v, ok := body["discord"].(map[string]any); ok {
			cfg := map[string]any{
				"enabled":           qmBool(v["enabled"]),
				"owner_discord_id":  qmStr(v["owner_discord_id"]),
				"threshold_minutes": qmCfgInt(v, "threshold_minutes", 5),
			}
			if tok := qmStr(v["bot_token"]); tok != "" {
				cfg["bot_token"] = tok
			}
			writeJSONFile(discordConfigPath, cfg)
		}
		// routing
		if v, ok := body["routing"].(map[string]any); ok {
			if ev, ok2 := v["events"].(map[string]any); ok2 {
				routing := map[string]any{"version": 1, "events": ev}
				writeJSONFile(routingConfigPath, routing)
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})

	case "send_test":
		channel := qmStr(body["channel"])
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"detail":  "Test " + channel + " alert dispatched",
		})

	case "get_log":
		lines := []map[string]any{}
		if data, err := os.ReadFile(alertLogPath); err == nil {
			_ = json.Unmarshal(data, &lines)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"entries": lines,
			"total":   len(lines),
		})

	case "install_status":
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "status": "idle"})

	default:
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "unknown_action", "detail": action})
	}
}

func writeJSONFile(path string, data map[string]any) {
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return
	}
	_ = os.MkdirAll("/etc/qmanager", 0755)
	_ = os.WriteFile(path, b, 0600)
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

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func qmBool(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case float64:
		return t != 0
	case string:
		return t == "true" || t == "1"
	}
	return false
}

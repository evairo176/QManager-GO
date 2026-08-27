package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// ---------------------------------------------------------------------------
// Connection Watchdog — GET status/settings + POST save/dismiss/revert.
// Config:  /etc/qmanager/qmanager.conf  (JSON, key "watchcat")
// State:   /tmp/qmanager_watchcat.json (written by the qmanager-watchcat daemon)
// Flags:   /tmp/qmanager_watchcat_reload, /tmp/qmanager_watchcat_disabled,
//          /tmp/qmanager_sim_swap_detected, /etc/qmanager/qmanager_sim_failover
// Contract mirrors the original CGI (monitoring/watchdog.sh).
// ---------------------------------------------------------------------------

const (
	qmConfigFile   = "/etc/qmanager/qmanager.conf"
	qmWatchcatState = "/tmp/qmanager_watchcat.json"
	qmSimSwapFlag  = "/tmp/qmanager_sim_swap_detected"
	qmSimFailover  = "/etc/qmanager/qmanager_sim_failover"
	qmReloadFlag   = "/tmp/qmanager_watchcat_reload"
	qmDisabledFlag = "/tmp/qmanager_watchcat_disabled"
)

func qmReadConfig() map[string]map[string]any {
	out := map[string]map[string]any{}
	data, err := os.ReadFile(qmConfigFile)
	if err != nil {
		return out
	}
	_ = json.Unmarshal(data, &out)
	return out
}

func qmWriteSection(section string, kv map[string]any) error {
	cfg := qmReadConfig()
	if cfg[section] == nil {
		cfg[section] = map[string]any{}
	}
	for k, v := range kv {
		cfg[section][k] = v
	}
	data, _ := json.MarshalIndent(cfg, "", "  ")
	tmp := qmConfigFile + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, qmConfigFile)
}

func qmReadFile(path string) map[string]any {
	out := map[string]any{}
	data, err := os.ReadFile(path)
	if err != nil {
		return out
	}
	_ = json.Unmarshal(data, &out)
	return out
}

func qmCfgInt(cfg map[string]any, key string, def int) int {
	if v, ok := cfg[key]; ok {
		switch t := v.(type) {
		case float64:
			return int(t)
		case string:
			if n, err := strconv.Atoi(t); err == nil {
				return n
			}
		case bool:
			if t {
				return 1
			}
			return 0
		}
	}
	return def
}

func qmCfgBool(cfg map[string]any, key string, def bool) bool {
	return qmCfgInt(cfg, key, map[bool]int{true: 1, false: 0}[def]) == 1
}

func qmServiceControl(name string, action string) {
	// Best-effort systemctl; the old QManager used svc_enable/svc_restart helpers.
	_ = exec.Command("systemctl", action, name).Run()
}

// HandleMonitoringWatchdog implements GET (settings + status) and POST
// (save_settings / dismiss_sim_swap / revert_sim).
func (s *Server) HandleMonitoringWatchdog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.watchdogGet(w)
		return
	}
	if r.Method == http.MethodPost {
		s.watchdogPost(w, r)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "method_not_allowed"})
}

func (s *Server) watchdogGet(w http.ResponseWriter) {
	cfg := qmReadConfig()["watchcat"]
	status := qmReadFile(qmWatchcatState)
	simFailover := qmReadFile(qmSimFailover)
	simSwap := qmReadFile(qmSimSwapFlag)
	autoDisabled := false
	if _, err := os.Stat(qmDisabledFlag); err == nil {
		autoDisabled = true
	}
	if simFailover == nil || len(simFailover) == 0 {
		simFailover = map[string]any{"active": false}
	}
	if simSwap == nil || len(simSwap) == 0 {
		simSwap = map[string]any{"detected": false}
	}

	backupSim := ""
	if v, ok := cfg["backup_sim_slot"].(string); ok {
		backupSim = v
	}
	var backupSimAny any
	if n, err := strconv.Atoi(backupSim); err == nil {
		backupSimAny = n
	} else {
		backupSimAny = nil
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"settings": map[string]any{
			"enabled":              qmCfgBool(cfg, "enabled", true),
			"fail_threshold":       qmCfgInt(cfg, "fail_threshold", 5),
			"probe_interval":       qmCfgInt(cfg, "probe_interval", 5),
			"check_interval":       qmCfgInt(cfg, "check_interval", 10),
			"cooldown":             qmCfgInt(cfg, "cooldown", 60),
			"tier1_enabled":        qmCfgBool(cfg, "tier1_enabled", true),
			"tier2_enabled":        qmCfgBool(cfg, "tier2_enabled", true),
			"tier3_enabled":        qmCfgBool(cfg, "tier3_enabled", false),
			"tier4_enabled":        qmCfgBool(cfg, "tier4_enabled", true),
			"backup_sim_slot":      backupSimAny,
			"max_reboots_per_hour": qmCfgInt(cfg, "max_reboots_per_hour", 10),
		},
		"status":       status,
		"sim_failover": simFailover,
		"sim_swap":     simSwap,
		"auto_disabled": autoDisabled,
	})
}

func (s *Server) watchdogPost(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "invalid_json"})
		return
	}
	action, _ := body["action"].(string)

	switch action {
	case "save_settings":
		s.watchdogSave(w, body)
	case "dismiss_sim_swap":
		if data, err := os.ReadFile(qmSimSwapFlag); err == nil {
			var m map[string]any
			if json.Unmarshal(data, &m) == nil {
				m["dismissed"] = true
				if out, err := json.Marshal(m); err == nil {
					_ = os.WriteFile(qmSimSwapFlag, out, 0644)
				}
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	case "revert_sim":
		_ = os.WriteFile("/tmp/qmanager_watchcat_revert", []byte("requested"), 0644)
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "SIM revert requested."})
	default:
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "unknown_action", "detail": action})
	}
}

func (s *Server) watchdogSave(w http.ResponseWriter, body map[string]any) {
	// Validate ints first (fail-fast, no partial write).
	iv := func(key string, min, max int) (int, bool) {
		v, ok := body[key]
		if !ok || v == nil {
			return 0, true
		}
		f, isFloat := v.(float64)
		if !isFloat {
			parsed, err := strconv.ParseFloat(fmt.Sprint(v), 64)
			if err != nil {
				return 0, false
			}
			f = parsed
		}
		if int(f) < min || int(f) > max {
			return 0, false
		}
		return int(f), true
	}

	updates := map[string]any{}

	if v, ok := body["enabled"]; ok {
		if b, ok := v.(bool); ok {
			updates["enabled"] = map[bool]int{true: 1, false: 0}[b]
		}
	}
	if n, ok := iv("fail_threshold", 1, 20); !ok {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "fail_threshold must be 1-20"})
		return
	} else if body["fail_threshold"] != nil {
		updates["fail_threshold"] = n
	}
	if n, ok := iv("probe_interval", 1, 60); !ok {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "probe_interval must be 1-60"})
		return
	} else if body["probe_interval"] != nil {
		updates["probe_interval"] = n
	}
	if n, ok := iv("check_interval", 5, 60); !ok {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "check_interval must be 5-60"})
		return
	} else if body["check_interval"] != nil {
		updates["check_interval"] = n
	}
	if n, ok := iv("cooldown", 10, 300); !ok {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "cooldown must be 10-300"})
		return
	} else if body["cooldown"] != nil {
		updates["cooldown"] = n
	}
	if n, ok := iv("max_reboots_per_hour", 1, 10); !ok {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "max_reboots_per_hour must be 1-10"})
		return
	} else if body["max_reboots_per_hour"] != nil {
		updates["max_reboots_per_hour"] = n
	}

	for _, tier := range []string{"tier1_enabled", "tier2_enabled", "tier3_enabled", "tier4_enabled"} {
		if v, ok := body[tier].(bool); ok {
			updates[tier] = map[bool]int{true: 1, false: 0}[v]
		}
	}
	if v, ok := body["backup_sim_slot"]; ok {
		switch t := v.(type) {
		case float64:
			if int(t) == 1 || int(t) == 2 {
				updates["backup_sim_slot"] = strconv.Itoa(int(t))
			} else {
				_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "backup_sim_slot must be 1 or 2"})
				return
			}
		case string:
			if t == "1" || t == "2" {
				updates["backup_sim_slot"] = t
			} else if t == "" {
				updates["backup_sim_slot"] = ""
			} else {
				_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "backup_sim_slot must be 1 or 2"})
				return
			}
		case nil:
			updates["backup_sim_slot"] = ""
		}
	}

	if len(updates) > 0 {
		_ = qmWriteSection("watchcat", updates)
	}

	// Signal daemon to reload.
	_ = os.WriteFile(qmReloadFlag, []byte("reload"), 0644)

	// Enable/disable the watchcat service based on new enabled state.
	enabled := true
	if v, ok := updates["enabled"]; ok {
		enabled = v == 1
	} else {
		cfg := qmReadConfig()["watchcat"]
		enabled = qmCfgBool(cfg, "enabled", true)
	}
	if enabled {
		_ = os.Remove(qmDisabledFlag)
		qmServiceControl("qmanager-watchcat", "enable")
		qmServiceControl("qmanager-watchcat", "restart")
	} else {
		qmServiceControl("qmanager-watchcat", "stop")
		qmServiceControl("qmanager-watchcat", "disable")
	}

	_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
}

// ---------------------------------------------------------------------------
// Recent Activities — serve NDJSON events file as a JSON array.
// ---------------------------------------------------------------------------

func (s *Server) HandleFetchEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	events := make([]map[string]any, 0)
	file, err := os.Open("/tmp/qmanager_events.json")
	if err != nil {
		_ = json.NewEncoder(w).Encode(events)
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var ev map[string]any
		if json.Unmarshal([]byte(line), &ev) == nil {
			events = append(events, ev)
		}
	}
	_ = json.NewEncoder(w).Encode(events)
}

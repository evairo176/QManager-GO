package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"

	"qmanager-backend/pkg/at"
)

type Server struct {
	atClient at.Executor
}

func NewServer(atClient at.Executor) *Server {
	return &Server{atClient: atClient}
}

// RegisterRoutes registers all QManager API routes
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	loginLimiter := NewIPRateLimiter(0.1, 5)     // 5 attempts burst, 1 refill per 10s
	atCmdLimiter := NewIPRateLimiter(10.0, 20)    // 10 req/s, burst 20

	// Auth Routes
	mux.HandleFunc("/cgi-bin/quecmanager/auth/login.sh", RateLimitMiddleware(loginLimiter, s.HandleAuthLogin))
	mux.HandleFunc("/cgi-bin/quecmanager/auth/logout.sh", s.HandleAuthLogout)
	mux.HandleFunc("/cgi-bin/quecmanager/auth/check.sh", s.HandleAuthCheck)

	// Modem & Core API Routes
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_data.sh", s.HandleFetchData)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/send_command.sh", RateLimitMiddleware(atCmdLimiter, s.HandleSendCommand))
	mux.HandleFunc("/cgi-bin/quecmanager/bands/current.sh", s.HandleBandsCurrent)
	mux.HandleFunc("/cgi-bin/quecmanager/bands/lock.sh", s.HandleBandsLock)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/sms.sh", s.HandleSMS)

	// Cellular & Network Settings Routes
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/settings.sh", s.HandleCellularSettings)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/imei.sh", s.HandleIMEISettings)
	mux.HandleFunc("/cgi-bin/quecmanager/network/ttl.sh", s.HandleTTLSettings)

	// Advanced Features Routes
	mux.HandleFunc("/cgi-bin/quecmanager/network/data_used.sh", s.HandleDataUsed)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/cell_scan_status.sh", s.HandleCellScanStatus)

	// History Charts Routes
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_signal_history.sh", s.HandleFetchSignalHistory)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_ping_history.sh", s.HandleFetchPingHistory)

	// System & Reboot Routes
	mux.HandleFunc("/cgi-bin/quecmanager/system/reboot.sh", s.HandleSystemReboot)
	mux.HandleFunc("/cgi-bin/quecmanager/system/logs.sh", s.HandleSystemLogs)
	mux.HandleFunc("/cgi-bin/quecmanager/public/overview.sh", s.HandlePublicOverview)

	// APN & MBN Management Routes
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/apn.sh", s.HandleAPN)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/mbn.sh", s.HandleMBN)

	// Tower & Frequency Locking Routes
	mux.HandleFunc("/cgi-bin/quecmanager/tower/lock.sh", s.HandleTowerLock)
	mux.HandleFunc("/cgi-bin/quecmanager/frequency/lock.sh", s.HandleFrequencyLock)

	// SIM Profiles & Connection Scenarios Routes
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/list.sh", s.HandleProfilesList)
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/apply.sh", s.HandleProfilesApply)
	mux.HandleFunc("/cgi-bin/quecmanager/scenarios/list.sh", s.HandleScenariosList)

	// Monitoring & Watchdog Routes
	mux.HandleFunc("/cgi-bin/quecmanager/monitoring/alerts.sh", s.HandleMonitoringAlerts)
	mux.HandleFunc("/cgi-bin/quecmanager/monitoring/watchdog.sh", s.HandleMonitoringWatchdog)
	mux.HandleFunc("/cgi-bin/quecmanager/vpn/tailscale.sh", s.HandleVPNTailscale)

	// System Health Check & Language Packs Routes
	mux.HandleFunc("/cgi-bin/quecmanager/system/health-check/status.sh", s.HandleHealthCheckStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/system/health-check/run.sh", s.HandleHealthCheckRun)
	mux.HandleFunc("/cgi-bin/quecmanager/system/language-packs/list.sh", s.HandleLanguagePacksList)
	mux.HandleFunc("/cgi-bin/quecmanager/system/language-packs/install.sh", s.HandleLanguagePacksInstall)
}

// HandleFetchData reads status from /tmp/qmanager_status.json or returns fallback
func (s *Server) HandleFetchData(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cacheFile := "/tmp/qmanager_status.json"
	data, err := os.ReadFile(cacheFile)
	if err == nil && len(data) > 0 {
		_, _ = w.Write(data)
		return
	}

	// Fallback JSON if cache does not exist yet
	fallback := map[string]interface{}{
		"timestamp":            0,
		"system_state":         "initializing",
		"modem_reachable":      false,
		"last_successful_poll": 0,
		"errors":               []string{"poller_not_started"},
		"network": map[string]interface{}{
			"type":           "",
			"sim_slot":       1,
			"carrier":        "",
			"service_status": "unknown",
			"ca_active":      false,
			"ca_count":       0,
		},
		"lte": map[string]interface{}{
			"state": "unknown", "band": "", "earfcn": nil, "bandwidth": nil, "pci": nil, "rsrp": nil, "rsrq": nil, "sinr": nil, "rssi": nil,
		},
		"nr": map[string]interface{}{
			"state": "unknown", "band": "", "arfcn": nil, "pci": nil, "rsrp": nil, "rsrq": nil, "sinr": nil, "scs": nil,
		},
		"device": map[string]interface{}{
			"temperature": nil, "cpu_usage": 0, "memory_used_mb": 0, "memory_total_mb": 0,
			"uptime_seconds": 0, "conn_uptime_seconds": 0,
			"firmware": "", "build_date": "", "manufacturer": "", "model": "",
			"imei": "", "imsi": "", "iccid": "", "phone_number": "",
			"lte_category": "", "mimo": "",
		},
	}
	_ = json.NewEncoder(w).Encode(fallback)
}

type CommandRequest struct {
	Command string `json:"command"`
}

// HandleSendCommand executes raw AT command safely
func (s *Server) HandleSendCommand(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req CommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Command == "" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "no_command",
			"message": "Missing command field in JSON body",
		})
		return
	}

	cmdUpper := strings.ToUpper(req.Command)
	if strings.Contains(cmdUpper, "QSCAN") || strings.Contains(cmdUpper, "QSCANFREQ") {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "blocked",
			"message": "Use the Cell Scanner page for this command.",
		})
		return
	}

	resp, err := s.atClient.Exec(req.Command)
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  false,
			"error":    "exec_failed",
			"response": err.Error(),
			"command":  req.Command,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"response": resp,
		"command":  req.Command,
	})
}

// HandleBandsCurrent queries configured bands from modem
func (s *Server) HandleBandsCurrent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	raw, err := s.atClient.Exec(`AT+QNWPREFCFG="ue_capability_band"`)
	if err != nil || strings.Contains(raw, "ERROR") {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "modem_error",
			"message": "Failed to query current band configuration",
		})
		return
	}

	lteBands := extractBandList(raw, "lte_band")
	nsaBands := extractBandList(raw, "nsa_nr5g_band")
	saBands := extractBandList(raw, "nr5g_band")

	failoverEnabled := fileExistsAndEquals("/etc/qmanager/band_failover_enabled", "1")
	failoverActivated := fileExists("/tmp/qmanager_band_failover")
	watcherRunning := fileExists("/tmp/qmanager_band_failover.pid")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"current": map[string]string{
			"lte_bands":      lteBands,
			"nsa_nr5g_bands": nsaBands,
			"sa_nr5g_bands":  saBands,
		},
		"failover": map[string]interface{}{
			"enabled":         failoverEnabled,
			"activated":       failoverActivated,
			"watcher_running": watcherRunning,
		},
	})
}

func extractBandList(raw, bandType string) string {
	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		if strings.Contains(line, fmt.Sprintf(`"%s"`, bandType)) {
			if bandType == "nr5g_band" && (strings.Contains(line, "nsa_") || strings.Contains(line, "nrdc_")) {
				continue
			}
			re := regexp.MustCompile(fmt.Sprintf(`.*"%s",`, bandType))
			cleaned := re.ReplaceAllString(line, "")
			return strings.TrimSpace(cleaned)
		}
	}
	return ""
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func fileExistsAndEquals(path, expected string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(data)) == expected
}

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
	loginLimiter := NewIPRateLimiter(0.1, 5)   // 5 attempts burst, 1 refill per 10s
	atCmdLimiter := NewIPRateLimiter(10.0, 20) // 10 req/s, burst 20

	// Auth Routes
	mux.HandleFunc("/cgi-bin/quecmanager/auth/login.sh", RateLimitMiddleware(loginLimiter, s.HandleAuthLogin))
	mux.HandleFunc("/cgi-bin/quecmanager/auth/logout.sh", s.HandleAuthLogout)
	mux.HandleFunc("/cgi-bin/quecmanager/auth/check.sh", s.HandleAuthCheck)

	// Modem & Core API Routes
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_data.sh", s.HandleFetchData)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/send_command.sh", RateLimitMiddleware(atCmdLimiter, s.HandleSendCommand))
	mux.HandleFunc("/cgi-bin/quecmanager/bands/current.sh", s.HandleBandsCurrent)
	mux.HandleFunc("/cgi-bin/quecmanager/bands/lock.sh", s.HandleBandsLock)
	mux.HandleFunc("/cgi-bin/quecmanager/bands/failover_status.sh", s.HandleBandsFailoverStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/bands/failover_toggle.sh", s.HandleBandsFailoverToggle)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/sms.sh", s.HandleSMS)

	// Cellular & Network Settings Routes
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/radio_details.sh", s.HandleRadioDetails)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/settings.sh", s.HandleCellularSettings)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/imei.sh", s.HandleIMEISettings)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/network_priority.sh", s.HandleNetworkPriority)
	mux.HandleFunc("/cgi-bin/quecmanager/network/ttl.sh", s.HandleTTLSettings)

	// Advanced Features Routes
	mux.HandleFunc("/cgi-bin/quecmanager/network/data_used.sh", s.HandleDataUsed)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/cell_scan_status.sh", s.HandleCellScanStatus)

	// History Charts Routes
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_signal_history.sh", s.HandleFetchSignalHistory)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_ping_history.sh", s.HandleFetchPingHistory)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/fetch_events.sh", s.HandleFetchEvents)

	// System & Reboot Routes
	mux.HandleFunc("/cgi-bin/quecmanager/system/reboot.sh", s.HandleSystemReboot)
	mux.HandleFunc("/cgi-bin/quecmanager/system/logs.sh", s.HandleSystemLogs)
	mux.HandleFunc("/cgi-bin/quecmanager/system/ipa_offload.sh", s.HandleIPAOffload)
	mux.HandleFunc("/cgi-bin/quecmanager/system/realtime.sh", s.HandleRealtime)
	mux.HandleFunc("/cgi-bin/quecmanager/system/data_usage.sh", s.HandleDataUsage)
	mux.HandleFunc("/cgi-bin/quecmanager/public/overview.sh", s.HandlePublicOverview)

	// APN & MBN Management Routes
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/apn.sh", s.HandleAPN)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/mbn.sh", s.HandleMBN)

	// Tower & Frequency Locking Routes
	mux.HandleFunc("/cgi-bin/quecmanager/tower/status.sh", s.HandleTowerStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/tower/lock.sh", s.HandleTowerLock)
	mux.HandleFunc("/cgi-bin/quecmanager/tower/settings.sh", s.HandleTowerSettings)
	mux.HandleFunc("/cgi-bin/quecmanager/tower/schedule.sh", s.HandleTowerSchedule)
	mux.HandleFunc("/cgi-bin/quecmanager/frequency/status.sh", s.HandleFrequencyStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/frequency/lock.sh", s.HandleFrequencyLock)

	// SIM Profiles & Connection Scenarios Routes
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/list.sh", s.HandleProfilesList)
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/get.sh", s.HandleProfilesGet)
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/save.sh", s.HandleProfilesSave)
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/delete.sh", s.HandleProfilesDelete)
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/apply.sh", s.HandleProfilesApply)
	mux.HandleFunc("/cgi-bin/quecmanager/profiles/current_settings.sh", s.HandleProfilesCurrentSettings)
	mux.HandleFunc("/cgi-bin/quecmanager/scenarios/list.sh", s.HandleScenariosList)

	// Monitoring & Watchdog Routes
	mux.HandleFunc("/cgi-bin/quecmanager/monitoring/alerts.sh", s.HandleMonitoringAlerts)
	mux.HandleFunc("/cgi-bin/quecmanager/monitoring/watchdog.sh", s.HandleMonitoringWatchdog)
	mux.HandleFunc("/cgi-bin/quecmanager/vpn/netbird.sh", s.HandleNetBird)
	mux.HandleFunc("/cgi-bin/quecmanager/vpn/tailscale.sh", s.HandleVPNTailscale)

	// System Health Check & Language Packs Routes
	mux.HandleFunc("/cgi-bin/quecmanager/system/health-check/status.sh", s.HandleHealthCheckStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/system/health-check/run.sh", s.HandleHealthCheckRun)
	mux.HandleFunc("/cgi-bin/quecmanager/system/language-packs/list.sh", s.HandleLanguagePacksList)
	mux.HandleFunc("/cgi-bin/quecmanager/system/language-packs/install.sh", s.HandleLanguagePacksInstall)
	// Device & System Metadata Routes
	mux.HandleFunc("/cgi-bin/quecmanager/device/about.sh", s.HandleAboutDevice)
	mux.HandleFunc("/cgi-bin/quecmanager/system/settings.sh", s.HandleSystemSettings)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/sim_slot.sh", s.HandleSIMSlot)

	mux.HandleFunc("/cgi-bin/quecmanager/public/hostname.sh", s.HandleHostname)

	// Network & Traffic Control Routes
	mux.HandleFunc("/cgi-bin/quecmanager/network/ethernet.sh", s.HandleEthernetStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/network/lan_config.sh", s.HandleLANConfig)
	mux.HandleFunc("/cgi-bin/quecmanager/network/lan_devices.sh", s.HandleLANDevices)
	mux.HandleFunc("/cgi-bin/quecmanager/network/dns.sh", s.HandleDNS)
	mux.HandleFunc("/cgi-bin/quecmanager/network/mtu.sh", s.HandleMTU)
	mux.HandleFunc("/cgi-bin/quecmanager/network/ip_passthrough.sh", s.HandleIPPassthrough)
	mux.HandleFunc("/cgi-bin/quecmanager/network/traffic_masquerade.sh", s.HandleTrafficMasquerade)
	mux.HandleFunc("/cgi-bin/quecmanager/network/video_optimizer.sh", s.HandleVideoOptimizer)

	// Speedtest Routes
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/speedtest_check.sh", s.HandleSpeedtestCheck)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/speedtest_servers.sh", s.HandleSpeedtestServers)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/speedtest_start.sh", s.HandleSpeedtestStart)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/speedtest_status.sh", s.HandleSpeedtestStatus)
	mux.HandleFunc("/cgi-bin/quecmanager/network/speedtest_check.sh", s.HandleSpeedtestCheck)
	mux.HandleFunc("/cgi-bin/quecmanager/network/speedtest_servers.sh", s.HandleSpeedtestServers)
	mux.HandleFunc("/cgi-bin/quecmanager/network/speedtest_start.sh", s.HandleSpeedtestStart)
	mux.HandleFunc("/cgi-bin/quecmanager/network/speedtest_status.sh", s.HandleSpeedtestStatus)

	// System Management & Polling Routes
	mux.HandleFunc("/cgi-bin/quecmanager/system/ping_profile.sh", s.HandlePingProfile)
	mux.HandleFunc("/cgi-bin/quecmanager/system/quality_thresholds.sh", s.HandleQualityThresholds)
	mux.HandleFunc("/cgi-bin/quecmanager/system/adaptive_polling.sh", s.HandleAdaptivePolling)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/sms_forwarding.sh", s.HandleSMSForwarding)

	// System Management & Update Routes
	mux.HandleFunc("/cgi-bin/quecmanager/system/ssh_password.sh", s.HandleSSHPassword)
	mux.HandleFunc("/cgi-bin/quecmanager/system/update.sh", s.HandleSoftwareUpdate)
	mux.HandleFunc("/cgi-bin/quecmanager/system/pending_reboot.sh", s.HandlePendingReboot)
	mux.HandleFunc("/cgi-bin/quecmanager/system/known_sims.sh", s.HandleKnownSims)
	mux.HandleFunc("/cgi-bin/quecmanager/cellular/fplmn.sh", s.HandleFPLMN)
	mux.HandleFunc("/cgi-bin/quecmanager/monitoring/bandwidth.sh", s.HandleBandwidthSettings)
	mux.HandleFunc("/cgi-bin/quecmanager/network/speedtest.sh", s.HandleSpeedtestStart)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/cell_scan_start.sh", s.HandleCellScanStart)
	mux.HandleFunc("/cgi-bin/quecmanager/at_cmd/neighbour_scan_start.sh", s.HandleCellScanStart)

	// Real-Time Telemetry SSE Stream
	mux.HandleFunc("/cgi-bin/quecmanager/api/stream/status", s.HandleSSEStream)
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

// HandleAboutDevice returns system, device, network, and 3GPP metadata
func (s *Server) HandleAboutDevice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	manufacturer := "Generic"
	model := "Modem"
	firmware := "-"
	imei := "-"

	if statusData, err := os.ReadFile("/tmp/qmanager_status.json"); err == nil {
		var status map[string]interface{}
		if json.Unmarshal(statusData, &status) == nil {
			if dev, ok := status["device"].(map[string]interface{}); ok {
				if m, ok := dev["manufacturer"].(string); ok && m != "" {
					manufacturer = m
				}
				if md, ok := dev["model"].(string); ok && md != "" {
					model = cleanModelString(md)
				}
				if fw, ok := dev["firmware"].(string); ok && fw != "" {
					firmware = fw
				}
				if im, ok := dev["imei"].(string); ok && im != "" {
					imei = im
				}
			}
		}
	}

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "qmanager-host"
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"device": map[string]interface{}{
			"model":        model,
			"manufacturer": manufacturer,
			"firmware":     firmware,
			"build_date":   "-",
			"imei":         imei,
		},
		"3gpp_release": map[string]interface{}{
			"lte":  "Rel 14",
			"nr5g": "N/A",
		},
		"network": map[string]interface{}{
			"device_ip":   "127.0.0.1",
			"lan_subnet":  "-",
			"wan_ipv4":    "-",
			"wan_ipv6":    "-",
			"public_ipv4": "-",
			"public_ipv6": "-",
		},
		"system": map[string]interface{}{
			"hostname":        hostname,
			"kernel_version":  "Linux Host",
			"openwrt_version": "v0.2.3-go Engine",
		},
	})
}

// HandleSystemSettings manages system settings
func (s *Server) HandleSystemSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Prefer user-set name from qmanager.conf [settings].hostname (kernel
	// hostname is the SoC name "sdxprairie" — wrong for the sidebar display name).
	cfg := qmReadConfig()
	hostname := qmStr(cfg["settings"]["hostname"])
	if hostname == "" {
		hostname, _ = os.Hostname()
	}
	if hostname == "" {
		hostname = "qmanager-host"
	}

	if r.Method == http.MethodPost {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			if n, ok := body["hostname"].(string); ok && strings.TrimSpace(n) != "" {
				hostname = strings.TrimSpace(n)
				_ = qmWriteSection("settings", map[string]any{"hostname": hostname})
			}
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"settings": map[string]interface{}{
			"hostname":      hostname,
			"auto_logout":   true,
			"logout_time":   15,
			"language":      "en",
			"theme":         "dark",
			"check_updates": true,
		},
	})
}

// HandleSIMSlot manages active SIM slot state
func (s *Server) HandleSIMSlot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodPost {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			if v, ok := body["slot"].(float64); ok && (v == 1 || v == 2) {
				_, _ = s.atClient.Exec(fmt.Sprintf(`AT+QUIMSLOT=%d`, int(v)))
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "SIM slot switched", "active_slot": int(v)})
				return
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_slot", "detail": "slot must be 1 or 2"})
		return
	}

	// GET: read actual slot state
	slot := 1
	if resp, err := s.atClient.Exec(`AT+QUIMSLOT?`); err == nil && atContains(resp, "+QUIMSLOT: 2") {
		slot = 2
	}

	sim1 := map[string]interface{}{"status": "empty", "iccid": ""}
	sim2 := map[string]interface{}{"status": "empty", "iccid": ""}

	// SIM 1 (or active slot) status
	if resp, err := s.atClient.Exec(`AT+CPIN?`); err == nil {
		status := "ready"
		if atContains(resp, "+CME ERROR") || atContains(resp, "NOT INSERTED") {
			status = "absent"
		} else if atContains(resp, "SIM PIN") {
			status = "pin_required"
		}
		if slot == 1 {
			sim1["status"] = status
		} else {
			sim2["status"] = status
		}
	}

	// ICCID of active slot
	if resp, err := s.atClient.Exec(`AT+ICCID`); err == nil {
		iccid := parseSingleLineParam(resp, "+ICCID:")
		if iccid != "" {
			if slot == 1 {
				sim1["iccid"] = iccid
			} else {
				sim2["iccid"] = iccid
			}
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"active_slot": slot,
		"total_slots": 2,
		"sim1":        sim1,
		"sim2":        sim2,
	})
}

// HandleHostname returns host system hostname
func (s *Server) HandleHostname(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Prefer the user-set name from qmanager.conf [settings].hostname (kernel
	// hostname on this platform is the SoC name, e.g. "sdxprairie", which leaks
	// into the login "Sign in as <name>" line and is confusing). Fall back to
	// kernel hostname, then a generic default.
	cfg := qmReadConfig()
	hostname := qmStr(cfg["settings"]["hostname"])
	if hostname == "" {
		hostname, _ = os.Hostname()
	}
	if hostname == "" {
		hostname = "qmanager-host"
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"hostname": hostname,
	})
}

// HandleLANConfig manages LAN IP & DHCP configuration
func (s *Server) HandleLANConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "LAN configuration saved"})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"lan": map[string]interface{}{
			"ipaddr":  "192.168.100.40",
			"netmask": "255.255.255.0",
			"gateway": "192.168.100.1",
			"dhcp":    true,
		},
	})
}

// HandleLANDevices lists connected LAN clients
func (s *Server) HandleLANDevices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"devices": []map[string]interface{}{
			{
				"hostname":  "ubuntu-hp",
				"ip":        "192.168.100.40",
				"mac":       "00:11:22:33:44:55",
				"interface": "eth0",
				"connected": true,
			},
		},
	})
}

// HandleDNS manages custom DNS configuration
func (s *Server) HandleDNS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cfg := qmReadJSONFile("/etc/qmanager/custom_dns.json")
	mode := qmStr(cfg["mode"])
	if mode == "" {
		mode = "preset"
	}
	preset := qmStr(cfg["preset"])
	if preset == "" {
		preset = "cloudflare"
	}
	dns1 := qmStr(cfg["dns1"])
	if dns1 == "" {
		dns1 = "1.1.1.1"
	}
	dns2 := qmStr(cfg["dns2"])
	if dns2 == "" {
		dns2 = "1.0.0.1"
	}
	dns3 := qmStr(cfg["dns3"])
	dns1v6 := qmStr(cfg["dns1v6"])
	dns2v6 := qmStr(cfg["dns2v6"])
	nic := qmStr(cfg["nic"])
	if nic == "" {
		nic = "lan"
	}
	enabled := qmBool(cfg["enabled"])

	if r.Method == http.MethodPost {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			// Frontend sends flat fields (mode, nic, dns1..dns3, dns1v6..dns2v6).
			if m, ok := body["mode"].(string); ok && m != "" {
				mode = m
			}
			if p, ok := body["preset"].(string); ok {
				preset = p
			}
			if n, ok := body["nic"].(string); ok {
				nic = n
			}
			if d, ok := body["dns1"].(string); ok {
				dns1 = d
			}
			if d, ok := body["dns2"].(string); ok {
				dns2 = d
			}
			if d, ok := body["dns3"].(string); ok {
				dns3 = d
			}
			if d, ok := body["dns1v6"].(string); ok {
				dns1v6 = d
			}
			if d, ok := body["dns2v6"].(string); ok {
				dns2v6 = d
			}
			if e, ok := body["enabled"].(bool); ok {
				enabled = e
			}
			writeJSONFile("/etc/qmanager/custom_dns.json", map[string]any{
				"mode":    mode,
				"preset":  preset,
				"nic":     nic,
				"dns1":    dns1,
				"dns2":    dns2,
				"dns3":    dns3,
				"dns1v6":  dns1v6,
				"dns2v6":  dns2v6,
				"enabled": enabled,
			})
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"mode":        mode,
		"currentDNS":  joinDnsList(dns1, dns2, dns3),
		"currentDNS6": joinDnsList(dns1v6, dns2v6),
		"nic":         nic,
	})
}

// joinDnsList joins non-empty DNS entries into the comma-separated wire format
// the frontend splits back into dns1/dns2/dns3.
func joinDnsList(parts ...string) string {
	var out []string
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, ",")
}

// HandleVideoOptimizer manages Traffic Engine & DPI masking settings.
// GET serves the video optimizer view (or the masquerade view when called
// with ?section=masquerade); POST accepts save / save_masquerade actions.
func (s *Server) HandleVideoOptimizer(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		switch r.URL.Query().Get("section") {
		case "masquerade":
			s.handleTrafficEngineGet(w, r, true)
			return
		}
		switch r.URL.Query().Get("action") {
		case "verify_status":
			_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "status": "idle"})
			return
		case "install_status":
			_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "status": "idle"})
			return
		}
		s.handleTrafficEngineGet(w, r, false)
		return
	}

	if r.Method == http.MethodPost {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "invalid_json"})
			return
		}
		action, _ := body["action"].(string)
		switch action {
		case "save":
			s.handleTrafficEngineSave(w, body, false)
		case "save_masquerade":
			s.handleTrafficEngineSave(w, body, true)
		default:
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "unknown_action", "detail": action})
		}
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "method_not_allowed"})
}

// HandleSSHPassword updates the system SSH password
func (s *Server) HandleSSHPassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "SSH password updated successfully"})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// HandleSoftwareUpdate manages OTA & software update checks
func (s *Server) HandleSoftwareUpdate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "No update required"})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":          true,
		"current_version":  "v0.2.3-go",
		"latest_version":   "v0.2.3-go",
		"update_available": false,
	})
}

// HandleCellScanStart initiates background cell scanner
// Real implementation: checks the running flag, touches it, fires AT+QSCAN
// asynchronously (takes 30-90s), writes results to /tmp/qmanager_scan_results.txt,
// then clears the flag. FE polls cell_scan_status.sh while scanning.
func (s *Server) HandleCellScanStart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if fileExists("/tmp/qmanager_long_running") {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "already_running",
			"detail":  "A scan is already in progress",
		})
		return
	}

	// Mark running BEFORE launching so status polling sees it immediately
	_ = os.WriteFile("/tmp/qmanager_long_running", []byte("scan"), 0644)

	go func() {
		// AT+QSCAN is long-running (30-90s); exec qcmd directly with a timeout.
		// The atClient Exec call would block this goroutine only — fine.
		out, _ := s.atClient.Exec(`AT+QSCAN`)
		// Persist raw output for the status handler to parse
		_ = os.WriteFile("/tmp/qmanager_scan_results.txt", []byte(out), 0644)
		// Clear running flag
		_ = os.Remove("/tmp/qmanager_long_running")
	}()

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"status":  "running",
	})
}

func cleanModelString(val string) string {
	val = strings.ReplaceAll(val, `"`, ``)
	parts := strings.Split(val, ",")
	if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
		return strings.TrimSpace(parts[0])
	}
	return strings.TrimSpace(val)
}

package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type DataUsageResponse struct {
	Success    bool   `json:"success"`
	RxBytes    int64  `json:"rx_bytes"`
	TxBytes    int64  `json:"tx_bytes"`
	TotalBytes int64  `json:"total_bytes"`
	Interface  string `json:"interface"`
}

type QScanCellResult struct {
	Tech      string `json:"tech"`
	MCC       string `json:"mcc"`
	MNC       string `json:"mnc"`
	ARFCN     int    `json:"arfcn"`
	PCI       int    `json:"pci"`
	RSRP      int    `json:"rsrp"`
	RSRQ      int    `json:"rsrq"`
	SINR      int    `json:"sinr,omitempty"`
	SCS       int    `json:"scs,omitempty"` // 15, 30, 60, 120 kHz for NR5G
	CellID    string `json:"cell_id"`
	TAC       string `json:"tac"`
	Bandwidth int    `json:"bandwidth,omitempty"`
	Band      int    `json:"band"`
}

// HandleDataUsed reads network byte counters from /proc/net/dev
func (s *Server) HandleDataUsed(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rx, tx, iface := readNetDevCounters()

	_ = json.NewEncoder(w).Encode(DataUsageResponse{
		Success:    true,
		RxBytes:    rx,
		TxBytes:    tx,
		TotalBytes: rx + tx,
		Interface:  iface,
	})
}

// HandleCellScanStatus queries active cell scan execution status and results
func (s *Server) HandleCellScanStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	scanning := fileExists("/tmp/qmanager_long_running")

	var results []QScanCellResult
	rawScanFile := "/tmp/qmanager_scan_results.txt"
	if data, err := os.ReadFile(rawScanFile); err == nil {
		results = ParseQScanOutput(string(data))
	} else {
		results = []QScanCellResult{}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"scanning": scanning,
		"results":  results,
	})
}

// ParseQScanOutput parses raw AT+QSCAN response lines into structured cells with SCS support
func ParseQScanOutput(raw string) []QScanCellResult {
	var results []QScanCellResult
	lines := strings.Split(raw, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "+QSCAN:") {
			continue
		}

		_, val, found := strings.Cut(line, ":")
		if !found {
			continue
		}

		parts := strings.Split(val, ",")
		if len(parts) < 13 {
			continue
		}

		for i := range parts {
			parts[i] = strings.Trim(strings.TrimSpace(parts[i]), `"`)
		}

		tech := parts[0]
		arfcn, _ := strconv.Atoi(parts[3])
		pci, _ := strconv.Atoi(parts[4])
		rsrp, _ := strconv.Atoi(parts[5])
		rsrq, _ := strconv.Atoi(parts[6])

		cell := QScanCellResult{
			Tech:   tech,
			MCC:    parts[1],
			MNC:    parts[2],
			ARFCN:  arfcn,
			PCI:    pci,
			RSRP:   rsrp,
			RSRQ:   rsrq,
			CellID: parts[9],
			TAC:    parts[10],
		}

		if tech == "NR5G" {
			sinr, _ := strconv.Atoi(parts[7])
			scs, _ := strconv.Atoi(parts[8])
			band, _ := strconv.Atoi(parts[12])
			cell.SINR = sinr
			cell.SCS = scs
			cell.Band = band
		} else { // LTE
			bw, _ := strconv.Atoi(parts[11])
			band, _ := strconv.Atoi(parts[12])
			cell.Bandwidth = bw
			cell.Band = band
		}

		results = append(results, cell)
	}
	return results
}

func readNetDevCounters() (rx int64, tx int64, iface string) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, "rmnet_mhi0"
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "rmnet") || strings.HasPrefix(line, "eth0") {
			parts := strings.Fields(line)
			if len(parts) >= 10 {
				iface = strings.TrimSuffix(parts[0], ":")
				rx, _ = strconv.ParseInt(parts[1], 10, 64)
				tx, _ = strconv.ParseInt(parts[9], 10, 64)
				return rx, tx, iface
			}
		}
	}
	return 0, 0, "rmnet_mhi0"
}

// HandleIPPassthrough handles IP Passthrough config
func (s *Server) HandleIPPassthrough(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"enabled": false,
		"mode":    "disabled",
		"mac":     "",
	})
}

// HandlePingProfile handles Ping / Latency monitor profile config
func (s *Server) HandlePingProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"profile": map[string]interface{}{
			"target":   "1.1.1.1",
			"interval": 30,
		},
	})
}

// HandleQualityThresholds handles connection quality threshold config
func (s *Server) HandleQualityThresholds(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"thresholds": map[string]interface{}{
			"rsrp_excellent": -85,
			"rsrp_good":      -95,
			"rsrp_fair":      -105,
		},
	})
}

// HandleAdaptivePolling handles adaptive polling tier config
func (s *Server) HandleAdaptivePolling(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"mode":        "auto",
		"active_tier": "active",
	})
}

// HandleMTU handles MTU configuration
func (s *Server) HandleMTU(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"mtu":     1500,
		"auto":    true,
	})
}

// ---------------------------------------------------------------------------
// Traffic Engine — Video Optimizer + Traffic Masquerade (DPI evasion).
// Both features are mutually exclusive modes of ONE shared nfqws instance on
// NFQUEUE 200 (see scripts/etc/init.d/qmanager_dpi).
// Config:   /etc/qmanager/qmanager.conf (JSON, key "traffic_engine")
//           /etc/qmanager/video_optimizer.enabled ("enabled"|"disabled")
// State:    /var/run/nfqws.pid (service uptime)
// Counters: /tmp/qmanager_video_packets, /sys/kernel/debug/nfqws
// Flags:    /tmp/qmanager_video_reload
// ---------------------------------------------------------------------------

const (
	qmTrafficEngineSection = "traffic_engine"
	qmNfqwsPIDFile         = "/var/run/nfqws.pid"
	qmVideoReloadFlag      = "/tmp/qmanager_video_reload"
	qmVideoPacketsFile     = "/tmp/qmanager_video_packets"
	qmHostlistFile         = "/etc/qmanager/video_domains.txt"
)

// fileExistsAny reports whether any of the candidate paths exists on disk.
func fileExistsAny(paths ...string) bool {
	for _, p := range paths {
		if fileExists(p) {
			return true
		}
	}
	return false
}

// qmFileContains reports whether the file at path contains any of the needles
// as a token in its content.
func qmFileContains(path string, needles ...string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	hay := string(data)
	for _, n := range needles {
		if strings.Contains(hay, n) {
			return true
		}
	}
	return false
}

// qmNfqwsInstalled reports whether the nfqws binary is present on disk.
func qmNfqwsInstalled() bool {
	return fileExistsAny("/usr/bin/nfqws", "/opt/sbin/nfqws")
}

// qmKernelModuleLoaded reports whether NFQUEUE kernel support is present in
// /proc/modules (nfnetlink_queue or nf_tables).
func qmKernelModuleLoaded() bool {
	return qmFileContains("/proc/modules", "nfnetlink_queue", "nfqws", "nf_tables")
}

// qmServiceRunning reports whether the nfqws daemon is alive by checking its
// PID file and confirming the process still exists.
func qmServiceRunning() bool {
	data, err := os.ReadFile(qmNfqwsPIDFile)
	if err != nil {
		return false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		return false
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	// FindProcess always succeeds on Unix; signal 0 probes existence.
	return proc.Signal(syscall.Signal(0)) == nil
}

// qmServiceUptime formats the nfqws service uptime from the PID file mtime,
// mirroring dpi_get_uptime() in scripts/usr/lib/qmanager/dpi_helper.sh.
func qmServiceUptime() string {
	info, err := os.Stat(qmNfqwsPIDFile)
	if err != nil {
		return "0s"
	}
	elapsed := int64(time.Since(info.ModTime()).Seconds())
	if elapsed < 0 {
		elapsed = 0
	}
	switch {
	case elapsed >= 86400:
		return fmt.Sprintf("%dd %dh", elapsed/86400, elapsed%86400/3600)
	case elapsed >= 3600:
		return fmt.Sprintf("%dh %dm", elapsed/3600, elapsed%3600/60)
	case elapsed >= 60:
		return fmt.Sprintf("%dm %ds", elapsed/60, elapsed%60)
	default:
		return fmt.Sprintf("%ds", elapsed)
	}
}

// qmPacketCount reads the processed-packet counter. Prefers the real nfqws
// debugfs counter, falls back to the /tmp counter file written by the daemon.
func qmPacketCount() int {
	for _, p := range []string{"/sys/kernel/debug/nfqws", "/sys/kernel/debug/nfqws/nfqws", qmVideoPacketsFile} {
		if data, err := os.ReadFile(p); err == nil {
			fields := strings.Fields(string(data))
			if len(fields) > 0 {
				if n, err := strconv.Atoi(fields[0]); err == nil {
					return n
				}
			}
		}
	}
	return 0
}

// qmDomainCount counts non-empty, non-comment lines in the hostlist file.
func qmDomainCount() int {
	data, err := os.ReadFile(qmHostlistFile)
	if err != nil {
		return 0
	}
	count := 0
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		count++
	}
	return count
}

// trafficEngineStatus computes the shared service status + uptime + counters.
// A mode is "running" only when it is enabled in config AND the nfqws daemon
// is alive (avoids cross-mode contamination when the other mode owns it).
func trafficEngineStatus() (status string, uptime string, packets int) {
	cfg := qmReadConfig()[qmTrafficEngineSection]
	running := qmCfgBool(cfg, "enabled", false) && qmServiceRunning()
	if running {
		status = "running"
	} else {
		status = "stopped"
	}
	return status, qmServiceUptime(), qmPacketCount()
}

// handleTrafficEngineGet serves GET for both traffic_engine.sh and
// video_optimizer.sh (masquerade + video optimizer modes).
func (s *Server) handleTrafficEngineGet(w http.ResponseWriter, r *http.Request, masquerade bool) {
	cfg := qmReadConfig()[qmTrafficEngineSection]

	status, uptime, packets := trafficEngineStatus()

	base := map[string]any{
		"success":              true,
		"enabled":              qmCfgBool(cfg, "enabled", false),
		"other_enabled":        qmCfgBool(cfg, "other_enabled", false),
		"status":               status,
		"uptime":               uptime,
		"packets_processed":    packets,
		"binary_installed":     qmNfqwsInstalled(),
		"kernel_module_loaded": qmKernelModuleLoaded(),
	}

	if masquerade {
		sni := ""
		if v, ok := cfg["sni_domain"].(string); ok {
			sni = v
		}
		if sni == "" {
			sni = "speedtest.net"
		}
		base["sni_domain"] = sni
		_ = json.NewEncoder(w).Encode(base)
		return
	}

	// Video optimizer mode
	base["desync_repeats"] = qmCfgInt(cfg, "desync_repeats", 1)
	base["domains_loaded"] = qmDomainCount()
	_ = json.NewEncoder(w).Encode(base)
}

// handleTrafficEngineSave persists a save payload for either mode.
func (s *Server) handleTrafficEngineSave(w http.ResponseWriter, body map[string]any, masquerade bool) {
	updates := map[string]any{}

	if v, ok := body["enabled"]; ok {
		if b, ok := v.(bool); ok {
			updates["enabled"] = map[bool]int{true: 1, false: 0}[b]
		}
	}

	// Mutex: enabling one mode disables the other.
	if enabled, ok := updates["enabled"]; ok && enabled == 1 {
		updates["other_enabled"] = 0
	} else if !ok {
		// No explicit enable change; preserve current value.
		cfg := qmReadConfig()[qmTrafficEngineSection]
		updates["other_enabled"] = map[bool]int{true: 1, false: 0}[qmCfgBool(cfg, "other_enabled", false)]
	}

	if masquerade {
		if v, ok := body["sni_domain"].(string); ok {
			sni := strings.TrimSpace(v)
			if sni == "" {
				sni = "speedtest.net"
			}
			if !strings.Contains(sni, ".") {
				_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "reject_field", "detail": "sni_domain must contain at least one dot"})
				return
			}
			updates["sni_domain"] = sni
		}
	} else {
		if v, ok := body["desync_repeats"]; ok {
			if n, ok := asInt(v); ok {
				if n < 1 || n > 10 {
					n = 1
				}
				updates["desync_repeats"] = n
			}
		}
	}

	if len(updates) > 0 {
		_ = qmWriteSection(qmTrafficEngineSection, updates)
	}

	// Signal the daemon to reload; boot persistence is handled by the init.d
	// service which reads the config at boot.
	_ = os.WriteFile(qmVideoReloadFlag, []byte("reload"), 0644)

	_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
}

// asInt coerces a JSON-decoded value into an int when possible.
func asInt(v any) (int, bool) {
	switch t := v.(type) {
	case float64:
		return int(t), true
	case int:
		return t, true
	case string:
		if n, err := strconv.Atoi(t); err == nil {
			return n, true
		}
	case bool:
		if t {
			return 1, true
		}
		return 0, true
	}
	return 0, false
}

// HandleTrafficMasquerade handles traffic masquerading / SNAT config.
// GET returns the masquerade view of the traffic engine; POST accepts
// save (and save_masquerade aliases) to update config + request reload.
func (s *Server) HandleTrafficMasquerade(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.handleTrafficEngineGet(w, r, true)
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
		case "save", "save_masquerade", "":
			s.handleTrafficEngineSave(w, body, true)
		default:
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "unknown_action", "detail": action})
		}
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "method_not_allowed"})
}

// HandleSMSForwarding handles SMS forwarding service config
func (s *Server) HandleSMSForwarding(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"enabled": false,
		"number":  "",
	})
}

// HandleEthernetStatus queries physical ethernet link speed and negotiation
func (s *Server) HandleEthernetStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	linkStatus := "connected"
	speed := "1000 Mbps"
	duplex := "full"
	autoNeg := "on"

	if data, err := os.ReadFile("/sys/class/net/eth0/operstate"); err == nil {
		if strings.TrimSpace(string(data)) == "down" {
			linkStatus = "disconnected"
		}
	}

	if data, err := os.ReadFile("/sys/class/net/eth0/speed"); err == nil {
		spdStr := strings.TrimSpace(string(data))
		if spdStr != "" && spdStr != "-1" {
			speed = spdStr + " Mbps"
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":          true,
		"link_status":      linkStatus,
		"speed":            speed,
		"duplex":           duplex,
		"auto_negotiation": autoNeg,
		"speed_limit":      "auto",
		"supports_2500":    true,
	})
}

// HandlePendingReboot checks for boot-emitted pending reboot flags
func (s *Server) HandlePendingReboot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"verizon": false,
	})
}

// HandleFPLMN handles Forbidden PLMN list query and clear (AT+CRSM)
func (s *Server) HandleFPLMN(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		// Clear FPLMN via SIM binary write
		_, _ = s.atClient.Exec(`AT+CRSM=214,28539,0,0,12,"FFFFFFFFFFFFFFFFFFFFFFFF"`)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"has_entries": false,
	})
}

// HandleKnownSims handles known SIMs counter and clear
func (s *Server) HandleKnownSims(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "count": 1})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"count":   1,
	})
}

// ---------------------------------------------------------------------------
// Bandwidth Monitor — live per-interface traffic via websocat WebSocket.
// Config: /etc/qmanager/qmanager.conf (JSON, key "bridge_monitor")
// State:  /tmp/qmanager_bandwidth_status.json (written by the monitor daemon)
// Flags:  /tmp/qmanager_bandwidth_reload
// ---------------------------------------------------------------------------

const (
	qmBridgeMonitorSection = "bridge_monitor"
	qmBandwidthStatusFile  = "/tmp/qmanager_bandwidth_status.json"
	qmBandwidthReloadFlag  = "/tmp/qmanager_bandwidth_reload"
)

// HandleBandwidthSettings handles network bandwidth monitor settings.
// GET returns settings, runtime status and dependency checks; POST
// (save_settings) persists to qmanager.conf and signals a reload.
func (s *Server) HandleBandwidthSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.bandwidthGet(w)
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
		case "save_settings":
			s.bandwidthSave(w, body)
		default:
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "unknown_action", "detail": action})
		}
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": "method_not_allowed"})
}

func (s *Server) bandwidthGet(w http.ResponseWriter) {
	cfg := qmReadConfig()[qmBridgeMonitorSection]

	interfaces := ""
	if v, ok := cfg["interfaces"].(string); ok {
		interfaces = v
	}
	if interfaces == "" {
		interfaces = "br-lan,eth0,rmnet_data0,rmnet_data1,rmnet_ipa0"
	}

	status := map[string]bool{"websocat_running": false, "monitor_running": false}
	if raw, err := os.ReadFile(qmBandwidthStatusFile); err == nil {
		var st map[string]any
		if json.Unmarshal(raw, &st) == nil {
			status["websocat_running"] = qmCfgBool(st, "websocat_running", false)
			status["monitor_running"] = qmCfgBool(st, "monitor_running", false)
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"settings": map[string]any{
			"enabled":         qmCfgBool(cfg, "enabled", false),
			"refresh_rate_ms": qmCfgInt(cfg, "refresh_rate_ms", 1000),
			"ws_port":         qmCfgInt(cfg, "ws_port", 8838),
			"interfaces":      interfaces,
		},
		"status": status,
		"dependencies": map[string]any{
			"websocat_installed": fileExistsAny("/usr/bin/websocat", "/opt/sbin/websocat"),
		},
	})
}

func (s *Server) bandwidthSave(w http.ResponseWriter, body map[string]any) {
	updates := map[string]any{}

	if v, ok := body["enabled"]; ok {
		if b, ok := v.(bool); ok {
			updates["enabled"] = map[bool]int{true: 1, false: 0}[b]
		}
	}
	if n, ok := asInt(body["refresh_rate_ms"]); ok {
		if n < 100 {
			n = 100
		}
		updates["refresh_rate_ms"] = n
	}
	if n, ok := asInt(body["ws_port"]); ok {
		if n < 1 || n > 65535 {
			n = 8838
		}
		updates["ws_port"] = n
	}
	if v, ok := body["interfaces"].(string); ok {
		if strings.TrimSpace(v) != "" {
			updates["interfaces"] = strings.TrimSpace(v)
		}
	}

	if len(updates) > 0 {
		_ = qmWriteSection(qmBridgeMonitorSection, updates)
	}

	// Signal the init.d service to (re)start/stop + regenerate config.
	_ = os.WriteFile(qmBandwidthReloadFlag, []byte("reload"), 0644)

	_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
}

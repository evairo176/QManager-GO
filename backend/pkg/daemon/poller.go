package daemon

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"qmanager-backend/pkg/at"
)

type Poller struct {
	atClient    at.Executor
	interval    time.Duration
	stopChan    chan struct{}
	lastCpuSys  uint64
	lastCpuIdle uint64
	mu          sync.Mutex
}

func NewPoller(atClient at.Executor, interval time.Duration) *Poller {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &Poller{
		atClient: atClient,
		interval: interval,
		stopChan: make(chan struct{}),
	}
}

// Start runs background polling loop in a goroutine
func (p *Poller) Start() {
	go func() {
		ticker := time.NewTicker(p.interval)
		defer ticker.Stop()

		// Run immediate poll on start
		p.pollOnce()

		for {
			select {
			case <-ticker.C:
				p.pollOnce()
			case <-p.stopChan:
				return
			}
		}
	}()
}

func (p *Poller) Stop() {
	close(p.stopChan)
}

func (p *Poller) pollOnce() {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now().Unix()
	modemReachable := false

	// 1. Basic AT Reachability & Vendor Identification
	manufacturer := "Generic"
	model := "Modem"
	firmware := ""

	if resp, err := p.atClient.Exec("ATI"); err == nil && !strings.Contains(resp, "ERROR") {
		modemReachable = true
		atiMfg, atiModel, atiFw := parseATIResponse(resp)
		if atiMfg != "" {
			manufacturer = atiMfg
		}
		if atiModel != "" {
			model = atiModel
		}
		if atiFw != "" {
			firmware = atiFw
		}
	}

	imei := ""

	if resp, err := p.atClient.Exec("AT+CGMI"); err == nil && !strings.Contains(resp, "ERROR") {
		modemReachable = true
		if m := parseSingleLineParam(resp, "+CGMI:"); m != "" {
			manufacturer = cleanModelName(m)
		}
	}

	if resp, err := p.atClient.Exec("AT+GMM"); err == nil && !strings.Contains(resp, "ERROR") {
		modemReachable = true
		if m := parseSingleLineParam(resp, "+GMM:"); m != "" {
			model = cleanModelName(m)
		}
	} else if resp, err := p.atClient.Exec("AT+CGMM"); err == nil && !strings.Contains(resp, "ERROR") {
		modemReachable = true
		if m := parseSingleLineParam(resp, "+CGMM:"); m != "" {
			model = cleanModelName(m)
		}
	}

	if resp, err := p.atClient.Exec("AT+GSN"); err == nil && !strings.Contains(resp, "ERROR") {
		modemReachable = true
		imei = parseIMEIResponse(resp)
	} else if resp, err := p.atClient.Exec("AT+CGSN"); err == nil && !strings.Contains(resp, "ERROR") {
		modemReachable = true
		imei = parseIMEIResponse(resp)
	}

	iccid := ""
	if resp, err := p.atClient.Exec("AT+QCCID"); err == nil && !strings.Contains(resp, "ERROR") {
		if val := parseSingleLineParam(resp, "+QCCID:"); val != "" {
			iccid = val
		}
	}

	imsi := ""
	if resp, err := p.atClient.Exec("AT+CIMI"); err == nil && !strings.Contains(resp, "ERROR") {
		lines := strings.Split(resp, "\n")
		for _, l := range lines {
			l = strings.TrimSpace(l)
			l = strings.Trim(l, `"`)
			if len(l) >= 14 && len(l) <= 16 && isDigits(l) {
				imsi = l
				break
			}
		}
	}

	wanIp := ""
	if resp, err := p.atClient.Exec("AT+CGPADDR=1"); err == nil && !strings.Contains(resp, "ERROR") {
		if val := parseSingleLineParam(resp, "+CGPADDR:"); val != "" {
			parts := strings.Split(val, ",")
			if len(parts) >= 2 {
				wanIp = strings.Trim(strings.TrimSpace(parts[1]), `"`)
			} else if len(parts) == 1 {
				wanIp = strings.Trim(strings.TrimSpace(parts[0]), `"`)
			}
		}
	}

	// Default Fallback Signals & Metrics
	carrier := ""
	if copsResp, err := p.atClient.Exec("AT+COPS?"); err == nil && !strings.Contains(copsResp, "ERROR") {
		cName, _ := parseCOPS(copsResp)
		if cName != "" {
			carrier = cName
		}
	}
	netType := "LTE"
	serviceStatus := "unknown"
	simSlot := 1

	var (
		rssi, rsrp, rsrq, sinr, pci, earfcn, tac, cellId, bandwidth *int
		nrRsrp, nrRsrq, nrSinr, nrPci, nrArfcn                      *int
		lteBand, nrBand                                             string
	)

	// 2. Try Quectel Extended Command (AT+QENG="servingcell")
	qengResp, qengErr := p.atClient.Exec(`AT+QENG="servingcell"`)
	isQuectel := qengErr == nil && strings.Contains(qengResp, "+QENG: \"servingcell\"")

	if isQuectel {
		modemReachable = true
		// Parse Quectel Extended Serving Cell
		parseQuectelQENG(qengResp, &netType, &serviceStatus, &carrier, &lteBand, &earfcn, &pci, &rsrp, &rsrq, &rssi, &sinr, &nrBand, &nrArfcn, &nrPci, &nrRsrp, &nrRsrq, &nrSinr)
	} else {
		// 3. Fallback to 3GPP Standard Commands (Fibocom L850-GL, Sierra, Huawei, etc.)
		if csqResp, err := p.atClient.Exec("AT+CSQ"); err == nil && !strings.Contains(csqResp, "ERROR") {
			modemReachable = true
			if rssiVal := parseCSQ(csqResp); rssiVal != nil {
				rssi = rssiVal
			}
		}

		if cesqResp, err := p.atClient.Exec("AT+CESQ"); err == nil && !strings.Contains(cesqResp, "ERROR") {
			modemReachable = true
			parsedRsrp, parsedRsrq := parseCESQ(cesqResp)
			if parsedRsrp != nil {
				rsrp = parsedRsrp
			}
			if parsedRsrq != nil {
				rsrq = parsedRsrq
			}
		}

		if copsResp, err := p.atClient.Exec("AT+COPS?"); err == nil && !strings.Contains(copsResp, "ERROR") {
			modemReachable = true
			cName, cType := parseCOPS(copsResp)
			if cName != "" {
				carrier = cName
				serviceStatus = "valid"
			}
			if cType != "" {
				netType = cType
			}
		}
	}

	// System Performance & Hardware Metrics
	cpuUsage := p.getSystemCpuUsage()
	memUsedMb, memTotalMb := getSystemMemoryMb()
	uptimeSec := getSystemUptimeSec()

	var temp *int
	if resp, err := p.atClient.Exec("AT+QTEMP"); err == nil && !strings.Contains(resp, "ERROR") {
		temp = parseQTEMPResponse(resp)
	}
	if temp == nil {
		temp = getSystemTemperature()
	}

	status := map[string]interface{}{
		"timestamp":            now,
		"system_state":         "ready",
		"modem_reachable":      modemReachable,
		"last_successful_poll": now,
		"errors":               []string{},
		"network": map[string]interface{}{
			"type":           netType,
			"sim_slot":       simSlot,
			"carrier":        carrier,
			"service_status": serviceStatus,
			"wan_ipv4":       wanIp,
			"ca_active":      false,
			"ca_count":       0,
		},
		"lte": map[string]interface{}{
			"state":     "active",
			"band":      lteBand,
			"earfcn":    earfcn,
			"bandwidth": bandwidth,
			"pci":       pci,
			"cell_id":   cellId,
			"tac":       tac,
			"rsrp":      rsrp,
			"rsrq":      rsrq,
			"sinr":      sinr,
			"rssi":      rssi,
		},
		"nr": map[string]interface{}{
			"state": "unknown",
			"band":  nrBand,
			"arfcn": nrArfcn,
			"pci":   nrPci,
			"rsrp":  nrRsrp,
			"rsrq":  nrRsrq,
			"sinr":  nrSinr,
		},
		"device": map[string]interface{}{
			"poller_tier":              "active",
			"temperature":              temp,
			"cpu_usage":                cpuUsage,
			"memory_used_mb":           memUsedMb,
			"memory_total_mb":          memTotalMb,
			"uptime_seconds":           uptimeSec,
			"firmware":                 firmware,
			"manufacturer":             manufacturer,
			"model":                    model,
			"imei":                     imei,
			"iccid":                    iccid,
			"imsi":                     imsi,
			"phone_number":             "",
			"lte_category":             "Cat-20",
			"mimo":                     "4x4",
			"supported_lte_bands":      "1:3:5:7:8:20:28:38:40:41:42:43",
			"supported_nsa_nr5g_bands": "1:3:5:7:8:20:28:38:40:41:77:78:79",
			"supported_sa_nr5g_bands":  "1:3:5:7:8:20:28:38:40:41:77:78:79",
			"supported_nrdc_nr5g_bands": "41:77:78:79",
		},
		"connectivity": map[string]interface{}{
			"online":             true,
			"latency_ms":         15,
			"packet_loss_pct":    0,
			"last_success_epoch": now,
		},
	}

	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return
	}

	tmpDir := os.TempDir()
	if _, err := os.Stat("/tmp"); err == nil {
		tmpDir = "/tmp"
	}

	tmpFile := filepath.Join(tmpDir, "qmanager_status.json.tmp")
	targetFile := filepath.Join(tmpDir, "qmanager_status.json")

	if err := os.WriteFile(tmpFile, data, 0644); err == nil {
		_ = os.Rename(tmpFile, targetFile)
	} else {
		log.Printf("[Poller] Warning: Failed to write cache file: %v", err)
	}
}

func parseSingleLineParam(resp, prefix string) string {
	for _, line := range strings.Split(resp, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, prefix) {
			val := strings.TrimPrefix(line, prefix)
			val = strings.TrimSpace(val)
			val = strings.Trim(val, `"`)
			return val
		}
	}
	return ""
}

func parseATIResponse(resp string) (manufacturer string, model string, firmware string) {
	lines := strings.Split(resp, "\n")
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" || line == "OK" || strings.HasPrefix(line, "AT") {
			continue
		}
		if strings.EqualFold(line, "Quectel") || strings.EqualFold(line, "Sierra Wireless") || strings.EqualFold(line, "Fibocom") {
			manufacturer = line
		} else if strings.Contains(line, "Revision:") || strings.Contains(line, "Firmware:") || strings.Contains(line, "Built@") {
			firmware = line
		} else if len(line) >= 3 && len(line) <= 25 && model == "" {
			model = line
		}
	}
	return manufacturer, model, firmware
}

func parseCSQ(resp string) *int {
	// +CSQ: 18,99
	for _, line := range strings.Split(resp, "\n") {
		if strings.Contains(line, "+CSQ:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				valParts := strings.Split(strings.TrimSpace(parts[1]), ",")
				if len(valParts) >= 1 {
					if csq, err := strconv.Atoi(strings.TrimSpace(valParts[0])); err == nil {
						if csq >= 0 && csq <= 31 {
							dbm := -113 + (csq * 2)
							return &dbm
						}
					}
				}
			}
		}
	}
	return nil
}

func parseCESQ(resp string) (*int, *int) {
	// +CESQ: <rxlev>,<ber>,<rscp>,<ecno>,<rsrq>,<rsrp>
	for _, line := range strings.Split(resp, "\n") {
		if strings.Contains(line, "+CESQ:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				valParts := strings.Split(strings.TrimSpace(parts[1]), ",")
				if len(valParts) >= 6 {
					var rsrpPtr, rsrqPtr *int
					if rsrqVal, err := strconv.Atoi(strings.TrimSpace(valParts[4])); err == nil && rsrqVal != 255 {
						db := -20 + rsrqVal
						rsrqPtr = &db
					}
					if rsrpVal, err := strconv.Atoi(strings.TrimSpace(valParts[5])); err == nil && rsrpVal != 255 {
						dbm := -140 + rsrpVal
						rsrpPtr = &dbm
					}
					return rsrpPtr, rsrqPtr
				}
			}
		}
	}
	return nil, nil
}

func parseCOPS(resp string) (string, string) {
	// +COPS: 0,0,"Telkomsel",7
	for _, line := range strings.Split(resp, "\n") {
		if strings.Contains(line, "+COPS:") {
			parts := strings.Split(line, ",")
			if len(parts) >= 3 {
				cName := strings.Trim(strings.TrimSpace(parts[2]), `"`)
				cType := "LTE"
				if len(parts) >= 4 {
					actStr := strings.TrimSpace(parts[3])
					switch actStr {
					case "0", "1", "3":
						cType = "3G"
					case "7":
						cType = "LTE"
					case "10", "11", "12", "13":
						cType = "NR5G-SA"
					}
				}
				return cName, cType
			}
		}
	}
	return "", ""
}

func parseQuectelQENG(resp string, netType, serviceStatus, carrier, lteBand *string, earfcn, pci, rsrp, rsrq, rssi, sinr **int, nrBand *string, nrArfcn, nrPci, nrRsrp, nrRsrq, nrSinr **int) {
	for _, line := range strings.Split(resp, "\n") {
		line = strings.TrimSpace(line)
		if !strings.Contains(line, `+QENG:`) {
			continue
		}
		parts := strings.Split(line, ",")
		if len(parts) < 3 {
			continue
		}

		if strings.Contains(line, `+QENG: "servingcell"`) && len(parts) >= 3 {
			*serviceStatus = strings.Trim(parts[1], `"`)
			rat := strings.Trim(parts[2], `"`)

			if rat == "NR5G-SA" {
				*netType = "NR5G-SA"
				if len(parts) >= 14 {
					if val, err := strconv.Atoi(parts[7]); err == nil {
						*nrArfcn = &val
					}
					if val, err := strconv.Atoi(parts[8]); err == nil {
						*nrPci = &val
					}
					if bandNum, err := strconv.Atoi(parts[9]); err == nil {
						*nrBand = fmt.Sprintf("N%d", bandNum)
					} else {
						*nrBand = strings.Trim(parts[9], `"`)
					}
					if val, err := strconv.Atoi(parts[11]); err == nil {
						*nrRsrp = &val
					}
					if val, err := strconv.Atoi(parts[12]); err == nil {
						*nrRsrq = &val
					}
					if val, err := strconv.Atoi(parts[13]); err == nil {
						*nrSinr = &val
					}
				}
			} else if rat == "LTE" || strings.Contains(line, `"LTE"`) {
				*netType = "LTE"
				if len(parts) >= 16 {
					if val, err := strconv.Atoi(parts[7]); err == nil {
						*pci = &val
					}
					if val, err := strconv.Atoi(parts[8]); err == nil {
						*earfcn = &val
					}
					if bandNum, err := strconv.Atoi(parts[9]); err == nil {
						*lteBand = fmt.Sprintf("B%d", bandNum)
					} else {
						*lteBand = strings.Trim(parts[9], `"`)
					}
					if val, err := strconv.Atoi(parts[12]); err == nil {
						*rsrp = &val
					}
					if val, err := strconv.Atoi(parts[13]); err == nil {
						*rsrq = &val
					}
					if val, err := strconv.Atoi(parts[14]); err == nil {
						*rssi = &val
					}
					if val, err := strconv.Atoi(parts[15]); err == nil {
						*sinr = &val
					}
				}
			}
		}

		if strings.Contains(line, `+QENG: "LTE"`) && len(parts) >= 15 {
			if *netType == "" || *netType == "unknown" {
				*netType = "LTE"
			}
			if val, err := strconv.Atoi(parts[6]); err == nil {
				*pci = &val
			}
			if val, err := strconv.Atoi(parts[7]); err == nil {
				*earfcn = &val
			}
			if bandNum, err := strconv.Atoi(parts[8]); err == nil {
				*lteBand = fmt.Sprintf("B%d", bandNum)
			}
			if val, err := strconv.Atoi(parts[11]); err == nil {
				*rsrp = &val
			}
			if val, err := strconv.Atoi(parts[12]); err == nil {
				*rsrq = &val
			}
			if val, err := strconv.Atoi(parts[13]); err == nil {
				*rssi = &val
			}
			if val, err := strconv.Atoi(parts[14]); err == nil {
				*sinr = &val
			}
		}

		if strings.Contains(line, `+QENG: "NR5G-NSA"`) && len(parts) >= 10 {
			if *netType != "NR5G-SA" {
				*netType = "NR5G-NSA"
			}
			if val, err := strconv.Atoi(parts[3]); err == nil {
				*nrPci = &val
			}
			if val, err := strconv.Atoi(parts[4]); err == nil {
				*nrRsrp = &val
			}
			if val, err := strconv.Atoi(parts[5]); err == nil {
				*nrSinr = &val
			}
			if val, err := strconv.Atoi(parts[6]); err == nil {
				*nrRsrq = &val
			}
			if val, err := strconv.Atoi(parts[7]); err == nil {
				*nrArfcn = &val
			}
			if bandNum, err := strconv.Atoi(parts[8]); err == nil {
				*nrBand = fmt.Sprintf("N%d", bandNum)
			}
		}
	}
}

func (p *Poller) getSystemCpuUsage() int {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 5
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 5
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return 5
	}

	var user, nice, sys, idle, iowait, irq, softirq uint64
	_, _ = fmt.Sscanf(strings.Join(fields[1:], " "), "%d %d %d %d %d %d %d", &user, &nice, &sys, &idle, &iowait, &irq, &softirq)

	totalSys := user + nice + sys + iowait + irq + softirq
	totalIdle := idle

	deltaSys := totalSys - p.lastCpuSys
	deltaIdle := totalIdle - p.lastCpuIdle

	p.lastCpuSys = totalSys
	p.lastCpuIdle = totalIdle

	if deltaSys+deltaIdle == 0 {
		return 5
	}

	usage := int((deltaSys * 100) / (deltaSys + deltaIdle))
	if usage < 0 {
		return 0
	}
	if usage > 100 {
		return 100
	}
	return usage
}

func getSystemMemoryMb() (int, int) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 512, 2048
	}

	var totalKb, availKb int
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				totalKb, _ = strconv.Atoi(fields[1])
			}
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				availKb, _ = strconv.Atoi(fields[1])
			}
		}
	}

	if totalKb == 0 {
		return 512, 2048
	}

	totalMb := totalKb / 1024
	usedMb := (totalKb - availKb) / 1024
	return usedMb, totalMb
}

func getSystemUptimeSec() int {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 3600
	}
	fields := strings.Fields(string(data))
	if len(fields) > 0 {
		if sec, err := strconv.ParseFloat(fields[0], 64); err == nil {
			return int(sec)
		}
	}
	return 3600
}

func getSystemTemperature() *int {
	paths := []string{
		"/sys/class/thermal/thermal_zone0/temp",
		"/sys/class/hwmon/hwmon0/temp1_input",
	}

	for _, p := range paths {
		if data, err := os.ReadFile(p); err == nil {
			valStr := strings.TrimSpace(string(data))
			if val, err := strconv.Atoi(valStr); err == nil {
				if val > 1000 {
					val = val / 1000 // Convert millidegrees C to degrees C
				}
				return &val
			}
		}
	}

	defaultTemp := 42
	return &defaultTemp
}

func parseQTEMPResponse(resp string) *int {
	if strings.Contains(resp, "ERROR") || !strings.Contains(resp, "+QTEMP:") {
		return nil
	}

	preferredSensors := []string{
		"mdm-core-usr", "mdm-core", "soc-thermal", "qdsp6-thermal",
		"cpu-thermal", "modem-thermal", "xo-thermal", "pa-thermal",
	}

	sensorMap := make(map[string]int)
	var rawNumbers []int

	lines := strings.Split(resp, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "+QTEMP:") {
			valStr := strings.TrimPrefix(line, "+QTEMP:")
			valStr = strings.TrimSpace(valStr)

			parts := strings.Split(valStr, ",")
			if len(parts) >= 2 {
				sName := strings.ToLower(strings.Trim(strings.TrimSpace(parts[0]), `"`))
				sValStr := strings.Trim(strings.TrimSpace(parts[1]), `"`)
				if tVal, err := strconv.Atoi(sValStr); err == nil && tVal > -40 && tVal < 125 {
					sensorMap[sName] = tVal
				}
			} else if len(parts) == 1 {
				sValStr := strings.Trim(strings.TrimSpace(parts[0]), `"`)
				if tVal, err := strconv.Atoi(sValStr); err == nil && tVal > -40 && tVal < 125 {
					rawNumbers = append(rawNumbers, tVal)
				}
			}
			if len(parts) > 2 {
				for _, p := range parts {
					cleanP := strings.Trim(strings.TrimSpace(p), `"`)
					if tVal, err := strconv.Atoi(cleanP); err == nil && tVal > -40 && tVal < 125 {
						rawNumbers = append(rawNumbers, tVal)
					}
				}
			}
		}
	}

	for _, pref := range preferredSensors {
		for sName, val := range sensorMap {
			if strings.Contains(sName, pref) {
				return &val
			}
		}
	}

	for _, val := range sensorMap {
		return &val
	}

	if len(rawNumbers) > 0 {
		sum := 0
		for _, n := range rawNumbers {
			sum += n
		}
		avg := sum / len(rawNumbers)
		return &avg
	}

	return nil
}

func cleanModelName(val string) string {
	val = strings.ReplaceAll(val, `"`, ``)
	parts := strings.Split(val, ",")
	if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
		return strings.TrimSpace(parts[0])
	}
	return strings.TrimSpace(val)
}

func parseIMEIResponse(resp string) string {
	for _, line := range strings.Split(resp, "\n") {
		line = strings.TrimSpace(line)
		line = strings.Trim(line, `"`)
		if len(line) >= 14 && len(line) <= 17 && !strings.HasPrefix(line, "AT") && !strings.HasPrefix(line, "OK") {
			return line
		}
	}
	return ""
}

func isDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

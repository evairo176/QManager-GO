package api

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
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

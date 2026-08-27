package api

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// =============================================================================
// data_usage.go — Data usage (quota used) tracker.
//
// The modem firmware does NOT expose AT+QGDATA / AT+QVOLUMCTRL, so we track
// traffic by sampling /proc/net/dev for the data interfaces (rmnet_data*) and
// accumulating deltas into a persisted JSON file. Because the baseline is
// stored on disk, the total survives reboots and interface resets.
//
// Persisted state: /etc/qmanager/data_usage.json
//   { total_rx_bytes, total_tx_bytes, day, day_rx_bytes, day_tx_bytes,
//     last_rx, last_tx, updated_at }
//
// Endpoint: GET /cgi-bin/quecmanager/system/data_usage.sh
// =============================================================================

const dataUsageFile = "/etc/qmanager/data_usage.json"

// Data interfaces to aggregate (rmnet_data* = cellular data path).
var dataUsageIfaces = []string{"rmnet_data0", "rmnet_data1", "rmnet_data2", "rmnet_data3", "rmnet_data4", "rmnet_data5"}

var (
	dataUsageMu      sync.Mutex
	dataUsageAccumul bool
)

type dataUsageState struct {
	TotalRxBytes  int64 `json:"total_rx_bytes"`
	TotalTxBytes  int64 `json:"total_tx_bytes"`
	Day           string `json:"day"`
	DayRxBytes    int64 `json:"day_rx_bytes"`
	DayTxBytes    int64 `json:"day_tx_bytes"`
	LastRx        int64 `json:"last_rx"`
	LastTx        int64 `json:"last_tx"`
	UpdatedAtUnix int64 `json:"updated_at_unix"`
}

func readDataUsageState() *dataUsageState {
	st := &dataUsageState{}
	data, err := os.ReadFile(dataUsageFile)
	if err == nil {
		_ = json.Unmarshal(data, st)
	}
	return st
}

func writeDataUsageState(st *dataUsageState) {
	data, _ := json.MarshalIndent(st, "", "  ")
	_ = os.WriteFile(dataUsageFile, data, 0644)
}

// sampleDataIfaces returns the summed rx/tx bytes across rmnet_data* interfaces.
func sampleDataIfaces() (int64, int64) {
	var rxTotal, txTotal int64
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	line := 0
	for sc.Scan() {
		line++
		if line <= 2 {
			continue
		}
		txt := sc.Text()
		colon := strings.Index(txt, ":")
		if colon < 0 {
			continue
		}
		name := strings.TrimSpace(txt[:colon])
		if !isDataIface(name) {
			continue
		}
		fields := strings.Fields(txt[colon+1:])
		if len(fields) < 9 {
			continue
		}
		rx, _ := strconv.ParseInt(fields[0], 10, 64)
		tx, _ := strconv.ParseInt(fields[8], 10, 64)
		rxTotal += rx
		txTotal += tx
	}
	return rxTotal, txTotal
}

func isDataIface(name string) bool {
	for _, i := range dataUsageIfaces {
		if name == i {
			return true
		}
	}
	return false
}

// tickDataUsage samples the counters and accumulates the delta. Called on a
// timer (and lazily on each GET). When a counter reset is detected (reboot /
// interface re-plug, current < last), the delta is skipped and the new value
// becomes the baseline — we never record a negative or a fake spike.
func tickDataUsage() {
	dataUsageMu.Lock()
	defer dataUsageMu.Unlock()

	rx, tx := sampleDataIfaces()
	st := readDataUsageState()

	now := time.Now()
	today := now.Format("2006-01-02")
	if st.Day != today {
		// New day — roll over daily counters, keep the lifetime total.
		st.Day = today
		st.DayRxBytes = 0
		st.DayTxBytes = 0
	}

	// First sample ever (state file empty): seed the totals with the current
	// boot counters so the UI immediately shows a meaningful number instead of
	// 0, and set the baseline so future ticks accumulate on top of it.
	if st.LastRx == 0 && st.LastTx == 0 && rx > 0 {
		st.TotalRxBytes = rx
		st.TotalTxBytes = tx
		st.DayRxBytes = rx
		st.DayTxBytes = tx
		st.LastRx = rx
		st.LastTx = tx
		st.UpdatedAtUnix = now.Unix()
		writeDataUsageState(st)
		return
	}

	if st.LastRx > 0 && rx >= st.LastRx {
		st.TotalRxBytes += rx - st.LastRx
		st.DayRxBytes += rx - st.LastRx
	}
	if st.LastTx > 0 && tx >= st.LastTx {
		st.TotalTxBytes += tx - st.LastTx
		st.DayTxBytes += tx - st.LastTx
	}

	st.LastRx = rx
	st.LastTx = tx
	st.UpdatedAtUnix = now.Unix()

	writeDataUsageState(st)
}

// StartDataUsageTracker launches the periodic sampler (default 30s).
func (s *Server) StartDataUsageTracker() {
	dataUsageMu.Lock()
	if dataUsageAccumul {
		dataUsageMu.Unlock()
		return
	}
	dataUsageAccumul = true
	dataUsageMu.Unlock()

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			tickDataUsage()
		}
	}()
}

// HandleDataUsage returns the accumulated quota used.
// Contract: { success, download_bytes, upload_bytes, total_bytes,
//             day, day_download_bytes, day_upload_bytes, updated_at_unix }
func (s *Server) HandleDataUsage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Sample + accumulate before reporting so the numbers are current.
	tickDataUsage()
	st := readDataUsageState()

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":             true,
		"download_bytes":      st.TotalRxBytes,
		"upload_bytes":        st.TotalTxBytes,
		"total_bytes":         st.TotalRxBytes + st.TotalTxBytes,
		"day":                 st.Day,
		"day_download_bytes":  st.DayRxBytes,
		"day_upload_bytes":    st.DayTxBytes,
		"updated_at_unix":     st.UpdatedAtUnix,
	})
}

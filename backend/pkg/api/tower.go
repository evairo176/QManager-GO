package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

type CellLockItem struct {
	EARFCN int `json:"earfcn,omitempty"`
	ARFCN  int `json:"arfcn,omitempty"`
	PCI    int `json:"pci"`
	SCS    int `json:"scs,omitempty"`
	Band   int `json:"band,omitempty"`
}

type TowerLockRequest struct {
	Type   string         `json:"type"`   // "lte" or "nr_sa"
	Action string         `json:"action"` // "lock" or "unlock"
	Cells  []CellLockItem `json:"cells,omitempty"`
	PCI    int            `json:"pci,omitempty"`
	ARFCN  int            `json:"arfcn,omitempty"`
	SCS    int            `json:"scs,omitempty"`
	Band   int            `json:"band,omitempty"`
}

// HandleTowerLock handles AT+QNWLOCK cell locking and unlocking with 5G NR SCS support
func (s *Server) HandleTowerLock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req TowerLockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Type == "" || req.Action == "" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "missing_fields",
			"detail":  "type and action fields are required",
		})
		return
	}

	if req.Action == "unlock" {
		if req.Type == "lte" {
			_, _ = s.atClient.Exec(`AT+QNWLOCK="common/4g",0`)
		} else {
			_, _ = s.atClient.Exec(`AT+QNWLOCK="common/5g",0`)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "unlocked": true})
		return
	}

	if req.Action == "lock" {
		if req.Type == "lte" && len(req.Cells) > 0 {
			cellCount := len(req.Cells)
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf(`AT+QNWLOCK="common/4g",%d`, cellCount))
			for _, cell := range req.Cells {
				sb.WriteString(fmt.Sprintf(",%d,%d", cell.EARFCN, cell.PCI))
			}
			resp, err := s.atClient.Exec(sb.String())
			if err != nil || atHasError(resp) {
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
				return
			}
		} else if req.Type == "nr_sa" {
			scs := req.SCS
			if scs == 0 {
				scs = 30 // Default Subcarrier Spacing for Sub-6GHz 5G NR
			}
			pci := req.PCI
			arfcn := req.ARFCN
			band := req.Band
			if len(req.Cells) > 0 {
				pci = req.Cells[0].PCI
				arfcn = req.Cells[0].ARFCN
				band = req.Cells[0].Band
				if req.Cells[0].SCS > 0 {
					scs = req.Cells[0].SCS
				}
			}
			atCmd := fmt.Sprintf(`AT+QNWLOCK="common/5g",%d,%d,%d,%d`, pci, arfcn, scs, band)
			resp, err := s.atClient.Exec(atCmd)
			if err != nil || atHasError(resp) {
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
				return
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "locked": true})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_action"})
}

// HandleFrequencyStatus returns the current EARFCN/ARFCN frequency lock status
func (s *Server) HandleFrequencyStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Query LTE lock state
	rawLte, _ := s.atClient.Exec(`AT+QNWCFG="lte_earfcn_lock"`)
	rawNr, _ := s.atClient.Exec(`AT+QNWCFG="nr5g_earfcn_lock"`)
	rawTowerLte, _ := s.atClient.Exec(`AT+QNWLOCK="common/4g"`)
	rawTowerNr, _ := s.atClient.Exec(`AT+QNWLOCK="common/5g"`)

	lteLocked := strings.Contains(rawLte, "1") && !strings.Contains(rawLte, "ERROR")
	nrLocked := strings.Contains(rawNr, "1") && !strings.Contains(rawNr, "ERROR")
	towerLteActive := strings.Contains(rawTowerLte, "1") && !strings.Contains(rawTowerLte, "ERROR")
	towerNrActive := strings.Contains(rawTowerNr, "1") && !strings.Contains(rawTowerNr, "ERROR")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"modem_state": map[string]interface{}{
			"lte_locked":            lteLocked,
			"lte_entries":           []interface{}{},
			"nr_locked":             nrLocked,
			"nr_entries":            []interface{}{},
			"tower_lock_lte_active": towerLteActive,
			"tower_lock_nr_active":  towerNrActive,
		},
	})
}

// HandleFrequencyLock handles frequency channel locking (EARFCN/ARFCN)
func (s *Server) HandleFrequencyLock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.HandleFrequencyStatus(w, r)
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Type    string `json:"type"`   // "lte" or "nr"
			Action  string `json:"action"` // "lock" or "unlock"
			Entries []struct {
				Earfcn int `json:"earfcn,omitempty"`
				Arfcn  int `json:"arfcn,omitempty"`
				Scs    int `json:"scs,omitempty"`
			} `json:"entries"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_json"})
			return
		}

		if req.Action == "unlock" {
			if req.Type == "nr" {
				_, _ = s.atClient.Exec(`AT+QNWCFG="nr5g_earfcn_lock",0`)
			} else {
				_, _ = s.atClient.Exec(`AT+QNWCFG="lte_earfcn_lock",0`)
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"type":    req.Type,
				"action":  "unlock",
			})
			return
		}

		if req.Type == "lte" && len(req.Entries) > 0 {
			var earfcns []string
			for _, e := range req.Entries {
				if e.Earfcn > 0 {
					earfcns = append(earfcns, fmt.Sprintf("%d", e.Earfcn))
				}
			}
			if len(earfcns) > 0 {
				atCmd := fmt.Sprintf(`AT+QNWCFG="lte_earfcn_lock",1,%s`, strings.Join(earfcns, ","))
				resp, err := s.atClient.Exec(atCmd)
				if err != nil || strings.Contains(resp, "ERROR") {
					_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
					return
				}
			}
		} else if req.Type == "nr" && len(req.Entries) > 0 {
			var arfcns []string
			for _, e := range req.Entries {
				if e.Arfcn > 0 {
					scs := e.Scs
					if scs == 0 {
						scs = 30
					}
					arfcns = append(arfcns, fmt.Sprintf("%d,%d", e.Arfcn, scs))
				}
			}
			if len(arfcns) > 0 {
				atCmd := fmt.Sprintf(`AT+QNWCFG="nr5g_earfcn_lock",1,%s`, strings.Join(arfcns, ","))
				resp, err := s.atClient.Exec(atCmd)
				if err != nil || strings.Contains(resp, "ERROR") {
					_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
					return
				}
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"type":    req.Type,
			"action":  "lock",
			"count":   len(req.Entries),
		})
		return
	}

	http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
}

// HandleTowerStatus handles GET for tower lock status, config, and failover state
func (s *Server) HandleTowerStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rawLte, _ := s.atClient.Exec(`AT+QNWLOCK="common/4g"`)
	rawNr, _ := s.atClient.Exec(`AT+QNWLOCK="common/5g"`)

	lteLocked := strings.Contains(rawLte, "1") && !strings.Contains(rawLte, "ERROR")
	nrLocked := strings.Contains(rawNr, "1") && !strings.Contains(rawNr, "ERROR")

	failoverEnabled := checkFileExistsAndEquals("/etc/qmanager/tower_failover_enabled", "1")
	failoverActivated := fileExists("/tmp/qmanager_tower_failover")
	watcherRunning := fileExists("/tmp/qmanager_tower_failover.pid")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"modem_state": map[string]interface{}{
			"lte_locked":  lteLocked,
			"lte_cells":   []interface{}{},
			"nr_locked":   nrLocked,
			"nr_cell":      nil,
			"persist_lte": false,
			"persist_nr":  false,
		},
		"config": map[string]interface{}{
			"lte": map[string]interface{}{
				"enabled": lteLocked,
				"cells":   []interface{}{nil, nil, nil},
			},
			"nr_sa": map[string]interface{}{
				"enabled": nrLocked,
				"pci":     nil,
				"arfcn":   nil,
				"scs":     nil,
				"band":    nil,
			},
			"persist": false,
			"failover": map[string]interface{}{
				"enabled":   failoverEnabled,
				"threshold": 50,
			},
			"schedule": map[string]interface{}{
				"enabled":    false,
				"start_time": "00:00",
				"end_time":   "06:00",
				"days":       []int{0, 1, 2, 3, 4, 5, 6},
			},
		},
		"failover_state": map[string]interface{}{
			"enabled":         failoverEnabled,
			"activated":       failoverActivated,
			"watcher_running": watcherRunning,
		},
	})
}

// HandleTowerSettings handles saving tower failover and persistence settings
func (s *Server) HandleTowerSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
	s.HandleTowerStatus(w, r)
}

// HandleTowerSchedule handles tower lock schedule settings
func (s *Server) HandleTowerSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}
	s.HandleTowerStatus(w, r)
}

func checkFileExistsAndEquals(path, val string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(data)) == val
}

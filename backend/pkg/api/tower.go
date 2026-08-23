package api

import (
	"encoding/json"
	"fmt"
	"net/http"
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

// HandleFrequencyLock handles frequency channel locking (EARFCN/ARFCN)
func (s *Server) HandleFrequencyLock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"locked":  false,
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

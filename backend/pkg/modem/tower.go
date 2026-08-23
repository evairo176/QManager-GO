package modem

import (
	"fmt"
	"strings"

	"qmanager-backend/pkg/at"
)

type TowerManager struct {
	atClient at.Executor
}

func NewTowerManager(atClient at.Executor) *TowerManager {
	return &TowerManager{atClient: atClient}
}

type CellLockItem struct {
	EARFCN int `json:"earfcn,omitempty"`
	ARFCN  int `json:"arfcn,omitempty"`
	PCI    int `json:"pci"`
	SCS    int `json:"scs,omitempty"`
	Band   int `json:"band,omitempty"`
}

func (t *TowerManager) LockLTECells(cells []CellLockItem) error {
	if len(cells) == 0 {
		return fmt.Errorf("no cells provided for LTE lock")
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`AT+QNWLOCK="common/4g",%d`, len(cells)))
	for _, cell := range cells {
		sb.WriteString(fmt.Sprintf(",%d,%d", cell.EARFCN, cell.PCI))
	}

	resp, err := t.atClient.Exec(sb.String())
	if err != nil || strings.Contains(resp, "ERROR") {
		return fmt.Errorf("LTE cell lock failed: %s", resp)
	}
	return nil
}

func (t *TowerManager) Lock5GNRCell(pci, arfcn, scs, band int) error {
	if scs == 0 {
		scs = 30 // Default 30 kHz for Sub-6GHz 5G NR
	}
	atCmd := fmt.Sprintf(`AT+QNWLOCK="common/5g",%d,%d,%d,%d`, pci, arfcn, scs, band)
	resp, err := t.atClient.Exec(atCmd)
	if err != nil || strings.Contains(resp, "ERROR") {
		return fmt.Errorf("5G NR cell lock failed: %s", resp)
	}
	return nil
}

func (t *TowerManager) UnlockTower(cellType string) error {
	atCmd := `AT+QNWLOCK="common/5g",0`
	if cellType == "lte" {
		atCmd = `AT+QNWLOCK="common/4g",0`
	}
	resp, err := t.atClient.Exec(atCmd)
	if err != nil || strings.Contains(resp, "ERROR") {
		return fmt.Errorf("tower unlock failed: %s", resp)
	}
	return nil
}

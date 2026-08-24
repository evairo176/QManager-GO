package modem

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type ATExecutor interface {
	Exec(cmd string) (string, error)
}

type SIMInfo struct {
	ActiveSlot int    `json:"active_slot"`
	ICCID      string `json:"iccid"`
	Status     string `json:"status"`
}

type SIMManager struct{}

func NewSIMManager() *SIMManager {
	return &SIMManager{}
}

func (sm *SIMManager) ParseQUIMSLOTResponse(resp string) (int, error) {
	// +QUIMSLOT: 1 or +QUIMSLOT: 2
	re := regexp.MustCompile(`\+QUIMSLOT:\s*([12])`)
	matches := re.FindStringSubmatch(resp)
	if len(matches) >= 2 {
		slot, err := strconv.Atoi(matches[1])
		if err == nil {
			return slot, nil
		}
	}
	return 1, fmt.Errorf("unable to parse +QUIMSLOT response: %s", resp)
}

func (sm *SIMManager) ParseQCCIDResponse(resp string) (string, error) {
	// +QCCID: 898600...
	re := regexp.MustCompile(`\+QCCID:\s*([0-9A-Fa-f]+)`)
	matches := re.FindStringSubmatch(resp)
	if len(matches) >= 2 {
		return matches[1], nil
	}

	// Direct raw 20-digit ICCID string
	clean := strings.TrimSpace(resp)
	if len(clean) >= 18 && len(clean) <= 22 {
		return clean, nil
	}

	return "", fmt.Errorf("unable to parse +QCCID response: %s", resp)
}

func (sm *SIMManager) GetSIMInfo(exec ATExecutor) (*SIMInfo, error) {
	info := &SIMInfo{
		ActiveSlot: 1,
		Status:     "ready",
	}

	slotResp, err := exec.Exec("AT+QUIMSLOT?")
	if err == nil {
		if slot, pErr := sm.ParseQUIMSLOTResponse(slotResp); pErr == nil {
			info.ActiveSlot = slot
		}
	}

	iccidResp, err := exec.Exec("AT+QCCID")
	if err == nil {
		if iccid, pErr := sm.ParseQCCIDResponse(iccidResp); pErr == nil {
			info.ICCID = iccid
		}
	}

	return info, nil
}

func (sm *SIMManager) SwitchSlot(exec ATExecutor, slot int) error {
	if slot != 1 && slot != 2 {
		return fmt.Errorf("invalid SIM slot %d: must be 1 or 2", slot)
	}

	cmd := fmt.Sprintf("AT+QUIMSLOT=%d", slot)
	resp, err := exec.Exec(cmd)
	if err != nil {
		return err
	}

	if strings.Contains(resp, "OK") {
		return nil
	}
	return fmt.Errorf("AT+QUIMSLOT failed: %s", resp)
}

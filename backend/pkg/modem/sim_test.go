package modem

import (
	"fmt"
	"testing"
)

type mockATExec struct {
	responses map[string]string
}

func (m *mockATExec) Exec(cmd string) (string, error) {
	if resp, ok := m.responses[cmd]; ok {
		return resp, nil
	}
	return "", fmt.Errorf("unknown command: %s", cmd)
}

func TestSIMManager(t *testing.T) {
	sm := NewSIMManager()

	mock := &mockATExec{
		responses: map[string]string{
			"AT+QUIMSLOT?": "+QUIMSLOT: 2\r\nOK\r\n",
			"AT+QCCID":     "+QCCID: 89014103211118510720\r\nOK\r\n",
			"AT+QUIMSLOT=1": "OK\r\n",
		},
	}

	info, err := sm.GetSIMInfo(mock)
	if err != nil {
		t.Fatalf("unexpected error getting sim info: %v", err)
	}

	if info.ActiveSlot != 2 {
		t.Errorf("expected active slot 2, got %d", info.ActiveSlot)
	}
	if info.ICCID != "89014103211118510720" {
		t.Errorf("expected ICCID 89014103211118510720, got %s", info.ICCID)
	}

	err = sm.SwitchSlot(mock, 1)
	if err != nil {
		t.Errorf("failed to switch slot: %v", err)
	}
}

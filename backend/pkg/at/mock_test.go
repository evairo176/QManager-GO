package at

import (
	"testing"
)

func TestMockClient(t *testing.T) {
	mock := NewMockClient()

	resp, err := mock.Exec("ATI")
	if err != nil || resp == "" {
		t.Fatalf("expected ATI response, got %q (err: %v)", resp, err)
	}

	mock.RegisterResponse("AT+CUSTOM", "+CUSTOM: OK")
	cResp, err := mock.Exec("AT+CUSTOM")
	if err != nil || cResp != "+CUSTOM: OK" {
		t.Errorf("expected +CUSTOM: OK, got %q", cResp)
	}

	mock.RegisterFunc("AT+ECHO", func(cmd string) (string, error) {
		return "ECHO: " + cmd, nil
	})
	eResp, _ := mock.Exec("AT+ECHO TEST")
	if eResp != "ECHO: AT+ECHO TEST" {
		t.Errorf("expected ECHO response, got %q", eResp)
	}

	history := mock.GetHistory()
	if len(history) != 3 {
		t.Errorf("expected 3 history items, got %d", len(history))
	}

	mock.ClearHistory()
	if len(mock.GetHistory()) != 0 {
		t.Errorf("expected 0 history items after clear")
	}

	_, errInv := mock.Exec("INVALID_CMD")
	if errInv == nil {
		t.Errorf("expected error for invalid command")
	}
}

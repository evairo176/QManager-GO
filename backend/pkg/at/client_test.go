package at

import (
	"testing"
)

func TestClient(t *testing.T) {
	client := NewClient("/dev/null")

	resp, err := client.Exec("ATI")
	if err != nil || resp == "" {
		t.Errorf("expected ATI mock fallback, got %q (err: %v)", resp, err)
	}

	_, errInv := client.Exec("INVALID")
	if errInv == nil {
		t.Errorf("expected error for non-AT command")
	}
}

package daemon

import (
	"testing"
	"time"
)

func TestWatchdogSuccess(t *testing.T) {
	w := NewWatchdog("127.0.0.1", 1*time.Second, 3)
	w.pingFunc = func(host string) bool {
		return true
	}

	w.CheckOnce()
	st := w.GetStatus()

	if !st.IsConnected {
		t.Errorf("Expected IsConnected=true")
	}
	if st.ConsecutiveFails != 0 {
		t.Errorf("Expected ConsecutiveFails=0, got %d", st.ConsecutiveFails)
	}
}

func TestWatchdogFailuresAndRecoveryTrigger(t *testing.T) {
	w := NewWatchdog("127.0.0.1", 1*time.Second, 2)
	w.pingFunc = func(host string) bool {
		return false
	}

	// First fail
	w.CheckOnce()
	st1 := w.GetStatus()
	if st1.IsConnected {
		t.Errorf("Expected IsConnected=false")
	}
	if st1.ConsecutiveFails != 1 {
		t.Errorf("Expected ConsecutiveFails=1, got %d", st1.ConsecutiveFails)
	}
	if st1.ActionTaken != "" && st1.ActionTaken != "none" {
		t.Errorf("Expected ActionTaken=none, got '%s'", st1.ActionTaken)
	}

	// Second fail -> triggers recovery threshold
	w.CheckOnce()
	st2 := w.GetStatus()
	if st2.ConsecutiveFails != 2 {
		t.Errorf("Expected ConsecutiveFails=2, got %d", st2.ConsecutiveFails)
	}
	if st2.ActionTaken != "recovery_triggered" {
		t.Errorf("Expected ActionTaken=recovery_triggered, got '%s'", st2.ActionTaken)
	}
}

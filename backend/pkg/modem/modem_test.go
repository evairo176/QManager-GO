package modem

import (
	"testing"

	"qmanager-backend/pkg/at"
)

func TestModemManagers(t *testing.T) {
	mockAT := at.NewMockClient()

	t.Run("BandManager", func(t *testing.T) {
		bm := NewBandManager(mockAT)

		cfg, status, err := bm.GetCurrentBands()
		if err != nil || cfg == nil || status == nil {
			t.Fatalf("GetCurrentBands failed: %v", err)
		}

		if cfg.LTEBands != "1:3:7:28" {
			t.Errorf("expected lte_bands 1:3:7:28, got %q", cfg.LTEBands)
		}

		if err := bm.LockBands("lte", "1:3"); err != nil {
			t.Errorf("LockBands lte failed: %v", err)
		}

		if err := bm.LockBands("invalid", "1"); err == nil {
			t.Errorf("expected error for invalid band_type")
		}
	})

	t.Run("TowerManager", func(t *testing.T) {
		tm := NewTowerManager(mockAT)

		cells := []CellLockItem{{EARFCN: 1800, PCI: 12}}
		if err := tm.LockLTECells(cells); err != nil {
			t.Errorf("LockLTECells failed: %v", err)
		}

		if err := tm.Lock5GNRCell(108, 627464, 30, 78); err != nil {
			t.Errorf("Lock5GNRCell failed: %v", err)
		}

		if err := tm.UnlockTower("nr_sa"); err != nil {
			t.Errorf("UnlockTower failed: %v", err)
		}
	})

	t.Run("SMSManager", func(t *testing.T) {
		sm := NewSMSManager(mockAT)

		if err := sm.InitStorageRouting(); err != nil {
			t.Errorf("InitStorageRouting failed: %v", err)
		}

		if err := sm.SendSMS("08123456789", "Hello"); err != nil {
			t.Errorf("SendSMS failed: %v", err)
		}
	})
}

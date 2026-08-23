package api

import (
	"testing"
)

func TestParseQScanOutput(t *testing.T) {
	raw := `+QSCAN: "NR5G",510,11,632000,128,-85,-11,15,30,12345,6789,100,78
+QSCAN: "LTE",510,11,1800,256,-78,-10,-95,0,54321,9876,20,3`

	results := ParseQScanOutput(raw)
	if len(results) != 2 {
		t.Fatalf("expected 2 cell results, got %d", len(results))
	}

	nrCell := results[0]
	if nrCell.Tech != "NR5G" || nrCell.SCS != 30 || nrCell.Band != 78 || nrCell.PCI != 128 || nrCell.ARFCN != 632000 {
		t.Errorf("unexpected NR5G cell result: %+v", nrCell)
	}

	lteCell := results[1]
	if lteCell.Tech != "LTE" || lteCell.Band != 3 || lteCell.PCI != 256 || lteCell.Bandwidth != 20 {
		t.Errorf("unexpected LTE cell result: %+v", lteCell)
	}
}

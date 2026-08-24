package firewall

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFirewallManager(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "qmanager_fw_test")
	if err != nil {
		t.Fatalf("failed to create tmp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	ruleFile := filepath.Join(tmpDir, "12-mangle-qmanager-dpi.nft")
	fm := NewFirewallManager(ruleFile)

	err = fm.SaveRules(true, 200, 64)
	if err != nil {
		t.Fatalf("failed to save rules: %v", err)
	}

	data, err := os.ReadFile(ruleFile)
	if err != nil {
		t.Fatalf("failed to read rule file: %v", err)
	}

	content := string(data)
	if !strings.Contains(content, "queue num 200 bypass") {
		t.Errorf("expected queue num 200 bypass in output, got: %s", content)
	}
	if !strings.Contains(content, "ip ttl set 64;") {
		t.Errorf("expected ip ttl set 64 in output, got: %s", content)
	}
}

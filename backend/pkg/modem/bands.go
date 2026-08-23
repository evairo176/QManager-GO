package modem

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"qmanager-backend/pkg/at"
)

type BandManager struct {
	atClient at.Executor
}

func NewBandManager(atClient at.Executor) *BandManager {
	return &BandManager{atClient: atClient}
}

type BandConfig struct {
	LTEBands     string `json:"lte_bands"`
	NSANR5GBands string `json:"nsa_nr5g_bands"`
	SANR5GBands  string `json:"sa_nr5g_bands"`
}

type FailoverStatus struct {
	Enabled        bool `json:"enabled"`
	Activated      bool `json:"activated"`
	WatcherRunning bool `json:"watcher_running"`
}

func (b *BandManager) GetCurrentBands() (*BandConfig, *FailoverStatus, error) {
	raw, err := b.atClient.Exec(`AT+QNWPREFCFG="ue_capability_band"`)
	if err != nil || strings.Contains(raw, "ERROR") {
		return nil, nil, fmt.Errorf("failed to query band capability: %w", err)
	}

	config := &BandConfig{
		LTEBands:     extractBandList(raw, "lte_band"),
		NSANR5GBands: extractBandList(raw, "nsa_nr5g_band"),
		SANR5GBands:  extractBandList(raw, "nr5g_band"),
	}

	failover := &FailoverStatus{
		Enabled:        fileExistsAndEquals("/etc/qmanager/band_failover_enabled", "1"),
		Activated:      fileExists("/tmp/qmanager_band_failover"),
		WatcherRunning: fileExists("/tmp/qmanager_band_failover.pid"),
	}

	return config, failover, nil
}

func (b *BandManager) LockBands(bandType, bands string) error {
	var atCmdType string
	switch bandType {
	case "lte":
		atCmdType = "lte_band"
	case "nsa_nr5g":
		atCmdType = "nsa_nr5g_band"
	case "sa_nr5g":
		atCmdType = "nr5g_band"
	default:
		return fmt.Errorf("invalid band_type: %s", bandType)
	}

	if bands != "all" && !regexp.MustCompile(`^[0-9]+(:[0-9]+)*$`).MatchString(bands) {
		return fmt.Errorf("invalid bands format: %s", bands)
	}

	atCmd := fmt.Sprintf(`AT+QNWPREFCFG="%s",%s`, atCmdType, bands)
	resp, err := b.atClient.Exec(atCmd)
	if err != nil || strings.Contains(resp, "ERROR") {
		return fmt.Errorf("modem error setting bands: %s", resp)
	}

	_ = os.Remove("/tmp/qmanager_band_failover")
	return nil
}

func extractBandList(raw, bandType string) string {
	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, bandType) {
			if bandType == "nr5g_band" && (strings.Contains(line, "nsa_") || strings.Contains(line, "nrdc_")) {
				continue
			}
			re := regexp.MustCompile(fmt.Sprintf(`.*"%s",`, bandType))
			cleaned := re.ReplaceAllString(line, "")
			return strings.TrimSpace(cleaned)
		}
	}
	return ""
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func fileExistsAndEquals(path, expected string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(data)) == expected
}

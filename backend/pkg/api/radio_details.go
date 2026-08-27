package api

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// HandleRadioDetails serves GET /cgi-bin/quecmanager/cellular/radio_details.sh
func (s *Server) HandleRadioDetails(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Read latest poller snapshot from /tmp/qmanager_status.json
	statusData, err := os.ReadFile("/tmp/qmanager_status.json")
	var status map[string]interface{}
	if err == nil {
		_ = json.Unmarshal(statusData, &status)
	}

	apn := ""
	wanIpv4 := ""
	wanIpv6 := ""
	primaryDns := ""
	secondaryDns := ""
	mimo := "4x4"
	lteTa := ""
	nrTa := ""

	if status != nil {
		if netMap, ok := status["network"].(map[string]interface{}); ok {
			if v, ok := netMap["apn"].(string); ok {
				apn = v
			}
			if v, ok := netMap["wan_ipv4"].(string); ok {
				wanIpv4 = v
			}
			if v, ok := netMap["wan_ipv6"].(string); ok {
				wanIpv6 = v
			}
			if v, ok := netMap["primary_dns"].(string); ok {
				primaryDns = v
			}
			if v, ok := netMap["secondary_dns"].(string); ok {
				secondaryDns = v
			}
		}
		if devMap, ok := status["device"].(map[string]interface{}); ok {
			if v, ok := devMap["mimo"].(string); ok {
				mimo = v
			}
		}
	}

	// Live AT reads for CGCONTRDP details if available
	if resp, err := s.atClient.Exec("AT+CGCONTRDP=1"); err == nil && !strings.Contains(resp, "ERROR") {
		for _, line := range strings.Split(resp, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "+CGCONTRDP:") {
				parts := strings.Split(line, ",")
				if len(parts) >= 3 && apn == "" {
					apn = strings.Trim(strings.TrimSpace(parts[2]), `"`)
				}
				if len(parts) >= 4 && wanIpv4 == "" {
					ipCandidate := strings.Trim(strings.TrimSpace(parts[3]), `"`)
					if strings.Contains(ipCandidate, ".") && !strings.Contains(ipCandidate, ":") {
						wanIpv4 = ipCandidate
					}
				}
				if len(parts) >= 7 {
					dnsField := strings.TrimSpace(parts[6])
					dnsParts := strings.Fields(dnsField)
					if len(dnsParts) > 0 && primaryDns == "" {
						primaryDns = dnsParts[0]
					}
				}
				if len(parts) >= 8 {
					dnsSecField := strings.TrimSpace(parts[7])
					dnsSecParts := strings.Fields(dnsSecField)
					if len(dnsSecParts) > 0 && secondaryDns == "" {
						secondaryDns = dnsSecParts[0]
					}
				}
			}
		}
	}

	// Live AT read for timing advance
	if resp, err := s.atClient.Exec(`AT+QENG="servingcell"`); err == nil && !strings.Contains(resp, "ERROR") {
		for _, line := range strings.Split(resp, "\n") {
			line = strings.TrimSpace(line)
			if strings.Contains(line, `+QENG: "LTE"`) {
				parts := strings.Split(line, ",")
				if len(parts) >= 17 {
					taVal := strings.TrimSpace(parts[16])
					if taVal != "-" && taVal != "" {
						lteTa = taVal
					}
				}
			}
		}
	}

	response := map[string]interface{}{
		"success": true,
		"stale":   false,
		"details": map[string]string{
			"mimo":          mimo,
			"lte_ta":        lteTa,
			"nr_ta":         nrTa,
			"apn":           apn,
			"wan_ipv4":      wanIpv4,
			"wan_ipv6":      wanIpv6,
			"primary_dns":   primaryDns,
			"secondary_dns": secondaryDns,
		},
	}

	_ = json.NewEncoder(w).Encode(response)
}

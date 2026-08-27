package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type APNProfile struct {
	CID      int    `json:"cid"`
	Name     string `json:"name"`
	APN      string `json:"apn"`
	PDPType  string `json:"pdp_type"`
	Active   bool   `json:"active"`
	IP       string `json:"ip,omitempty"`
	AuthType int    `json:"auth_type"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

type APNResponse struct {
	Success    bool         `json:"success"`
	ActiveCID  int          `json:"active_cid"`
	Profiles   []APNProfile `json:"profiles"`
	MBNAttached string       `json:"mbn_attached,omitempty"`
	Error      string       `json:"error,omitempty"`
}

type APNSaveRequest struct {
	CID      int    `json:"cid"`
	APN      string `json:"apn"`
	PDPType  string `json:"pdp_type"`
	AuthType int    `json:"auth_type"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// HandleAPN handles GET and POST requests for APN contexts
func (s *Server) HandleAPN(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		raw, err := s.atClient.Exec(`AT+CGDCONT?`)
		var cids []map[string]interface{}
		var activeApnStr = "internet"
		var activePdpType = "IPV4V6"
		var activeCid = 1

		if err == nil {
			lines := strings.Split(raw, "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "+CGDCONT:") {
					parts := strings.Split(line, ",")
					if len(parts) >= 3 {
						var cid int
						_, _ = fmt.Sscanf(parts[0], "+CGDCONT: %d", &cid)
						pdp := strings.Trim(parts[1], `" `)
						apnStr := strings.Trim(parts[2], `" `)

						apnType := ""
						if strings.Contains(strings.ToLower(apnStr), "ims") {
							apnType = "ims"
						} else if strings.Contains(strings.ToLower(apnStr), "sos") {
							apnType = "emergency"
						}

						if cid == 1 {
							activeApnStr = apnStr
							activePdpType = pdp
							activeCid = cid
						}

						cids = append(cids, map[string]interface{}{
							"cid":         cid,
							"apn":         apnStr,
							"apn_type":    apnType,
							"is_internet": cid == 1,
						})
					}
				}
			}
		}

		if len(cids) == 0 {
			cids = append(cids, map[string]interface{}{
				"cid":         1,
				"apn":         "internet",
				"apn_type":    "",
				"is_internet": true,
			})
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":      true,
			"active":       1,
			"active_cid":   activeCid,
			"internet_cid": activeCid,
			"apn": map[string]interface{}{
				"apn":      activeApnStr,
				"pdp_type": activePdpType,
				"cid":      activeCid,
			},
			"cids": cids,
		})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Action  string `json:"action"`
			APN     string `json:"apn"`
			PDPType string `json:"pdp_type"`
			CID     int    `json:"cid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_json"})
			return
		}

		if req.Action == "deactivate" {
			_, _ = s.atClient.Exec(`AT+CGDCONT=1`)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
			return
		}

		if req.CID <= 0 {
			req.CID = 1
		}
		if req.PDPType == "" {
			req.PDPType = "IPV4V6"
		}

		cmd := fmt.Sprintf(`AT+CGDCONT=%d,"%s","%s"`, req.CID, req.PDPType, req.APN)
		resp, err := s.atClient.Exec(cmd)
		if err != nil || strings.Contains(resp, "ERROR") {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "cid": req.CID})
		return
	}

	http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
}

// HandleMBN handles MBN profile query
func (s *Server) HandleMBN(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	raw, err := s.atClient.Exec(`AT+QMBNCFG="select"`)
	if err != nil || strings.Contains(raw, "ERROR") {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "modem_error",
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"raw_response": raw,
	})
}

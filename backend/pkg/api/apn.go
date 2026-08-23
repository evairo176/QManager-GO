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
		raw, err := s.atClient.Exec("AT+CGDCONT?")
		if err != nil || strings.Contains(raw, "ERROR") {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "modem_error"})
			return
		}
		profiles := parseAPNProfiles(raw)
		_ = json.NewEncoder(w).Encode(APNResponse{
			Success:   true,
			ActiveCID: 1,
			Profiles:  profiles,
		})
		return
	}

	if r.Method == http.MethodPost {
		var req APNSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.CID <= 0 || req.APN == "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "invalid_json"})
			return
		}

		if req.PDPType == "" {
			req.PDPType = "IPV4V6"
		}

		atCmd := fmt.Sprintf(`AT+CGDCONT=%d,"%s","%s"`, req.CID, req.PDPType, req.APN)
		resp, err := s.atClient.Exec(atCmd)
		if err != nil || atHasError(resp) {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "at_error"})
			return
		}

		if req.AuthType > 0 {
			authCmd := fmt.Sprintf(`AT+QICSGP=%d,%d,"%s","%s","%s",1`, req.CID, req.AuthType, req.APN, req.Username, req.Password)
			_, _ = s.atClient.Exec(authCmd)
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
		"success":  true,
		"raw_response": raw,
	})
}

func parseAPNProfiles(raw string) []APNProfile {
	var profiles []APNProfile
	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "+CGDCONT:") {
			parts := strings.Split(line, ",")
			if len(parts) >= 3 {
				var cid int
				_, _ = fmt.Sscanf(parts[0], "+CGDCONT: %d", &cid)
				pdp := strings.Trim(parts[1], `" `)
				apn := strings.Trim(parts[2], `" `)
				profiles = append(profiles, APNProfile{
					CID:     cid,
					Name:    fmt.Sprintf("CID %d", cid),
					APN:     apn,
					PDPType: pdp,
					Active:  cid == 1,
				})
			}
		}
	}
	if len(profiles) == 0 {
		profiles = append(profiles, APNProfile{
			CID: 1, Name: "Default", APN: "internet", PDPType: "IPV4V6", Active: true,
		})
	}
	return profiles
}

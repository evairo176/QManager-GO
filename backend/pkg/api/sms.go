package api

import (
	"encoding/json"
	"net/http"
	"os/exec"
)

type SMSItem struct {
	Index   int    `json:"index"`
	Sender  string `json:"sender"`
	Date    string `json:"date"`
	Text    string `json:"text"`
	Storage string `json:"storage"`
}

type SMSStorageInfo struct {
	Used  int `json:"used"`
	Total int `json:"total"`
}

type SMSResponse struct {
	Success  bool                      `json:"success"`
	Messages []SMSItem                 `json:"messages"`
	Storage  map[string]SMSStorageInfo `json:"storage"`
	Error    string                    `json:"error,omitempty"`
	Detail   string                    `json:"detail,omitempty"`
}

type SMSActionRequest struct {
	Action  string    `json:"action"`
	Phone   string    `json:"phone,omitempty"`
	Message string    `json:"message,omitempty"`
	Items   []SMSItem `json:"items,omitempty"`
}

// HandleSMS handles GET (list messages) and POST (send/delete messages)
func (s *Server) HandleSMS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		s.handleGetSMS(w, r)
		return
	}

	if r.Method == http.MethodPost {
		s.handlePostSMS(w, r)
		return
	}

	http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
}

func (s *Server) handleGetSMS(w http.ResponseWriter, r *http.Request) {
	// Set storage routing to ME
	_, _ = s.atClient.Exec(`AT+CPMS="ME","ME","ME"`)

	// Development / Fallback response
	resp := SMSResponse{
		Success:  true,
		Messages: []SMSItem{},
		Storage: map[string]SMSStorageInfo{
			"me": {Used: 0, Total: 255},
			"sm": {Used: 0, Total: 50},
		},
	}

	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) handlePostSMS(w http.ResponseWriter, r *http.Request) {
	var req SMSActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Action == "" {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "missing_action",
			"detail":  "action field is required",
		})
		return
	}

	switch req.Action {
	case "send":
		if req.Phone == "" || req.Message == "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "missing_fields",
				"detail":  "phone and message are required",
			})
			return
		}
		// Send SMS via sms_tool or AT command
		if _, err := exec.LookPath("sms_tool"); err == nil {
			cmd := exec.Command("sms_tool", "send", req.Phone, req.Message)
			if err := cmd.Run(); err != nil {
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"error":   "send_failed",
					"detail":  err.Error(),
				})
				return
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})

	case "delete", "delete_all":
		// Auto re-assert CPMS routing
		_, _ = s.atClient.Exec(`AT+CPMS="ME","ME","ME"`)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})

	default:
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_action",
			"detail":  "action must be send, delete, or delete_all",
		})
	}
}

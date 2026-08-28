package api

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
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

func smsToolBin() string {
	for _, p := range []string{"/usr/bin/sms_tool", "/opt/sbin/sms_tool", "/usr/sbin/sms_tool"} {
		if _, err := exec.LookPath(p); err == nil {
			return p
		}
	}
	return ""
}

func (s *Server) handleGetSMS(w http.ResponseWriter, r *http.Request) {
	// Ensure storage routing to ME
	_, _ = s.atClient.Exec(`AT+CPMS="ME","ME","ME"`)

	storage := map[string]SMSStorageInfo{"me": {Used: 0, Total: 255}, "sm": {Used: 0, Total: 50}}
	messages := []SMSItem{}

	bin := smsToolBin()
	if bin != "" {
		// Storage usage
		if out, err := exec.Command(bin, "status").Output(); err == nil {
			line := strings.TrimSpace(string(out))
			// "Storage type: ME, used: 1, total: 127"
			used, total := 0, 255
			if idx := strings.Index(line, "used:"); idx >= 0 {
				rest := line[idx+5:]
				if end := strings.Index(rest, ","); end >= 0 {
					rest = rest[:end]
				}
				used, _ = strconv.Atoi(strings.TrimSpace(rest))
			}
			if idx := strings.Index(line, "total:"); idx >= 0 {
				total, _ = strconv.Atoi(strings.TrimSpace(line[idx+6:]))
			}
			storage["me"] = SMSStorageInfo{Used: used, Total: total}
		}

		// List messages
		if out, err := exec.Command(bin, "recv").Output(); err == nil {
			messages = parseSmsToolOutput(string(out))
		}
	}

	_ = json.NewEncoder(w).Encode(SMSResponse{
		Success:  true,
		Messages: messages,
		Storage:  storage,
	})
}

// parseSmsToolOutput parses "sms_tool recv" output into SMSItem entries.
// Format:
//
//	MSG: 0
//	From: 9046
//	Date/Time: 08/26/26 14:21:52
//	<message body lines...>
func parseSmsToolOutput(raw string) []SMSItem {
	items := []SMSItem{} // always non-nil — frontend contract expects an array, never null
	scanner := bufio.NewScanner(strings.NewReader(raw))
	var cur *SMSItem
	var body strings.Builder

	flush := func() {
		if cur == nil {
			return
		}
		cur.Text = strings.TrimSpace(body.String())
		items = append(items, *cur)
		cur = nil
		body.Reset()
	}

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, "MSG:"):
			flush()
			idx, _ := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(trimmed, "MSG:")))
			cur = &SMSItem{Index: idx, Storage: "me"}
		case cur == nil:
			// ignore headers before first MSG
		case strings.HasPrefix(trimmed, "From:"):
			cur.Sender = strings.TrimSpace(strings.TrimPrefix(trimmed, "From:"))
		case strings.HasPrefix(trimmed, "Date/Time:"):
			cur.Date = strings.TrimSpace(strings.TrimPrefix(trimmed, "Date/Time:"))
		default:
			if trimmed != "" {
				body.WriteString(line)
				body.WriteString("\n")
			}
		}
	}
	flush()
	return items
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

	bin := smsToolBin()

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
		if bin == "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "sms_tool_missing"})
			return
		}
		cmd := exec.Command(bin, "send", req.Phone, req.Message)
		if err := cmd.Run(); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "send_failed",
				"detail":  err.Error(),
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})

	case "delete", "delete_all":
		// Auto re-assert CPMS routing
		_, _ = s.atClient.Exec(`AT+CPMS="ME","ME","ME"`)
		if bin == "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "sms_tool_missing"})
			return
		}
		if req.Action == "delete_all" {
			_ = exec.Command(bin, "delete", "all").Run()
		} else {
			// delete specific index or all items provided
			if len(req.Items) > 0 {
				for _, it := range req.Items {
					_ = exec.Command(bin, "delete", strconv.Itoa(it.Index)).Run()
				}
			} else {
				_ = exec.Command(bin, "delete", "all").Run()
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})

	default:
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_action",
			"detail":  "action must be send, delete, or delete_all",
		})
	}
}

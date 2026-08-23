package modem

import (
	"fmt"
	"os/exec"
	"strings"

	"qmanager-backend/pkg/at"
)

type SMSManager struct {
	atClient at.Executor
}

func NewSMSManager(atClient at.Executor) *SMSManager {
	return &SMSManager{atClient: atClient}
}

type SMSItem struct {
	Index   int    `json:"index"`
	Sender  string `json:"sender"`
	Date    string `json:"date"`
	Text    string `json:"text"`
	Storage string `json:"storage"`
}

func (s *SMSManager) InitStorageRouting() error {
	_, err := s.atClient.Exec(`AT+CPMS="ME","ME","ME"`)
	return err
}

func (s *SMSManager) SendSMS(phone, message string) error {
	if phone == "" || message == "" {
		return fmt.Errorf("phone and message are required")
	}

	// Try native sms_tool binary first if available on OpenWRT
	if _, err := exec.LookPath("sms_tool"); err == nil {
		cmd := exec.Command("sms_tool", "send", phone, message)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	// Native AT fallback: text mode setup + send
	_, _ = s.atClient.Exec("AT+CMGF=1")
	atCmd := fmt.Sprintf(`AT+CMGS="%s"`, phone)
	resp, err := s.atClient.Exec(atCmd)
	if err != nil || strings.Contains(resp, "ERROR") {
		return fmt.Errorf("failed to send SMS via AT: %s", resp)
	}
	return nil
}

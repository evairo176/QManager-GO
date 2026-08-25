package at

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Client handles thread-safe AT command execution
type Client struct {
	mu         sync.Mutex
	devicePath string
	lockFile   string
	timeout    time.Duration
}

// detectATDevice scans candidate serial ports if default path does not exist
func detectATDevice(initial string) string {
	if initial != "" {
		if _, err := os.Stat(initial); err == nil {
			return initial
		}
	}

	// Priority list for embedded modems and USB passthrough host ports
	candidates := []string{
		"/dev/smd11",       // Quectel internal SMD port (RM520N/RM500Q)
		"/dev/smd7",        // Quectel alternate SMD port
		"/dev/ttyUSB2",     // Quectel USB AT port
		"/dev/ttyUSB3",     // Qualcomm USB AT port
		"/dev/ttyUSB0",     // Standard USB serial
		"/dev/ttyACM0",     // ModemManager / CDC-ACM port
		"/dev/cdc-wdm0",    // QMI / MBIM control port
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	if initial != "" {
		return initial
	}
	return "/dev/smd11"
}

// NewClient initializes a new AT command client with port auto-discovery
func NewClient(devicePath string) *Client {
	resolvedPath := detectATDevice(devicePath)
	return &Client{
		devicePath: resolvedPath,
		lockFile:   "/tmp/qmanager_at.lock",
		timeout:    5 * time.Second,
	}
}

// Exec executes an AT command with thread-safety and mutex lock
func (c *Client) Exec(cmd string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Ensure command ends with CRLF
	cmd = strings.TrimSpace(cmd)
	if !strings.HasPrefix(strings.ToUpper(cmd), "AT") {
		return "", fmt.Errorf("invalid AT command: %s", cmd)
	}

	// On Linux modem/host, try executing via qcmd or direct device IO
	if runtime.GOOS == "linux" {
		resp, err := c.execOnModem(cmd)
		if err == nil {
			return resp, nil
		}
	}

	// Mock / Development fallback
	return c.execMock(cmd)
}

func (c *Client) execOnModem(cmd string) (string, error) {
	// Check if qcmd binary is available
	if _, err := exec.LookPath("qcmd"); err == nil {
		out, err := exec.Command("qcmd", cmd).Output()
		if err != nil {
			return "", fmt.Errorf("qcmd execution failed: %w", err)
		}
		return strings.TrimSpace(string(out)), nil
	}

	// Dynamic re-check if port was plugged in post-launch
	if _, err := os.Stat(c.devicePath); err != nil {
		c.devicePath = detectATDevice(c.devicePath)
	}

	// Direct device check
	if _, err := os.Stat(c.devicePath); err != nil {
		return "", fmt.Errorf("AT device path %s does not exist: %w", c.devicePath, err)
	}

	f, err := os.OpenFile(c.devicePath, os.O_RDWR, 0)
	if err != nil {
		return "", fmt.Errorf("failed to open AT device %s: %w", c.devicePath, err)
	}
	defer f.Close()

	// Send AT command
	if !strings.HasSuffix(cmd, "\r\n") {
		cmd = cmd + "\r\n"
	}
	if _, err := f.WriteString(cmd); err != nil {
		return "", fmt.Errorf("failed to write to AT device: %w", err)
	}

	// Read response buffer with timeout
	buf := make([]byte, 1024)
	var response bytes.Buffer
	deadline := time.Now().Add(c.timeout)

	for time.Now().Before(deadline) {
		_ = f.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
		n, err := f.Read(buf)
		if n > 0 {
			response.Write(buf[:n])
			resStr := response.String()
			if strings.Contains(resStr, "OK\r\n") || strings.Contains(resStr, "ERROR\r\n") {
				break
			}
		}
		if err != nil && !os.IsTimeout(err) {
			break
		}
	}

	res := strings.TrimSpace(response.String())
	if res == "" {
		return "", fmt.Errorf("no response from AT device %s", c.devicePath)
	}
	return res, nil
}

func (c *Client) execMock(cmd string) (string, error) {
	// Development mock responses
	cmdUpper := strings.ToUpper(cmd)
	switch {
	case strings.Contains(cmdUpper, "ATI"):
		return "Quectel\r\nRM520N-GL\r\nRevision: RM520NGLAAR01A07M4G\r\n\r\nOK", nil
	case strings.Contains(cmdUpper, "AT+QENG=\"SERVINGCELL\""):
		return "+QENG: \"servingcell\",\"NOCONN\",\"NR5G-SA\",\"TDD\",528,11,437000,627464,108,12,-11,-92,-11,15,0,0,0\r\n\r\nOK", nil
	default:
		return "OK", nil
	}
}

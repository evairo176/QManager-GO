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

// NewClient initializes a new AT command client
func NewClient(devicePath string) *Client {
	if devicePath == "" {
		devicePath = "/dev/smd11"
	}
	return &Client{
		devicePath: devicePath,
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

	// On Linux modem, try executing via qcmd or direct device IO
	if runtime.GOOS == "linux" {
		return c.execOnModem(cmd)
	}

	// Mock / Development fallback on Windows/Mac
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

	// Fallback: direct device write with flock
	lock, err := os.OpenFile(c.lockFile, os.O_CREATE|os.O_RDWR, 0666)
	if err == nil {
		defer lock.Close()
	}

	f, err := os.OpenFile(c.devicePath, os.O_RDWR, 0)
	if err != nil {
		return "", fmt.Errorf("failed to open AT device %s: %w", c.devicePath, err)
	}
	defer f.Close()

	if _, err := f.WriteString(cmd + "\r\n"); err != nil {
		return "", fmt.Errorf("failed to write to AT device: %w", err)
	}

	buf := make([]byte, 4096)
	var response bytes.Buffer
	deadline := time.Now().Add(c.timeout)

	for time.Now().Before(deadline) {
		_ = f.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
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

	return strings.TrimSpace(response.String()), nil
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

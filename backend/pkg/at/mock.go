package at

import (
	"fmt"
	"strings"
	"sync"
)

// Executor defines the interface for executing AT commands
type Executor interface {
	Exec(cmd string) (string, error)
}

// MockClient provides a thread-safe mock AT executor with custom command handlers
type MockClient struct {
	mu           sync.RWMutex
	responses    map[string]string
	customFuncs  map[string]func(cmd string) (string, error)
	commandHistory []string
}

// NewMockClient initializes a new MockClient with standard default modem responses
func NewMockClient() *MockClient {
	m := &MockClient{
		responses:   make(map[string]string),
		customFuncs: make(map[string]func(cmd string) (string, error)),
	}

	// Register standard default responses for RM520N / Quectel modems
	m.RegisterResponse("ATI", "Quectel\r\nRM520N-GL\r\nRevision: RM520NGLAAR01A07M4G\r\n\r\nOK")
	m.RegisterResponse("AT+GSN", "864201050123456")
	m.RegisterResponse("AT+CIMI", "510111234567890")
	m.RegisterResponse("AT+QUIMSLOT?", "+QUIMSLOT: 1\r\n\r\nOK")
	m.RegisterResponse("AT+QENG=\"SERVINGCELL\"", "+QENG: \"servingcell\",\"NOCONN\",\"NR5G-SA\",\"TDD\",528,11,437000,627464,108,12,-11,-92,-11,15,0,0,0\r\n\r\nOK")
	m.RegisterResponse("AT+QNWPREFCFG=\"ue_capability_band\"", "+QNWPREFCFG: \"lte_band\",1:3:7:28\r\n+QNWPREFCFG: \"nsa_nr5g_band\",1:3:7:28:78\r\n+QNWPREFCFG: \"nr5g_band\",1:3:7:28:78\r\n\r\nOK")
	m.RegisterResponse("AT+CGDCONT?", "+CGDCONT: 1,\"IPV4V6\",\"internet\",\"\",0,0,0,0\r\n\r\nOK")
	m.RegisterResponse("AT+CPMS=\"ME\",\"ME\",\"ME\"", "+CPMS: 0,255,0,255,0,255\r\n\r\nOK")

	return m
}

// RegisterResponse maps an exact or prefix AT command to a mock output string
func (m *MockClient) RegisterResponse(cmd string, response string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.responses[strings.ToUpper(strings.TrimSpace(cmd))] = response
}

// RegisterFunc maps an AT command prefix to a dynamic evaluation function
func (m *MockClient) RegisterFunc(cmdPrefix string, handler func(cmd string) (string, error)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.customFuncs[strings.ToUpper(strings.TrimSpace(cmdPrefix))] = handler
}

// Exec executes the command against registered mocks or returns default "OK"
func (m *MockClient) Exec(cmd string) (string, error) {
	m.mu.Lock()
	m.commandHistory = append(m.commandHistory, cmd)
	m.mu.Unlock()

	cmdUpper := strings.ToUpper(strings.TrimSpace(cmd))

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Check dynamic handler functions
	for prefix, handler := range m.customFuncs {
		if strings.HasPrefix(cmdUpper, prefix) {
			return handler(cmd)
		}
	}

	// Check exact or prefix response matches
	if resp, ok := m.responses[cmdUpper]; ok {
		return resp, nil
	}

	for registeredCmd, resp := range m.responses {
		if strings.HasPrefix(cmdUpper, registeredCmd) {
			return resp, nil
		}
	}

	// Default fallback for any unmatched command
	if !strings.HasPrefix(cmdUpper, "AT") {
		return "", fmt.Errorf("invalid AT command: %s", cmd)
	}

	return "OK", nil
}

// GetHistory returns list of all executed AT commands in order
func (m *MockClient) GetHistory() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	copied := make([]string, len(m.commandHistory))
	copy(copied, m.commandHistory)
	return copied
}

// ClearHistory resets the recorded command execution log
func (m *MockClient) ClearHistory() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.commandHistory = nil
}

package api

import (
	"crypto/sha256"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"
)

type SessionStore struct {
	mu       sync.Mutex
	sessions map[string]time.Time
	filePath string
}

var globalSessions = &SessionStore{
	sessions: make(map[string]time.Time),
	filePath: "/etc/qmanager/sessions.json",
}

// LoadSessionsFromDisk is called at startup to restore persisted sessions.
func LoadSessionsFromDisk() {
	globalSessions.loadFromDisk()
}

// loadFromDisk restores persisted sessions after a modem reboot so "remember
// me" logins survive restarts. Call once at startup.
func (ss *SessionStore) loadFromDisk() {
	data, err := os.ReadFile(ss.filePath)
	if err != nil {
		return // no persisted sessions (or first boot) — fine
	}
	var saved map[string]int64
	if json.Unmarshal(data, &saved) != nil {
		return
	}
	now := time.Now()
	ss.mu.Lock()
	defer ss.mu.Unlock()
	for tok, exp := range saved {
		if time.Unix(exp, 0).After(now) {
			ss.sessions[tok] = time.Unix(exp, 0)
		}
	}
}

// persist writes the current session map to disk so remembered sessions
// survive modem reboots.
func (ss *SessionStore) persist() {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	saved := make(map[string]int64, len(ss.sessions))
	now := time.Now()
	for tok, exp := range ss.sessions {
		if exp.After(now) {
			saved[tok] = exp.Unix()
		}
	}
	data, err := json.Marshal(saved)
	if err != nil {
		return
	}
	tmp := ss.filePath + ".tmp"
	if os.WriteFile(tmp, data, 0600) == nil {
		_ = os.Rename(tmp, ss.filePath)
	}
}

// issueSession creates a session token with the given lifetime, persists it,
// and sets both cookies.
func (ss *SessionStore) issueSession(w http.ResponseWriter, lifetime time.Duration) {
	token := generateToken()
	expiry := time.Now().Add(lifetime)

	ss.mu.Lock()
	ss.sessions[token] = expiry
	ss.mu.Unlock()
	ss.persist()

	http.SetCookie(w, &http.Cookie{
		Name:     "qmanager_session",
		Value:    token,
		Path:     "/",
		Expires:  expiry,
		HttpOnly: true,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "qm_logged_in",
		Value:    "1",
		Path:     "/",
		Expires:  expiry,
		HttpOnly: false,
	})
}

type LoginRequest struct {
	Password string `json:"password"`
	// Remember extends the session to 30 days (persisted across reboots).
	// When false, the session lasts until the browser closes.
	Remember bool `json:"remember"`
}

const authConfigPath = "/etc/qmanager/auth.json"

// verifyPassword checks password against /etc/qmanager/auth.json using the
// same scheme as the original QManager: sha256(salt + password) hex digest.
// Falls back to "admin" when the auth file does not exist.
func (s *Server) verifyPassword(password string) bool {
	data, err := os.ReadFile(authConfigPath)
	if err != nil {
		return password == "admin"
	}
	var auth struct {
		Hash string `json:"hash"`
		Salt string `json:"salt"`
	}
	if json.Unmarshal(data, &auth) != nil || auth.Salt == "" || auth.Hash == "" {
		return password == "admin"
	}
	sum := sha256.Sum256([]byte(auth.Salt + password))
	return hex.EncodeToString(sum[:]) == auth.Hash
}

type LoginResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// HandleAuthLogin handles POST login requests and issues session cookies
func (s *Server) HandleAuthLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		_ = json.NewEncoder(w).Encode(LoginResponse{
			Success: false,
			Error:   "missing_password",
		})
		return
	}

	// Verify against /etc/qmanager/auth.json (sha256(salt+password)) so the
	// real QManager password works. Falls back to "admin" only when the
	// auth file is missing (first-boot default).
	if !s.verifyPassword(req.Password) {
		_ = json.NewEncoder(w).Encode(LoginResponse{
			Success: false,
			Error:   "invalid_password",
		})
		return
	}

	// Generate session token — 30 days when "remember me" is checked,
	// otherwise a browser-session cookie (expires on close).
	if req.Remember {
		globalSessions.issueSession(w, 30*24*time.Hour)
	} else {
		globalSessions.issueSession(w, 24*time.Hour)
	}

	_ = json.NewEncoder(w).Encode(LoginResponse{
		Success: true,
	})
}

// HandleAuthLogout invalidates the session cookies
func (s *Server) HandleAuthLogout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cookie, err := r.Cookie("qmanager_session")
	if err == nil && cookie.Value != "" {
		globalSessions.mu.Lock()
		delete(globalSessions.sessions, cookie.Value)
		globalSessions.mu.Unlock()
		globalSessions.persist()
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "qmanager_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "qm_logged_in",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: false,
	})

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// HandleAuthCheck verifies if the current session is valid
func (s *Server) HandleAuthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cookie, err := r.Cookie("qmanager_session")
	if err != nil || cookie.Value == "" {
		http.SetCookie(w, &http.Cookie{
			Name:     "qm_logged_in",
			Value:    "",
			Path:     "/",
			Expires:  time.Unix(0, 0),
			HttpOnly: false,
		})
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": false})
		return
	}

	globalSessions.mu.Lock()
	expiry, exists := globalSessions.sessions[cookie.Value]
	globalSessions.mu.Unlock()

	if !exists || time.Now().After(expiry) {
		http.SetCookie(w, &http.Cookie{
			Name:     "qm_logged_in",
			Value:    "",
			Path:     "/",
			Expires:  time.Unix(0, 0),
			HttpOnly: false,
		})
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": false})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": true})
}

// isAuthenticated reports whether the request carries a valid session cookie.
func isAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie("qmanager_session")
	if err != nil || cookie.Value == "" {
		return false
	}
	globalSessions.mu.Lock()
	expiry, exists := globalSessions.sessions[cookie.Value]
	globalSessions.mu.Unlock()
	return exists && time.Now().Before(expiry)
}

// RequireAuth wraps a HandlerFunc, rejecting unauthenticated requests with 401.
// All QManager endpoints except auth/login, auth/check and the public health
// endpoints must go through this middleware — without it anyone on the LAN can
// execute raw AT commands (send_command.sh), reboot the modem (reboot.sh) or
// read device data (sms.sh, imei.sh, profiles). This closes the zero-auth
// remote code/DoS vector found in the 2026-08-29 audit.
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isAuthenticated(r) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "unauthorized",
				"message": "Valid session required. Please log in.",
			})
			return
		}
		next(w, r)
	}
}

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

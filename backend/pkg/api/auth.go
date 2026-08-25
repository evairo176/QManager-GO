package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type SessionStore struct {
	mu       sync.Mutex
	sessions map[string]time.Time
}

var globalSessions = &SessionStore{
	sessions: make(map[string]time.Time),
}

type LoginRequest struct {
	Password string `json:"password"`
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

	expectedPass := "admin" // Default fallback password for QManager
	if req.Password != expectedPass {
		_ = json.NewEncoder(w).Encode(LoginResponse{
			Success: false,
			Error:   "invalid_password",
		})
		return
	}

	// Generate session token
	token := generateToken()
	globalSessions.mu.Lock()
	globalSessions.sessions[token] = time.Now().Add(24 * time.Hour)
	globalSessions.mu.Unlock()

	// 1. Secure HTTP-only session cookie for backend auth verification
	http.SetCookie(w, &http.Cookie{
		Name:     "qmanager_session",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
	})

	// 2. Client-accessible indicator cookie for Next.js AuthGate (document.cookie)
	http.SetCookie(w, &http.Cookie{
		Name:     "qm_logged_in",
		Value:    "1",
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: false,
	})

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

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

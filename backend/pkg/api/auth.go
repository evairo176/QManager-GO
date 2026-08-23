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

type PasswordChangeRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// HandleAuthLogin processes login requests
func (s *Server) HandleAuthLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "missing_password",
		})
		return
	}

	// Default admin password or check stored hash
	if req.Password != "admin" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "invalid_password",
		})
		return
	}

	token := generateToken()
	globalSessions.mu.Lock()
	globalSessions.sessions[token] = time.Now().Add(24 * time.Hour)
	globalSessions.mu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     "qmanager_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   token,
	})
}

// HandleAuthLogout destroys session
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
		MaxAge:   -1,
		HttpOnly: true,
	})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// HandleAuthCheck verifies session status
func (s *Server) HandleAuthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cookie, err := r.Cookie("qmanager_session")
	if err != nil || cookie.Value == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": false})
		return
	}

	globalSessions.mu.Lock()
	expiry, exists := globalSessions.sessions[cookie.Value]
	globalSessions.mu.Unlock()

	if !exists || time.Now().After(expiry) {
		json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": false})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": true})
}

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

package api

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type clientLimiter struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

type IPRateLimiter struct {
	mu         sync.Mutex
	clients    map[string]*clientLimiter
	rate       float64 // tokens per second
	burst      int
	cleanupTTL time.Duration
}

func NewIPRateLimiter(ratePerSec float64, burst int) *IPRateLimiter {
	limiter := &IPRateLimiter{
		clients:    make(map[string]*clientLimiter),
		rate:       ratePerSec,
		burst:      burst,
		cleanupTTL: 10 * time.Minute,
	}

	// Periodic cleanup goroutine for stale client entries
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			limiter.cleanup()
		}
	}()

	return limiter
}

func (l *IPRateLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	client, exists := l.clients[ip]
	if !exists {
		client = &clientLimiter{
			tokens:     float64(l.burst) - 1.0,
			maxTokens:  float64(l.burst),
			refillRate: l.rate,
			lastRefill: now,
		}
		l.clients[ip] = client
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := now.Sub(client.lastRefill).Seconds()
	client.tokens += elapsed * client.refillRate
	if client.tokens > client.maxTokens {
		client.tokens = client.maxTokens
	}
	client.lastRefill = now

	if client.tokens >= 1.0 {
		client.tokens -= 1.0
		return true
	}

	return false
}

func (l *IPRateLimiter) cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for ip, client := range l.clients {
		if now.Sub(client.lastRefill) > l.cleanupTTL {
			delete(l.clients, ip)
		}
	}
}

// RateLimitMiddleware wraps a HandlerFunc with IP-based rate limiting
func RateLimitMiddleware(limiter *IPRateLimiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		if !limiter.Allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "5")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":   "rate_limit_exceeded",
				"message": "Too many requests. Please slow down.",
			})
			return
		}
		next(w, r)
	}
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

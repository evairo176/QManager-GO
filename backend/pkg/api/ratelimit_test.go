package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter(t *testing.T) {
	// 2 tokens per sec, burst 2
	limiter := NewIPRateLimiter(2.0, 2)

	ip := "192.168.1.100"

	// First request should be allowed (token = 1)
	if !limiter.Allow(ip) {
		t.Errorf("Expected first request to be allowed")
	}

	// Second request should be allowed (token = 0)
	if !limiter.Allow(ip) {
		t.Errorf("Expected second request to be allowed")
	}

	// Third request immediately after should be blocked (token < 1)
	if limiter.Allow(ip) {
		t.Errorf("Expected third immediate request to be blocked")
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	limiter := NewIPRateLimiter(1.0, 1)

	handler := RateLimitMiddleware(limiter, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	req1 := httptest.NewRequest("GET", "/test", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	rr1 := httptest.NewRecorder()
	handler(rr1, req1)

	if rr1.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr1.Code)
	}

	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "10.0.0.1:12345"
	rr2 := httptest.NewRecorder()
	handler(rr2, req2)

	if rr2.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", rr2.Code)
	}
}

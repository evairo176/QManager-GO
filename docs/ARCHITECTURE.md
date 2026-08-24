# QManager Go Edition Architecture

This document describes the overall system architecture, data flow patterns, and key design decisions in QManager Go Edition.

---

## System Overview

QManager Go Edition is a single, standalone binary application (`qmanager-core`):

1. **Frontend** — A statically-exported Next.js 16 (React 19) SPA embedded directly into the Go executable using `//go:embed all:out`. Served over HTTP (port 80) and Auto-TLS HTTPS (port 443).
2. **Backend Engine (`qmanager-core`)** — Compiled Go application containing native in-memory HTTP API routing (`pkg/api`), thread-safe AT command execution (`pkg/at`), native modem operations (`pkg/modem`), background poller goroutine (`pkg/daemon`), and auto X.509 certificate generator (`pkg/tlsgen`).

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (Client)                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │       Next.js 16 SPA (Embedded inside Binary)       │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │Dashboard│ │ Cellular │ │ Network  │ │Monitor │ │ │
│  │  │ Cards   │ │ Settings │ │ Settings │ │& Alerts│ │ │
│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │ │
│  │       └──────┬─────┴────────────┴───────────┘      │ │
│  │              │  authFetch() — cookies auto-sent     │ │
│  └──────────────┼──────────────────────────────────────┘ │
└─────────────────┼────────────────────────────────────────┘
                  │ HTTP / HTTPS (Port 80 / 443)
                  ▼
┌──────────────────────────────────────────────────────────┐
│             OpenWRT / Linux Device (Server)              │
│  ┌──────────────────────────────────────────────────────┐│
│  │             qmanager-core (Go Executable)            ││
│  │  ┌────────────────────────────────────────────────┐  ││
│  │  │  net/http Mux → Native In-Memory API Handlers  │  ││
│  │  └───────────────────────┬────────────────────────┘  ││
│  │                          │                            ││
│  │        AT Mutex Client   │ Reads / Writes State       ││
│  │    (sync.Mutex + flock)  │                            ││
│  │              │           ▼                            ││
│  │              ▼    /tmp/qmanager_status.json           ││
│  │        /dev/smd11         ▲                           ││
│  │    (modem serial port)    │ Background Goroutine      ││
│  │                      Poller (5s interval)             ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

## Package Architecture (`backend/pkg/`)

- **`cmd/server/main.go`**: Application entrypoint. Configures HTTP/HTTPS listeners, initializes AT client, starts background poller daemon, and registers API handlers.
- **`pkg/api/`**: REST API route handlers for authentication, status, band locking, tower locking, SMS, APN, settings, and health check.
- **`pkg/at/`**: Thread-safe AT command executor interface and client (`Client` & `MockClient`) utilizing dual lock (`sync.Mutex` and `/tmp/qmanager_at.lock`).
- **`pkg/daemon/`**: Non-blocking background status poller running continuously as a Go routine.
- **`pkg/modem/`**: Native modem manager packages (`BandManager`, `TowerManager`, `SMSManager`).
- **`pkg/tlsgen/`**: Automatic ECDSA self-signed certificate generator with IP SANs.
- **`web/`**: `embed.FS` wrapper serving static Next.js assets with single-page-app fallback routing.

---

## Data Flow & Mutex Safety

1. **Poller Daemon**: Every 5 seconds, `pkg/daemon/poller.go` executes `AT+QENG="servingcell"` and updates `/tmp/qmanager_status.json` atomically.
2. **API Requests**: Frontend calls `/cgi-bin/quecmanager/*` endpoints, which hit native Go functions in `pkg/api/` (sub-15ms latency).
3. **AT Safety**: All AT operations pass through `at.Client.Exec()`, acquiring `sync.Mutex` and file flock to prevent serial buffer corruption or collision.

# QManager Go Backend Guide

This document covers the Go backend architecture (`qmanager-core`), package layout, testing conventions, and AT command safety mechanisms.

---

## Backend Overview

The backend is written in **Go 1.24** and compiled into a single static executable (`qmanager-core`). It runs directly on Linux / OpenWRT modem hosts without requiring subshell interpreters, Lighttpd, or uhttpd.

### Package Layout (`backend/`)

```
backend/
├── cmd/
│   └── server/
│       └── main.go          → Server entrypoint & route registration
├── pkg/
│   ├── api/                 → HTTP API handlers (/cgi-bin/quecmanager/*)
│   ├── at/                  → Thread-safe AT command executor & mock client
│   ├── daemon/              → Background status poller goroutine
│   ├── modem/               → Native modem managers (bands, tower, sms)
│   └── tlsgen/              → Auto ECDSA self-signed TLS cert generator
├── web/
│   └── web.go               → //go:embed all:out Next.js static asset server
└── qmanager-core.service    → Systemd service unit file
```

---

## Core Principles

1. **Zero Subshell Spawning**: All HTTP requests are served in-memory by native Go `net/http` handlers (< 15ms latency).
2. **Thread-Safe AT Execution**: Serial AT communication is guarded by `sync.Mutex` and `/tmp/qmanager_at.lock` to prevent command collisions.
3. **Mock AT Harness for Testing**: `at.MockClient` simulates modem responses, allowing 100% of unit tests to run in CI/CD without physical modem hardware.
4. **Auto TLS Cert Generator**: Self-signed X.509 ECDSA certificates are generated automatically on startup covering all active local network interface IPs.

---

## Running Unit Tests

Run package unit tests locally:

```bash
cd backend
go test -v ./...
```

Calculate test coverage:

```bash
cd backend
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

---

## Building Executables

Cross-compile for all target architectures using `build-go.sh`:

```bash
./build-go.sh
```

- **ARMv7 (32-bit)**: `GOOS=linux GOARCH=arm GOARM=7` (Quectel RM520N, RM551E)
- **ARM64 (64-bit)**: `GOOS=linux GOARCH=arm64` (Raspberry Pi 4/5, ARM64 Routers)
- **AMD64 (x86_64)**: `GOOS=linux GOARCH=amd64` (PC, X86 Routers, VMs)

# 📜 Changelog

All notable changes to the **QManager Go Edition** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.2.2-go] - 2026-08-24

### 🚀 Added & Enhanced
- **Real-Time Telemetry via Server-Sent Events (SSE)** (`pkg/api/sse.go` & `use-sse-telemetry.ts`): Replaced 1s HTTP polling with high-performance, low-overhead SSE push stream (`/cgi-bin/quecmanager/api/stream/status`).
- **Built-In Native Speedtest Engine** (`pkg/speedtest/speedtest.go` & `speedtest-card.tsx`): Native Go multi-threaded HTTP latency, download, and upload throughput tester.
- **Native nftables & DPI Rules Manager** (`pkg/firewall/firewall.go`): Native rule generator and file manager for `/etc/nftables.d/12-mangle-qmanager-dpi.nft` supporting NFQUEUE 200 packet inspection and TTL mangle modification.
- **Dual-SIM & eSIM Manager** (`pkg/modem/sim.go` & `sim-slot-card.tsx`): Hardware SIM slot query (`AT+QUIMSLOT?`), slot switching (`AT+QUIMSLOT=1/2`), and ICCID parser (`AT+QCCID`).
- **AES-256-GCM Encrypted Backup & Restore** (`pkg/backup/backup.go`): PBKDF2 (SHA-256) password-protected encryption for `.qmbackup` configuration archives.
- **In-Memory Token Bucket Rate Limiter & Brute-Force Guard** (`pkg/api/ratelimit.go`): Protected login and serial AT command execution against brute-force and flooding attacks.
- **Native Watchdog Goroutine** (`pkg/daemon/watchdog.go`): Non-blocking TCP/HTTP connectivity probe goroutine updating system watchdog status without external shell scripts.
- **OpenWRT UCI Native Go Parser** (`pkg/uci/uci.go`): Zero-dependency thread-safe UCI config parser and serializer.

### 🛠️ Changed & Optimized
- **GitHub Actions CI Optimization**: Added Bun store caching, Next.js `.next/cache` restoration, and `concurrency` cancellation, reducing workflow run times by ~60%.
- **Upstream Repository & Language Pack Routing**: Repointed all OTA update daemons, bootstrap installer (`qmanager-installer.sh`), and i18n language pack manifests to `latifangren/QManager-GO`.

## [v0.2.1-go] - 2026-08-24

### 🛠️ Changed & Refactored
- **Native `src/` Directory Layout**: Migrated all Next.js frontend code (`app/`, `components/`, `hooks/`, `lib/`, `types/`, `constants/`) into standard `src/` directory with clean `@/*` path mapping in `tsconfig.json` & `components.json`.
- **Root Repository Organization**: Organized multi-language READMEs to `docs/readme/`, design specifications to `docs/design/`, release logs to `docs/releases/`, dev scripts to `scripts/dev/`, and language pack manifest to `docs/language-packs/`.
- **Core Documentation Sync**: Updated `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/BACKEND.md`, and `docs/DEPLOYMENT.md` to accurately reflect single-binary Go architecture (`qmanager-core`).

## [v0.2.0-go] - 2026-08-24

### 🚀 Added
- **Native Go Core Engine (`qmanager-core`)**: Replaced lighttpd, shell CGI handlers, and process subshell spawning with a single compiled Go binary (`qmanager-core`).
- **Single-Binary SPA Embedding (`embed.FS`)**: Embedded Next.js 16 static export frontend directly into `qmanager-core` binary with disk fallback via `WEB_ROOT` environment variable.
- **Auto TLS/HTTPS Certificate Generator (`tlsgen`)**: Created package `backend/pkg/tlsgen` to automatically generate X.509 ECDSA P-256 self-signed SSL/TLS certificates for local modem IP addresses on HTTPS port 443 out-of-the-box.
- **1-Click Workstation Deployment Tooling**: Created `deploy.sh` (POSIX Bash/macOS/Linux) and `deploy.ps1` (PowerShell/Windows) for single-command modem flashing over SSH or ADB.
- **5G NR Subcarrier Spacing (SCS) Support**: Implemented automatic SCS parsing (15, 30, 60, 120 kHz) in `AT+QSCAN` cell survey parsing and formatted `AT+QNWLOCK="common/5g"` cell locks with valid SCS to prevent modem command rejections.
- **GitHub Actions Workflows**: Added modular CI/CD workflows modeled after `BFR-WEBUI-GO`:
  - `.github/workflows/quality.yml`: `go test` unit testing & `golangci-lint` verification.
  - `.github/workflows/release.yml`: Automated Next.js UI export + Go ARMv7 cross-compilation + tarball packaging (`qmanager-core-armv7.tar.gz`) + GitHub Release publishing on tag push.
  - `.github/workflows/cleanup.yml`: Weekly workflow run & actions cache purge.
  - `.github/workflows/codeql.yml`: Weekly CodeQL static security scans for Go and TypeScript.
- **Thread-Safe Dual AT Engine**: Serial mutex (`sync.Mutex`) + file lock (`/tmp/qmanager_at.lock`) with mock fallback for local non-modem testing environments.
- **Asynchronous Status Poller Goroutine**: Non-blocking background status collector updating state atomics every 5 seconds without `fork()` overhead.
- **100% CGI Route Compatibility**: Implemented Go HTTP handlers for Auth (`login.sh`, `check.sh`, `logout.sh`), Modem Status (`fetch_data.sh`, `send_command.sh`), Bands (`current.sh`, `lock.sh`), SMS Inbox/Send/Delete, Settings, Data Usage Counter (`/proc/net/dev`), History Charts (NDJSON), Tower Lock, APN Management, Custom SIM Profiles, Monitoring Alerts & Watchdog, Tailscale VPN, Health Checks, and Language Packs.

### 🛠️ Changed
- **60-70% RAM Footprint Reduction**: Reduced modem memory usage down to **~12 – 18 MB RAM** (vs 80+ MB on legacy shell CGI stack).
- **Sub-15ms API Response Latency**: Replaced subshell execution with native Go `net/http` in-memory routing.
- **Cleaned Git Tracking**: Configured `.gitignore` to exclude temporary `backend/web/out/*` build artifacts, preserving clean working tree in GitHub Desktop.
- **Synced Upstream Universal Branching**: Aligned primary default branch to `development-home` (Universal QManager Edition).

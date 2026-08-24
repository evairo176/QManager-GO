# 🚀 QManager Go Edition v0.2.2-go

QManager Go Edition v0.2.2-go brings 5 core enterprise Go backend engines, real-time Server-Sent Events (SSE) telemetry streaming, built-in Speedtest, native nftables DPI packet inspection, Dual-SIM slot switching, AES-256-GCM encrypted backup/restore, and optimized CI automation.

## ✨ New Features

- **Real-Time Telemetry via Server-Sent Events (SSE)**: High-performance push stream (`/cgi-bin/quecmanager/api/stream/status`) replacing 1s HTTP polling with zero subshell overhead.
- **Built-In Speedtest Engine**: Native Go multi-threaded HTTP latency, download, and upload throughput test suite (`/cgi-bin/quecmanager/network/speedtest.sh`) with interactive UI card (`speedtest-card.tsx`).
- **Native nftables & DPI Rules Manager**: Native rule generator for `/etc/nftables.d/12-mangle-qmanager-dpi.nft` supporting NFQUEUE 200 packet inspection and TTL mangle modification.
- **Dual-SIM & eSIM Manager**: Hardware SIM slot query (`AT+QUIMSLOT?`), slot switching (`AT+QUIMSLOT=1/2`), ICCID parser (`AT+QCCID`), and interactive switcher widget (`sim-slot-card.tsx`).
- **AES-256-GCM Encrypted Backup & Restore**: Password-protected authenticated encryption for `.qmbackup` configuration archives using PBKDF2 (SHA-256).
- **In-Memory Rate Limiter**: IP-based token bucket rate limiter middleware protecting login brute-force and serial AT command flooding.
- **Native Watchdog Goroutine**: Non-blocking TCP/HTTP connectivity probe goroutine updating watchdog status cleanly.
- **OpenWRT UCI Native Parser**: Zero-dependency thread-safe OpenWRT `/etc/config/*` parser and serializer.

## ✅ Improvements

- **CI Caching & Performance**: Next.js `.next/cache` restoration, Bun store caching, and concurrency control reducing CI run times by ~60%.
- **Upstream Release & Language Pack Routing**: Repointed all OTA update daemons, bootstrap installer (`qmanager-installer.sh`), and i18n language pack manifests to `latifangren/QManager-GO`.

## 📥 Installation

```bash
# Workstation Flashing (Bash)
./deploy.sh 192.168.225.1

# Workstation Flashing (PowerShell)
.\deploy.ps1 -Target "192.168.225.1"
```

## 💙 Thank You

Thank you to all contributors and community members!

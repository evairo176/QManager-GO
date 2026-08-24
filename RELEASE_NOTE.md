# 🚀 QManager Go Edition v0.2.0-go

QManager Go Edition v0.2.0-go introduces a complete architectural rewrite of the backend into a standalone, single Go executable (`qmanager-core`). Memory footprint is reduced by 60-70% (~12 MB RAM), API response latency is brought under 15ms, and the Next.js 16 SPA frontend is embedded directly into the binary with built-in Auto TLS/HTTPS support.

## ✨ New Features

- **Single Binary Core (`qmanager-core`)**: Complete Go rewrite replacing legacy shell CGI scripts with native `net/http` handlers and embedded Next.js 16 frontend (`//go:embed all:out`).
- **Auto TLS/HTTPS (`tlsgen`)**: Automatic ECDSA P-256 self-signed X.509 certificate generation with IP SANs (`127.0.0.1`, `192.168.225.1`, local LAN IPs) out of the box on port 443.
- **Thread-Safe Dual AT Mutex Engine**: In-memory `sync.Mutex` combined with file locking (`/tmp/qmanager_at.lock`) ensuring 100% collision-free AT command execution on `/dev/smd11` or serial ports.
- **5G NR SCS Support**: Complete parsing and formatting of Subcarrier Spacing (15, 30, 60, 120 kHz) in `AT+QSCAN` and `AT+QNWLOCK="common/5g"`.
- **1-Click Workstation Flashing**: `deploy.sh` (Linux/macOS) and `deploy.ps1` (PowerShell/Windows) for single-command flashing over SSH or ADB.
- **Multi-Architecture Support**: Native cross-compilation for ARMv7 (`RM520N`), ARM64, and AMD64 via `./build-go.sh`.

## ✅ Improvements

- **RAM Footprint**: Reduced from 80+ MB down to ~12 – 18 MB RAM.
- **Latency**: API response latency reduced from 120ms+ to < 15ms.
- **Zero Subshell Spawning**: Completely eliminated BusyBox subshell `fork()` overhead during API queries.

## 📥 Installation

### 1-Click Workstation Flashing (SSH / ADB)

```bash
# Linux / macOS / Git Bash
./deploy.sh 192.168.225.1

# PowerShell (Windows)
.\deploy.ps1 -Target "192.168.225.1"
```

## 💙 Thank You

Thank you to the community for testing and supporting the QManager Go Edition rewrite!

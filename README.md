# QManager — Universal Go Edition 🚀

<div align="center">
  <img src="public/qmanager-logo.svg" alt="QManager Logo" width="120" />
  <h3>Universal, High-Performance Go-Powered GUI & Core for Cellular Modem Management</h3>
  <p>Visualize, configure, and optimize Quectel & Universal cellular modems with an ultra-lightweight Go backend and React 19 UI</p>

  ![Version](https://img.shields.io/badge/version-v0.2.0--go-blue?style=flat-square)
  ![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=flat-square)
  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
  ![License](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-green?style=flat-square)
  ![Platform](https://img.shields.io/badge/platform-Universal%20Linux%20%7C%20OpenWRT%20%7C%20RM520N-orange?style=flat-square)
  ![Architecture](https://img.shields.io/badge/arch-ARMv7%20%7C%20ARM64%20%7C%20x86__64-purple?style=flat-square)
</div>

---

<div align="center">
  <img src="docs/screenshots/dashboard.png" alt="QManager Dashboard Screenshot" width="900" />
</div>

---

## ⚡ QManager Go Edition Architectural Revolution

QManager Go Edition replaces legacy `lighttpd`, CGI Bash scripts, and heavy process spawning with a **single, standalone compiled Go binary (`qmanager-core`)**. The Next.js 16 SPA frontend is embedded directly into the executable using Go's `embed.FS`, delivering an enterprise-grade cellular modem management engine.

### 🌟 Key Performance Improvements

- 🚀 **60-70% Memory Reduction** — Uses only **~12 – 18 MB RAM** (down from 80+ MB required by lighttpd + CGI subshells).
- ⚡ **Sub-15ms API Response Latency** — Native Go `net/http` in-memory routing eliminates subshell `fork()` overhead.
- 🔒 **Auto TLS/HTTPS Encryption (`tlsgen`)** — Native X.509 ECDSA self-signed certificate generator on port 443 out-of-the-box.
- 🛡️ **Thread-Safe Dual AT Mutex Engine** — Dual memory lock (`sync.Mutex`) + file lock (`/tmp/qmanager_at.lock`) guarantees zero AT command collision or serial buffer corruption on `/dev/smd11` / `/dev/ttyUSB*`.
- 📦 **Single Executable Deployment** — Embedded Next.js SPA UI inside `qmanager-core` via `embed.FS` with disk fallback via `WEB_ROOT`.
- ⏱️ **Asynchronous Poller Goroutine** — Non-blocking background status collector updating state atomics every 5 seconds.
- 📦 **1-Click Workstation Flashing** — Native `deploy.sh` (Bash/Linux/macOS) and `deploy.ps1` (PowerShell/Windows) for single-command modem flashing over SSH or ADB.

---

## 📊 Legacy Shell CGI vs QManager Go Edition

| Feature / Metric | 🐌 Legacy Shell CGI (`lighttpd`) | 🚀 QManager Go Edition (`qmanager-core`) |
| :--- | :--- | :--- |
| **Backend Architecture** | Lighttpd + 80+ Bash CGI Scripts | **Single Standalone Go Binary (`qmanager-core`)** |
| **RAM Footprint** | 80 MB – 120 MB | **~12 MB – 18 MB** (60-70% Savings) |
| **API Latency** | 120ms – 400ms (High Subshell Overhead) | **< 15ms** (Native In-Memory Handlers) |
| **Process Spawning** | 10–30 `fork()` per request | **0 Subshells** (100% In-Process) |
| **AT Command Safety** | Basic shell flock (prone to leaks) | **Dual Lock**: `sync.Mutex` + `/tmp/qmanager_at.lock` |
| **HTTPS Support** | Requires manual OpenSSL / Lighttpd config | **Built-in Auto TLS Cert Generator (`tlsgen`)** |
| **Deployment Method** | Manual SCP + multi-file file unpack | **1-Click Flashing** via `deploy.sh` / `deploy.ps1` |

---

## 🛠️ Comprehensive Feature Suite

### 📡 Signal & Antenna Monitoring
- **Live Signal Dashboard** — Real-time RSRP, RSRQ, SINR, RSSI with per-antenna 4x4 MIMO values (Main/PRX, Diversity/DRX, MIMO 3/RX2, MIMO 4/RX3).
- **Antenna Statistics** — Detailed signal breakdown per antenna port with visual quality metrics.
- **Antenna Alignment Tool** — 3-position recording console comparing composite signal scores to find optimal physical antenna placement.
- **Carrier Aggregation (CA)** — Active CA component list (`AT+QCAINFO`) displaying band, bandwidth, and SCC state.
- **Historical Signal & Latency Charts** — 30-minute signal history and 24-hour ping latency/jitter/loss stored in NDJSON.
- **Traffic Engine** — Real-time throughput (Mbps) and cumulative usage from `/proc/net/dev`.

### 🔒 Cellular & Tower Locking
- **Band Locking** — Select and lock specific LTE and 5G NR bands (`AT+QNWPREFCFG`) with automatic failover recovery.
- **Tower Locking** — Lock to specific cell towers by PCI (`AT+QNWLOCK`) for 4G LTE and 5G NR SA.
- **5G NR SCS Support** — Automatic inference and parsing of Subcarrier Spacing (SCS: 15, 30, 60, 120 kHz) from `AT+QSCAN` for valid 5G NR cell locks.
- **Frequency Channel Locking** — Lock to exact EARFCN (LTE) and ARFCN (5G NR) channels.
- **APN PDP Management** — Manage PDP contexts, auth types, MNO presets, and MBN profiles.
- **IMEI Settings** — Query, backup, and configure device IMEI (`AT+EGMR`).

### ⚙️ SIM Profiles & Automation
- **Custom SIM Profiles** — Create per-operator profiles that auto-apply upon SIM swap based on ICCID matching.
- **Connection Scenarios & Schedule** — Time-based schedule ribbon for band switching and tower locks.

### 🛡️ 24/7 Resilience & System Monitoring
- **Connection Watchdog** — 4-tier auto-recovery ladder (Ping target → Interface reset → CFUN cycle → Full reboot).
- **SMS Center** — Storage-aware inbox (ME/SM merged), SMS sending, bulk deletion, and **SMS Webhook Forwarding**.
- **Integrated Tailscale VPN** — Status monitoring and remote access management.
- **System Health Checks** — Automated diagnostic suite checking services, udev permissions, filesystem mounts, and AT channel responsiveness.

---

## 🛠️ Building QManager Go Edition

To build the complete single-executable binary (`qmanager-core`) containing the embedded Next.js frontend:

```sh
# Clone the repository
git clone https://github.com/latifangren/QManager-GO.git
cd QManager-GO

# Run the unified build pipeline
./build-go.sh
```

### What `build-go.sh` Does:
1. Installs frontend dependencies and exports Next.js static files (`out/`).
2. Copies static web assets into `backend/web/out/`.
3. Cross-compiles `qmanager-core` for Linux ARMv7 (`CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`).

**Output Executable:** `backend/dist/qmanager-core` (~14 MB standalone).

---

## 📦 1-Click Modem Deployment

Deploy `qmanager-core` and its systemd service directly from your workstation to your modem:

### From Linux / macOS / Git Bash:
```sh
# Deploy over SSH to modem (default IP: 192.168.225.1)
./deploy.sh 192.168.225.1

# Or deploy over ADB connection
./deploy.sh adb
```

### From Windows PowerShell:
```powershell
# Deploy over SSH
.\deploy.ps1 -Target "192.168.225.1"

# Or deploy over ADB
.\deploy.ps1 -Method "ADB"
```

---

## 📋 Manual Systemd Deployment on Device

If you prefer to deploy manually onto the modem/SBC:

1. Copy `qmanager-core` to `/usr/bin/qmanager-core` on the device:
   ```sh
   scp backend/dist/qmanager-core root@192.168.225.1:/usr/bin/qmanager-core
   ssh root@192.168.225.1 "chmod +x /usr/bin/qmanager-core"
   ```

2. Install systemd service unit:
   ```sh
   scp backend/qmanager-core.service root@192.168.225.1:/lib/systemd/system/qmanager-core.service
   ssh root@192.168.225.1 "systemctl daemon-reload && systemctl enable qmanager-core && systemctl start qmanager-core"
   ```

3. Access QManager Web UI:
   - **HTTP**: `http://192.168.225.1`
   - **HTTPS (Auto TLS)**: `https://192.168.225.1`

---

## 🌐 Supported REST API Endpoints

QManager Go Edition maintains 100% route compatibility with legacy CGI endpoints:

| Endpoint Path | Description |
| :--- | :--- |
| `/cgi-bin/quecmanager/auth/login.sh` | Authenticate user & issue session cookie |
| `/cgi-bin/quecmanager/auth/check.sh` | Verify current session validity |
| `/cgi-bin/quecmanager/at_cmd/fetch_data.sh` | Retrieve live modem status JSON |
| `/cgi-bin/quecmanager/at_cmd/send_command.sh` | Safely execute raw AT commands |
| `/cgi-bin/quecmanager/bands/current.sh` | Query active LTE & 5G NR band locks |
| `/cgi-bin/quecmanager/bands/lock.sh` | Apply LTE/5G band lock configuration |
| `/cgi-bin/quecmanager/cellular/sms.sh` | Storage-aware SMS list, send, and delete |
| `/cgi-bin/quecmanager/tower/lock.sh` | 4G & 5G NR SA Cell/Tower Locking |
| `/cgi-bin/quecmanager/frequency/lock.sh` | EARFCN/ARFCN Channel Locking |
| `/cgi-bin/quecmanager/network/data_used.sh` | Real-time byte counters & throughput |
| `/cgi-bin/quecmanager/system/reboot.sh` | Execute system or modem reboot |
| `/cgi-bin/quecmanager/health` | Go backend health check & system architecture |

---

## 💙 License & Acknowledgments

This project is licensed under the **[MIT License with Commons Clause](LICENSE)**.

- Built upon the foundations of **[QManager Universal](https://github.com/dr-dolomite/QManager)** by [DrDolomite](https://github.com/dr-dolomite).
- Inspired by concepts from **[QuecTool](https://github.com/snowzach/quectool)**.
- Go Backend & Single-Binary Architecture by [latifangren](https://github.com/latifangren).

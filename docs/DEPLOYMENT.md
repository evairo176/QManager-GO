# QManager Go Edition Deployment Guide

This document covers building, installing, and deploying QManager Go Edition (`qmanager-core`) onto Linux / OpenWRT modem hosts.

---

## 1-Click Workstation Flashing (Recommended)

Deploy `qmanager-core` and its systemd service directly from your workstation to your modem in one step over SSH or ADB.

### From Linux / macOS / Git Bash:

```bash
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

The workstation deployer automatically builds or validates the ARM binary, pushes `qmanager-core` to `/usr/bin/`, installs `/lib/systemd/system/qmanager-core.service`, and restarts the service.

---

## Building from Source

To compile the single-executable binary (`qmanager-core`) containing the embedded Next.js 16 SPA frontend:

```bash
# Run the multi-architecture build pipeline
./build-go.sh
```

**Compilation Targets (`backend/dist/`):**
- `qmanager-core-armv7` (Linux ARMv7 / Quectel RM520N, RM551E)
- `qmanager-core-arm64` (Linux ARM64 / Raspberry Pi 4/5, SBCs)
- `qmanager-core-amd64` (Linux AMD64 / x86 Routers, VMs)
- `qmanager-core` (Default alias ARMv7)

---

## Manual Systemd Deployment

To deploy manually on systemd-based modem carriers or Linux hosts:

1. **Copy binary executable**:
   ```bash
   scp backend/dist/qmanager-core root@192.168.225.1:/usr/bin/qmanager-core
   ssh root@192.168.225.1 "chmod +x /usr/bin/qmanager-core"
   ```

2. **Install Systemd Unit (`/lib/systemd/system/qmanager-core.service`)**:
   ```ini
   [Unit]
   Description=QManager Go Core Daemon
   After=network.target

   [Service]
   Type=simple
   ExecStart=/usr/bin/qmanager-core
   Restart=always
   RestartSec=5
   Environment=PORT=80
   Environment=TLS_PORT=443
   Environment=TLS_ENABLED=true
   StandardOutput=journal
   StandardError=journal
   LogRateLimitIntervalSec=30s
   LogRateLimitBurst=50

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable & Start Service**:
   ```bash
   ssh root@192.168.225.1 "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
   ```

4. **Verify Service Logs**:
   ```bash
   ssh root@192.168.225.1 "journalctl -u qmanager-core -f"
   ```

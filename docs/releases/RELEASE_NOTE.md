# 🚀 QManager Go Edition v0.2.3-go

QManager Go Edition v0.2.3-go introduces AT serial port auto-discovery, dynamic CPU architecture and init system detection (`systemd` vs `procd init.d`) in deployment tools, native OpenWRT init.d service support, and a comprehensive Hardware & Device Support matrix.

## ✨ New Features & Enhancements

- **AT Serial Port Auto-Discovery**: Dynamic auto-scan of candidate serial ports (`/dev/smd11` → `/dev/smd7` → `/dev/ttyUSB2` → `/dev/ttyUSB3` → `/dev/ttyUSB0` → `/dev/ttyACM0` → `/dev/cdc-wdm0`), making QManager Go zero-config on both internal modems and host routers.
- **Smart 1-Click Deployment Tooling**: `deploy.sh` and `deploy.ps1` now auto-detect target CPU architecture (`uname -m`) and init system (`systemd` vs OpenWRT `init.d`), pushing the exact matching binary and service script.
- **OpenWRT Procd Init Script**: Added `/etc/init.d/qmanager-core` for running `qmanager-core` seamlessly on OpenWRT devices without Systemd.
- **Hardware & Device Support Guide**: Created [`docs/HARDWARE-SUPPORT.md`](docs/HARDWARE-SUPPORT.md) detailing modem chipset compatibility (SDX55/62/65 vs SDX72/75), ARMv7 32-bit vs ARMv8/ARM64 64-bit parity, and On-Modem vs Host Router deployment modes.

## 📥 Installation

```bash
# Workstation Flashing (Bash)
./deploy.sh 192.168.225.1

# Workstation Flashing (PowerShell)
.\deploy.ps1 -Target "192.168.225.1"
```

## 💙 Thank You

Thank you to all contributors and community members!

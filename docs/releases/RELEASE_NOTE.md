# 🚀 QManager Go Edition v0.2.3-go

QManager Go Edition v0.2.3-go introduces AT serial port auto-discovery, dynamic CPU architecture and init system detection (`systemd` vs `procd init.d`) in deployment tools, native OpenWRT init.d service support, and a comprehensive Hardware & Device Support matrix.

## ✨ New Features & Enhancements

- **AT Serial Port Auto-Discovery**: Dynamic auto-scan of candidate serial ports (`/dev/smd11` → `/dev/smd7` → `/dev/ttyUSB2` → `/dev/ttyUSB3` → `/dev/ttyUSB0` → `/dev/ttyACM0` → `/dev/cdc-wdm0`), making QManager Go zero-config on both internal modems and host routers.
- **Smart 1-Click Deployment Tooling**: `deploy.sh` and `deploy.ps1` now auto-detect target CPU architecture (`uname -m`) and init system (`systemd` vs OpenWRT `init.d`), pushing the exact matching binary and service script.
- **OpenWRT Procd Init Script**: Added `/etc/init.d/qmanager-core` for running `qmanager-core` seamlessly on OpenWRT devices without Systemd.
- **Hardware & Device Support Guide**: Created [`docs/HARDWARE-SUPPORT.md`](https://github.com/latifangren/QManager-GO/blob/dev-go/docs/HARDWARE-SUPPORT.md) detailing modem chipset compatibility (SDX55/62/65 vs SDX72/75), ARMv7 32-bit vs ARMv8/ARM64 64-bit parity, and On-Modem vs Host Router deployment modes.

---

## 📦 Package Distribution & Hardware Details

Refer to the table below to select the appropriate binary or deployment method for your setup. For in-depth technical breakdowns, see the [Hardware Support Documentation](https://github.com/latifangren/QManager-GO/blob/dev-go/docs/HARDWARE-SUPPORT.md).

| Hardware Platform | Qualcomm Chipset | Operating System | Binary Executable | Target Modem / Host Devices |
| :--- | :--- | :--- | :--- | :--- |
| **ARMv7 32-bit (SDX55 / SDX62 / SDX65)** | SDX55, SDX62, SDX65 | Linux + Systemd | `qmanager-core-armv7.tar.gz` | **Quectel RM520N-GL**, RM500Q-GL, RM502Q-AE, RM521F-GL |
| **ARMv8 64-bit / ARM64 (SDX72 / SDX75)** | SDX72, SDX75 | Native OpenWRT (`init.d`) | `qmanager-core-arm64.tar.gz` | **Quectel RM551E-GL**, RM550E-GL, RG650V-EU |
| **Host Router & Gateways (ARM64)** | Any (Passthrough) | OpenWRT / Linux | `qmanager-core-arm64.tar.gz` | Raspberry Pi 4/5, NanoPi, GL.iNet, FriendlyWrt |
| **PC & Router Hardware (x86_64)** | Any (Passthrough) | Linux / OpenWRT x86 | `qmanager-core-amd64.tar.gz` | x86 Routers, Mini PCs, MikroTik CHR, Linux VMs |

---

## 📥 Installation & Deployment

### 1-Click Flashing (Recommended)

```bash
# Workstation Flashing via SSH (Linux / macOS / Git Bash)
./deploy.sh 192.168.225.1

# Workstation Flashing via ADB
./deploy.sh adb

# Workstation Flashing (Windows PowerShell)
.\deploy.ps1 -Target "192.168.225.1"
```

---

## 🔗 Quick Reference Links

- 📜 [Full Changelog](https://github.com/latifangren/QManager-GO/blob/dev-go/docs/releases/CHANGELOG.md)
- 📱 [Hardware Support Guide](https://github.com/latifangren/QManager-GO/blob/dev-go/docs/HARDWARE-SUPPORT.md)
- ⚙️ [System Architecture](https://github.com/latifangren/QManager-GO/blob/dev-go/docs/ARCHITECTURE.md)
- 🌐 [Language Packs Manifest](https://github.com/latifangren/QManager-GO/blob/dev-go/docs/language-packs/manifest.json)

---

## 💙 Thank You

Thank you to all contributors, testers, and community members! Bug reports and feature requests are welcome via GitHub Issues.

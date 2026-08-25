# 📱 Panduan Lengkap Dukungan Modem & Hardware (`QManager-GO`)

Dokumen ini disusun untuk membantu pengguna pemula maupun administrator dalam memahami kompatibilitas **QManager Go Edition (`qmanager-core`)** di berbagai jenis modem seluler Quectel, router, dan arsitektur CPU.

---

## ⚡ Arsitektur & Keunggulan QManager Go Edition

QManager Go Edition dibangun menggunakan bahasa **Go** yang dikompilasi menjadi **satu file biner tunggal (`qmanager-core`)**. Di dalamnya sudah tertanam antarmuka WebUI berbasis **Next.js 16 (React 19)** dan **Server API in-memory**.

### Mengapa QManager Go Edition Universal?
1. **0-Dependency**: Tidak membutuhkan web server external (`lighttpd`/`uhttpd`), PHP, Python, atau CLI runner external (`atcli_rust`).
2. **Support Systemd & OpenWRT `init.d`**: Otomatis mengenali apakah perangkat target menggunakan Linux Systemd atau OpenWRT Native.
3. **Multi-Architecture Binary**: Menyediakan biner terkompilasi untuk 32-bit ARM (`armv7l`), 64-bit ARM (`arm64`/`aarch64`), dan x86_64 (`amd64`).

---

## 📊 Matriks Kompatibilitas Modem & Perangkat Host

| Seri Modem / Device | Chipset Qualcomm | Platform Code | Arsitektur CPU | OS & Init System | Biner Binary Target | Lokasi Pemasangan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Quectel RM520N-GL / AA** | Qualcomm SDX62 | `sdxlemur` | **ARMv7l** (32-bit) | Linux + Systemd | `qmanager-core-armv7` | Internal Modem Storage |
| **Quectel RM500Q-GL / RM502Q** | Qualcomm SDX55 | `sdxprairie` | **ARMv7l** (32-bit) | Linux + Systemd | `qmanager-core-armv7` | Internal Modem Storage |
| **Quectel RM521F-GL / RM530N** | Qualcomm SDX65 | `sdxlemur` | **ARMv7l** (32-bit) | Linux + Systemd | `qmanager-core-armv7` | Internal Modem Storage |
| **Quectel RM551E-GL / RM550E** | Qualcomm SDX75 | `sdxpinn` | **ARMv8 / ARM64** | OpenWRT (`init.d`) | `qmanager-core-arm64` | Internal Modem Storage |
| **Quectel RG650V-EU / NA** | Qualcomm SDX75 | `sdxpinn` | **ARMv8 / ARM64** | OpenWRT (`init.d`) | `qmanager-core-arm64` | Internal Modem Storage |
| **Modem Non-SoC** (DW5821e, T99W175, MV31) | Qualcomm X55/X62 | - | Sesuai Host | OpenWRT / Linux | Sesuai Host | **Host Router / Mini PC** |
| **Raspberry Pi 4 / 5 / NanoPi** | Broadcom / RK | - | **ARM64** (`aarch64`) | OpenWRT / Ubuntu | `qmanager-core-arm64` | **Host Router** |
| **Router x86 / Mini PC / VM** | Intel / AMD | - | **x86_64** (`amd64`) | OpenWRT x86 / Debian | `qmanager-core-amd64` | **Host Router** |

---

## 🔍 Penjelasan Perbedaan Arsitektur & Istilah

### 1. Apakah ARMv8 sama dengan ARM64?
**Ya, 100% Sama.**
- **ARMv8** adalah nama instruksi arsitektur hardware dari ARM (64-bit generation).
- **ARM64** (atau `aarch64`) adalah nama sebutan arsitektur tersebut dalam sistem operasi Linux, OpenWRT, dan Go compiler (`GOARCH=arm64`).

### 2. Pemasangan di Dalam Modem (On-Modem / Embedded) vs Di Luar Modem (Host Router)
- **Embedded / On-Modem**: Modem Quectel seri RM/RG (RM520N, RM551E, dll) memiliki Linux OS dan storage internal sendiri. `qmanager-core` dipasang **langsung di dalam modem** melalui koneksi SSH atau ADB.
- **Host Router (Modem Non-SoC)**: Modem tertentu (Dell DW5821e, Foxconn T99W175, Cinterion) tidak memiliki Linux internal. Untuk jenis ini, `qmanager-core` dipasang **di Router / Mini PC** yang mengendalikan modem tersebut via port serial USB (`/dev/ttyUSB2` / `/dev/ttyACM0`).

---

## 📦 Pemasangan Otomatis 1-Klik (`deploy.sh` & `deploy.ps1`)

Script installer bawaan `QManager-GO` sudah dilengkapi kecerdasan buatan untuk **mendeteksi arsitektur CPU (`uname -m`)** dan **init system (`systemd` vs `init.d`)** secara otomatis.

### Cara Penggunaan (Dari Linux / macOS / Git Bash):
```bash
# Otomatis deteksi arsitektur & init system modem di IP 192.168.225.1
./deploy.sh 192.168.225.1

# Atau via koneksi ADB
./deploy.sh adb
```

### Cara Penggunaan (Dari Windows PowerShell):
```powershell
# Otomatis deteksi arsitektur & init system via SSH
.\deploy.ps1 -Target "192.168.225.1"

# Atau via ADB
.\deploy.ps1 -Method "ADB"
```

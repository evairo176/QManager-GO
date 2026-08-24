# QManager — Go Edition Universal 🚀

<div align="center">
  <img src="public/qmanager-logo.svg" alt="QManager Logo" width="120" />
  <h3>Panel Kontrol & Engine Komunikasi Modem Seluler Berbasis Go Versi Universal</h3>
  <p>Visualisasi, konfigurasi, dan optimasi modem seluler Quectel & Universal dengan backend Go yang sangat ringan dan antarmuka React 19 UI</p>

  ![Version](https://img.shields.io/badge/version-v0.2.0--go-blue?style=flat-square)
  ![Go](https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square)
  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
  ![License](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-green?style=flat-square)
  ![Platform](https://img.shields.io/badge/platform-Universal%20Linux%20%7C%20OpenWRT%20%7C%20RM520N-orange?style=flat-square)
  ![Architecture](https://img.shields.io/badge/arch-ARMv7%20%7C%20ARM64%20%7C%20x86__64-purple?style=flat-square)
</div>

---

## ⚡ Revolusi Arsitektur QManager Go Edition

QManager Go Edition menggantikan `lighttpd`, script CGI Bash lama, dan eksekusi subshell yang berat dengan **satu biner Go tunggal hasil kompilasi (`qmanager-core`)**. Antarmuka web Next.js 16 SPA di-embed secara langsung ke dalam biner menggunakan `embed.FS`, menghasilkan panel manajemen modem kelas enterprise yang sangat cepat dan efisien.

### 🌟 Keunggulan Utama

- 🚀 **Hemat Memori hingga 60-70%** — Hanya menggunakan **~12 – 18 MB RAM** (dibanding 80+ MB pada versi shell terdahulu).
- ⚡ **Respon API Super Cepat (< 15ms)** — Menggunakan routing in-memory native Go `net/http` tanpa overhead `fork()` subshell BusyBox.
- 🔒 **Auto TLS/HTTPS Encryption (`tlsgen`)** — Otomatis membuat sertifikat X.509 ECDSA self-signed di port 443 saat pertama kali dijalankan.
- 🛡️ **Thread-Safe Dual AT Mutex Engine** — Mutex memori + file lock (`/tmp/qmanager_at.lock`) menjamin tidak ada tabrakan perintah AT pada `/dev/smd11` atau `/dev/ttyUSB*`.
- 📦 **Biner Tunggal Serba Ada** — Frontend Next.js di-embed langsung ke dalam `qmanager-core`.
- ⏱️ **Background Poller Goroutine** — Mengumpulkan status sinyal dan modem secara asynchronous setiap 5 detik tanpa membebankan CPU.
- 📦 **1-Click Flashing dari Workstation** — Dilengkapi script `deploy.sh` (Linux/macOS) dan `deploy.ps1` (Windows PowerShell) untuk pemasangan otomatis via SSH atau ADB.

---

## 🚀 Panduan Ringkas Pemasangan & Kompilasi (Quick Start)

### 1. Pemasangan 1-Klik dari Workstation (Rekomendasi)

Kamu bisa langsung memasang `qmanager-core` ke modem/router dari PC/Laptop via SSH atau ADB dalam 1 langkah:

#### Dari Linux / macOS / Git Bash:
```bash
# Clone repositori
git clone https://github.com/latifangren/QManager-GO.git
cd QManager-GO

# Pasang via SSH ke IP modem (default IP: 192.168.225.1)
./deploy.sh 192.168.225.1

# Atau pasang via koneksi ADB
./deploy.sh adb
```

#### Dari Windows PowerShell:
```powershell
# Clone repositori
git clone https://github.com/latifangren/QManager-GO.git
cd QManager-GO

# Pasang via SSH ke IP modem
.\deploy.ps1 -Target "192.168.225.1"

# Atau pasang via koneksi ADB
.\deploy.ps1 -Method "ADB"
```

---

### 2. Kompilasi Manual (Building from Source)

Jika ingin mengompilasi biner Go sendiri:

```bash
# Jalankan script kompilasi multi-arsitektur
./build-go.sh
```

**Hasil Kompilasi:**
* `backend/dist/qmanager-core-armv7` (Modem Quectel RM520N / ARM 32-bit)
* `backend/dist/qmanager-core-arm64` (Raspberry Pi 4/5, Router ARM64)
* `backend/dist/qmanager-core-amd64` (PC / X86_64 Router / VM)
* `backend/dist/qmanager-core` (Default alias ARMv7)

---

### 3. Pemasangan Manual di Perangkat (Systemd Service)

Jika ingin meng-copy biner hasil kompilasi secara manual ke modem:

1. Salin biner `qmanager-core` ke `/usr/bin/` di modem:
   ```bash
   scp backend/dist/qmanager-core root@192.168.225.1:/usr/bin/qmanager-core
   ssh root@192.168.225.1 "chmod +x /usr/bin/qmanager-core"
   ```

2. Salin dan aktifkan service systemd:
   ```bash
   scp backend/qmanager-core.service root@192.168.225.1:/lib/systemd/system/qmanager-core.service
   ssh root@192.168.225.1 "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
   ```

3. Akses Web UI QManager:
   - **HTTP**: `http://192.168.225.1`
   - **HTTPS (Auto TLS)**: `https://192.168.225.1`

---

## 🛠️ Fitur Utama

- 📡 **Signal Dashboard & Antenna Alignment** — RSRP, RSRQ, SINR, RSSI, MIMO 4x4, Carrier Aggregation (CA), dan alignment score meter.
- 🔒 **Cellular & Tower Locking** — Band locking LTE & 5G NR, 4G/5G SA tower locking by PCI/ARFCN/SCS (15, 30, 60, 120 kHz).
- ⚙️ **SIM Profile & Scenarios** — Auto-apply profil berdasarkan ICCID SIM card dan penjadwalan kunci band.
- 🛡️ **24/7 Resilience Watchdog** — Automatic ping recovery, interface reset, hingga CFUN cycle.
- 📩 **SMS Manager & Webhook Forwarding** — Kirim/baca SMS dan forwarding otomatis via SMS webhook.

---

## 💙 Lisensi & Kredit

Diisi di bawah lisensi **[MIT dengan Commons Clause](LICENSE)**.

- Dikembangkan dari **[QManager Universal](https://github.com/dr-dolomite/QManager)** oleh [DrDolomite](https://github.com/dr-dolomite).
- Terinspirasi dari konsep **[QuecTool](https://github.com/snowzach/quectool)**.
- Backend Go & Arsitektur Single-Binary oleh [latifangren](https://github.com/latifangren).

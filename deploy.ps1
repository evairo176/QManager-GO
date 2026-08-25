<#
.SYNOPSIS
    1-Click PowerShell deployment script for QManager Go Edition onto Quectel & Universal modems/routers.
.EXAMPLE
    .\deploy.ps1 -Target "192.168.225.1"
    .\deploy.ps1 -Method "ADB"
#>

param(
    [string]$Target = "192.168.225.1",
    [string]$User = "root",
    [string]$Method = "SSH" # "SSH" or "ADB"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " 🚀 QManager Go Universal Deployment (Windows)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$LocalDefault = "backend\dist\qmanager-core"
$LocalARM7   = "backend\dist\qmanager-core-armv7"
$LocalARM64  = "backend\dist\qmanager-core-arm64"
$LocalAMD64  = "backend\dist\qmanager-core-amd64"
$ServiceFile = "backend\qmanager-core.service"
$OpenWRTInit = "scripts\etc\init.d\qmanager-core"

if (-not (Test-Path $LocalDefault)) {
    Write-Host "==> Local binary not found. Running build-go.sh..." -ForegroundColor Yellow
    if (Get-Command bash -ErrorAction SilentlyContinue) {
        bash ./build-go.sh
    } else {
        Write-Error "Please run build-go.sh inside Git Bash or WSL first."
    }
}

if ($Method -eq "ADB") {
    Write-Host "==> Deploying over ADB..." -ForegroundColor Green
    adb wait-for-device
    $TargetArch = (adb shell "uname -m" 2>$null).Trim()
    Write-Host "==> Detected target architecture: ${TargetArch}" -ForegroundColor Yellow

    $BinaryToPush = $LocalDefault
    if ($TargetArch -match "aarch64|arm64" -and (Test-Path $LocalARM64)) {
        $BinaryToPush = $LocalARM64
    } elseif ($TargetArch -match "armv7|armv8l|arm" -and (Test-Path $LocalARM7)) {
        $BinaryToPush = $LocalARM7
    } elseif ($TargetArch -match "x86_64|amd64" -and (Test-Path $LocalAMD64)) {
        $BinaryToPush = $LocalAMD64
    }

    Write-Host "==> Pushing binary: $BinaryToPush -> /usr/bin/qmanager-core" -ForegroundColor Green
    adb push $BinaryToPush /usr/bin/qmanager-core
    adb shell "chmod +x /usr/bin/qmanager-core"

    $HasSystemd = (adb shell "command -v systemctl >/dev/null 2>&1 && echo yes || echo no").Trim()
    if ($HasSystemd -eq "yes") {
        Write-Host "==> Detected Init System: Systemd" -ForegroundColor Green
        if (Test-Path $ServiceFile) {
            adb push $ServiceFile /lib/systemd/system/qmanager-core.service
            adb shell "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
            adb shell "systemctl status qmanager-core --no-pager"
        }
    } else {
        Write-Host "==> Detected Init System: OpenWRT procd (init.d)" -ForegroundColor Green
        if (Test-Path $OpenWRTInit) {
            adb push $OpenWRTInit /etc/init.d/qmanager-core
            adb shell "chmod +x /etc/init.d/qmanager-core && /etc/init.d/qmanager-core enable && /etc/init.d/qmanager-core restart"
        }
    }
} else {
    Write-Host "==> Deploying over SSH to ${User}@${Target}..." -ForegroundColor Green
    $TargetArch = (ssh "${User}@${Target}" "uname -m" 2>$null).Trim()
    Write-Host "==> Detected target architecture: ${TargetArch}" -ForegroundColor Yellow

    $BinaryToPush = $LocalDefault
    if ($TargetArch -match "aarch64|arm64" -and (Test-Path $LocalARM64)) {
        $BinaryToPush = $LocalARM64
    } elseif ($TargetArch -match "armv7|armv8l|arm" -and (Test-Path $LocalARM7)) {
        $BinaryToPush = $LocalARM7
    } elseif ($TargetArch -match "x86_64|amd64" -and (Test-Path $LocalAMD64)) {
        $BinaryToPush = $LocalAMD64
    }

    Write-Host "==> Uploading binary: $BinaryToPush -> /usr/bin/qmanager-core" -ForegroundColor Green
    scp $BinaryToPush "${User}@${Target}:/usr/bin/qmanager-core"
    ssh "${User}@${Target}" "chmod +x /usr/bin/qmanager-core"

    $HasSystemd = (ssh "${User}@${Target}" "command -v systemctl >/dev/null 2>&1 && echo yes || echo no").Trim()
    if ($HasSystemd -eq "yes") {
        Write-Host "==> Detected Init System: Systemd" -ForegroundColor Green
        if (Test-Path $ServiceFile) {
            scp $ServiceFile "${User}@${Target}:/lib/systemd/system/qmanager-core.service"
            ssh "${User}@${Target}" "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
            ssh "${User}@${Target}" "systemctl status qmanager-core --no-pager"
        }
    } else {
        Write-Host "==> Detected Init System: OpenWRT procd (init.d)" -ForegroundColor Green
        if (Test-Path $OpenWRTInit) {
            scp $OpenWRTInit "${User}@${Target}:/etc/init.d/qmanager-core"
            ssh "${User}@${Target}" "chmod +x /etc/init.d/qmanager-core && /etc/init.d/qmanager-core enable && /etc/init.d/qmanager-core restart"
        }
    }
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ✨ Deployment Complete! http://${Target}" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

<#
.SYNOPSIS
    1-Click PowerShell deployment script for QManager Go Edition onto Quectel RM520N-GL modem.
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
Write-Host " 🚀 QManager Go Edition Deployment (Windows)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$LocalBinary = "backend\dist\qmanager-core"
$ServiceFile = "backend\qmanager-core.service"

if (-not (Test-Path $LocalBinary)) {
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
    adb push $LocalBinary /usr/bin/qmanager-core
    adb shell "chmod +x /usr/bin/qmanager-core"
    if (Test-Path $ServiceFile) {
        adb push $ServiceFile /lib/systemd/system/qmanager-core.service
        adb shell "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
    }
    adb shell "systemctl status qmanager-core --no-pager"
} else {
    Write-Host "==> Deploying over SSH to ${User}@${Target}..." -ForegroundColor Green
    scp $LocalBinary "${User}@${Target}:/usr/bin/qmanager-core"
    ssh "${User}@${Target}" "chmod +x /usr/bin/qmanager-core"
    if (Test-Path $ServiceFile) {
        scp $ServiceFile "${User}@${Target}:/lib/systemd/system/qmanager-core.service"
        ssh "${User}@${Target}" "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
    }
    ssh "${User}@${Target}" "systemctl status qmanager-core --no-pager"
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ✨ Deployment Complete! http://${Target}" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

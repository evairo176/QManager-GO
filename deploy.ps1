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
    [string]$Password = "",
    [string]$Method = "SSH"
)

# Read credentials from .env if present
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)$") {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            if ($key -eq "SSH_HOST" -and $Target -eq "192.168.225.1") { $Target = $val }
            if ($key -eq "SSH_USERNAME" -and $User -eq "root") { $User = $val }
            if ($key -eq "SSH_PASSWORD" -and -not $Password) { $Password = $val }
        }
    }
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " 🚀 QManager Go Universal Deployment (Windows)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$LocalARM7 = "backend\dist\qmanager-core-armv7"
$LocalARM64 = "backend\dist\qmanager-core-arm64"
$LocalAMD64 = "backend\dist\qmanager-core-amd64"
$LocalDefault = "backend\dist\qmanager-core"

$ServiceFile = "scripts\etc\systemd\system\qmanager-core.service"
$OpenWRTInit = "scripts\etc\init.d\qmanager-core"

if (-not (Test-Path $LocalARM7) -and -not (Test-Path $LocalARM64) -and -not (Test-Path $LocalDefault)) {
    Write-Host "==> Building Go Core for ARMv7 target..." -ForegroundColor Yellow
    $env:CGO_ENABLED = "0"
    $env:GOOS = "linux"
    $env:GOARCH = "arm"
    $env:GOARM = "7"
    Set-Location -Path "backend"
    go build -ldflags="-s -w" -o dist/qmanager-core-armv7 ./cmd/server
    Set-Location -Path ".."
}

if ($Method -eq "ADB") {
    Write-Host "==> Deploying over ADB..." -ForegroundColor Green
    $TargetArch = (adb shell "uname -m").Trim()
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

    # Try Posh-SSH if password is known
    $HasPoshSSH = Get-Module -ListAvailable -Name Posh-SSH
    if ($HasPoshSSH -and $Password) {
        try {
            Import-Module Posh-SSH -ErrorAction SilentlyContinue
            $secPass = ConvertTo-SecureString $Password -AsPlainText -Force
            $cred = New-Object System.Management.Automation.PSCredential ($User, $secPass)
            $sess = New-SSHSession -ComputerName $Target -Credential $cred -AcceptKey -Force -ErrorAction Stop

            if ($sess) {
                $TargetArch = (Invoke-SSHCommand -SessionId $sess.SessionId -Command "uname -m").Output.Trim()
                Write-Host "==> Detected target architecture: ${TargetArch}" -ForegroundColor Yellow

                $BinaryToPush = $LocalDefault
                if ($TargetArch -match "aarch64|arm64" -and (Test-Path $LocalARM64)) {
                    $BinaryToPush = $LocalARM64
                } elseif ($TargetArch -match "armv7|armv8l|arm" -and (Test-Path $LocalARM7)) {
                    $BinaryToPush = $LocalARM7
                } elseif ($TargetArch -match "x86_64|amd64" -and (Test-Path $LocalAMD64)) {
                    $BinaryToPush = $LocalAMD64
                }

            Write-Host "==> Uploading binary: $BinaryToPush -> /usrdata/qmanager-core" -ForegroundColor Green
            Set-SCPFile -SessionId $sess.SessionId -LocalFile $BinaryToPush -RemotePath "/usrdata/qmanager-core" | Out-Null
            Invoke-SSHCommand -SessionId $sess.SessionId -Command "chmod +x /usrdata/qmanager-core" | Out-Null

                $HasSystemd = (Invoke-SSHCommand -SessionId $sess.SessionId -Command "command -v systemctl >/dev/null 2>&1 && echo yes || echo no").Output.Trim()
                if ($HasSystemd -eq "yes") {
                    Write-Host "==> Detected Init System: Systemd" -ForegroundColor Green
                    if (Test-Path $ServiceFile) {
                        Set-SCPFile -SessionId $sess.SessionId -LocalFile $ServiceFile -RemotePath "/lib/systemd/system/qmanager-core.service" | Out-Null
                        Invoke-SSHCommand -SessionId $sess.SessionId -Command "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core" | Out-Null
                    }
                } else {
                    Write-Host "==> Detected Init System: OpenWRT procd (init.d)" -ForegroundColor Green
                    if (Test-Path $OpenWRTInit) {
                        Set-SCPFile -SessionId $sess.SessionId -LocalFile $OpenWRTInit -RemotePath "/etc/init.d/qmanager-core" | Out-Null
                        Invoke-SSHCommand -SessionId $sess.SessionId -Command "chmod +x /etc/init.d/qmanager-core && /etc/init.d/qmanager-core enable && /etc/init.d/qmanager-core restart" | Out-Null
                    }
                }
                Remove-SSHSession -SessionId $sess.SessionId | Out-Null
                Write-Host "=========================================" -ForegroundColor Cyan
                Write-Host " ✨ Deployment Complete! http://${Target}" -ForegroundColor Green
                Write-Host "=========================================" -ForegroundColor Cyan
                exit 0
            }
        } catch {
            Write-Host "==> Posh-SSH connection failed. Falling back to native SSH client..." -ForegroundColor Yellow
        }
    }

    # Fallback standard SSH command
    Write-Host "==> Running OpenSSH client..." -ForegroundColor Green
    scp -o StrictHostKeyChecking=no $LocalARM7 "${User}@${Target}:/usr/bin/qmanager-core"
    ssh -o StrictHostKeyChecking=no "${User}@${Target}" "chmod +x /usr/bin/qmanager-core && (/etc/init.d/qmanager-core restart 2>/dev/null || systemctl restart qmanager-core)"
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ✨ Deployment Complete! http://${Target}" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
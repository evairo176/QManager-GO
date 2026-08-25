#!/bin/sh
# QManager Go Edition — Universal 1-Click Modem & Device Deployment Script
# Automatically detects init system (systemd vs procd init.d) and target architecture.
#
# Usage:
#   ./deploy.sh                                   # Deploy to default modem IP (192.168.225.1)
#   ./deploy.sh 192.168.225.1                     # Deploy over SSH to specified IP
#   ./deploy.sh adb                               # Deploy over ADB connection

set -e

TARGET="${1:-192.168.225.1}"
LOCAL_ARM7="backend/dist/qmanager-core-armv7"
LOCAL_ARM64="backend/dist/qmanager-core-arm64"
LOCAL_AMD64="backend/dist/qmanager-core-amd64"
LOCAL_DEFAULT="backend/dist/qmanager-core"
SYSTEMD_SERVICE="backend/qmanager-core.service"
OPENWRT_INIT="scripts/etc/init.d/qmanager-core"

echo "========================================="
echo " 🚀 QManager Go Universal Deployment Tool"
echo "========================================="

# Ensure binaries exist; run build-go.sh if missing
if [ ! -f "$LOCAL_DEFAULT" ]; then
    echo "==> Building Go executables..."
    if [ -f "./build-go.sh" ]; then
        ./build-go.sh
    else
        echo "Error: ./build-go.sh not found."
        exit 1
    fi
fi

if [ "$TARGET" = "adb" ]; then
    echo "==> Deploying over ADB connection..."
    command -v adb >/dev/null 2>&1 || { echo "Error: adb command not found."; exit 1; }

    adb wait-for-device
    TARGET_ARCH=$(adb shell "uname -m" 2>/dev/null | tr -d '\r\n')
    echo "==> Detected target architecture: ${TARGET_ARCH}"

    BINARY_TO_PUSH="$LOCAL_DEFAULT"
    case "$TARGET_ARCH" in
        aarch64|arm64)
            [ -f "$LOCAL_ARM64" ] && BINARY_TO_PUSH="$LOCAL_ARM64"
            ;;
        armv7*|armv8l|arm)
            [ -f "$LOCAL_ARM7" ] && BINARY_TO_PUSH="$LOCAL_ARM7"
            ;;
        x86_64|amd64)
            [ -f "$LOCAL_AMD64" ] && BINARY_TO_PUSH="$LOCAL_AMD64"
            ;;
    esac

    echo "==> Pushing binary: $BINARY_TO_PUSH -> /usr/bin/qmanager-core"
    adb push "$BINARY_TO_PUSH" /usr/bin/qmanager-core
    adb shell "chmod +x /usr/bin/qmanager-core"

    # Detect Init System (Systemd vs OpenWRT procd)
    HAS_SYSTEMD=$(adb shell "command -v systemctl >/dev/null 2>&1 && echo yes || echo no" | tr -d '\r\n')

    if [ "$HAS_SYSTEMD" = "yes" ]; then
        echo "==> Detected Init System: Systemd"
        if [ -f "$SYSTEMD_SERVICE" ]; then
            adb push "$SYSTEMD_SERVICE" /lib/systemd/system/qmanager-core.service
            adb shell "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
            adb shell "systemctl status qmanager-core --no-pager"
        fi
    else
        echo "==> Detected Init System: OpenWRT procd (init.d)"
        if [ -f "$OPENWRT_INIT" ]; then
            adb push "$OPENWRT_INIT" /etc/init.d/qmanager-core
            adb shell "chmod +x /etc/init.d/qmanager-core && /etc/init.d/qmanager-core enable && /etc/init.d/qmanager-core restart"
        fi
    fi
    echo "==> ADB Deployment Complete!"

else
    echo "==> Deploying over SSH to root@$TARGET..."
    command -v scp >/dev/null 2>&1 || { echo "Error: scp command not found."; exit 1; }
    command -v ssh >/dev/null 2>&1 || { echo "Error: ssh command not found."; exit 1; }

    TARGET_ARCH=$(ssh "root@$TARGET" "uname -m" 2>/dev/null | tr -d '\r\n')
    echo "==> Detected target architecture: ${TARGET_ARCH}"

    BINARY_TO_PUSH="$LOCAL_DEFAULT"
    case "$TARGET_ARCH" in
        aarch64|arm64)
            [ -f "$LOCAL_ARM64" ] && BINARY_TO_PUSH="$LOCAL_ARM64"
            ;;
        armv7*|armv8l|arm)
            [ -f "$LOCAL_ARM7" ] && BINARY_TO_PUSH="$LOCAL_ARM7"
            ;;
        x86_64|amd64)
            [ -f "$LOCAL_AMD64" ] && BINARY_TO_PUSH="$LOCAL_AMD64"
            ;;
    esac

    echo "==> Uploading binary: $BINARY_TO_PUSH -> /usr/bin/qmanager-core"
    scp "$BINARY_TO_PUSH" "root@$TARGET:/usr/bin/qmanager-core"
    ssh "root@$TARGET" "chmod +x /usr/bin/qmanager-core"

    # Detect Init System on remote device
    HAS_SYSTEMD=$(ssh "root@$TARGET" "command -v systemctl >/dev/null 2>&1 && echo yes || echo no" | tr -d '\r\n')

    if [ "$HAS_SYSTEMD" = "yes" ]; then
        echo "==> Detected Init System: Systemd"
        if [ -f "$SYSTEMD_SERVICE" ]; then
            scp "$SYSTEMD_SERVICE" "root@$TARGET:/lib/systemd/system/qmanager-core.service"
            ssh "root@$TARGET" "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
            ssh "root@$TARGET" "systemctl status qmanager-core --no-pager"
        fi
    else
        echo "==> Detected Init System: OpenWRT procd (init.d)"
        if [ -f "$OPENWRT_INIT" ]; then
            scp "$OPENWRT_INIT" "root@$TARGET:/etc/init.d/qmanager-core"
            ssh "root@$TARGET" "chmod +x /etc/init.d/qmanager-core && /etc/init.d/qmanager-core enable && /etc/init.d/qmanager-core restart"
        fi
    fi
    echo "==> SSH Deployment Complete!"
fi

echo "========================================="
echo " ✨ QManager Go is live on http://$TARGET"
echo "========================================="

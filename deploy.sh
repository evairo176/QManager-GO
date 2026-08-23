#!/bin/sh
# QManager Go Edition — 1-Click Modem Deployment Script
# Deploys qmanager-core executable and systemd service to Quectel RM520N-GL modem over SSH or ADB.
#
# Usage:
#   ./deploy.sh                                   # Deploy local build backend/dist/qmanager-core
#   ./deploy.sh 192.168.225.1                     # Deploy over SSH to specified IP
#   ./deploy.sh adb                               # Deploy over ADB connection

set -e

TARGET="${1:-192.168.225.1}"
LOCAL_BINARY="backend/dist/qmanager-core"
SERVICE_FILE="backend/qmanager-core.service"

echo "========================================="
echo " 🚀 QManager Go Edition Deployment Tool"
echo "========================================="

# Ensure local binary exists
if [ ! -f "$LOCAL_BINARY" ]; then
    echo "==> Building Go ARMv7 executable..."
    if [ -f "./build-go.sh" ]; then
        ./build-go.sh
    else
        echo "Error: $LOCAL_BINARY not found. Run ./build-go.sh first."
        exit 1
    fi
fi

if [ "$TARGET" = "adb" ]; then
    echo "==> Deploying over ADB connection..."
    command -v adb >/dev/null 2>&1 || { echo "Error: adb command not found."; exit 1; }

    adb wait-for-device
    echo "==> Pushing qmanager-core binary..."
    adb push "$LOCAL_BINARY" /usr/bin/qmanager-core
    adb shell "chmod +x /usr/bin/qmanager-core"

    if [ -f "$SERVICE_FILE" ]; then
        echo "==> Installing systemd service..."
        adb push "$SERVICE_FILE" /lib/systemd/system/qmanager-core.service
        adb shell "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
    fi
    echo "==> ADB Deployment Complete! Status:"
    adb shell "systemctl status qmanager-core --no-pager"
else
    echo "==> Deploying over SSH to root@$TARGET..."
    command -v scp >/dev/null 2>&1 || { echo "Error: scp command not found."; exit 1; }
    command -v ssh >/dev/null 2>&1 || { echo "Error: ssh command not found."; exit 1; }

    echo "==> Uploading qmanager-core executable..."
    scp "$LOCAL_BINARY" "root@$TARGET:/usr/bin/qmanager-core"
    ssh "root@$TARGET" "chmod +x /usr/bin/qmanager-core"

    if [ -f "$SERVICE_FILE" ]; then
        echo "==> Installing systemd service..."
        scp "$SERVICE_FILE" "root@$TARGET:/lib/systemd/system/qmanager-core.service"
        ssh "root@$TARGET" "systemctl daemon-reload && systemctl enable qmanager-core && systemctl restart qmanager-core"
    fi
    echo "==> SSH Deployment Complete! Status:"
    ssh "root@$TARGET" "systemctl status qmanager-core --no-pager"
fi

echo "========================================="
echo " ✨ QManager Go is live on http://$TARGET"
echo "========================================="

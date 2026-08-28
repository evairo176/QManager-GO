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

# Fallback binary picker
if [ ! -f "$LOCAL_DEFAULT" ]; then
    if [ -f "$LOCAL_ARM7" ]; then
        LOCAL_DEFAULT="$LOCAL_ARM7"
    elif [ -f "$LOCAL_ARM64" ]; then
        LOCAL_DEFAULT="$LOCAL_ARM64"
    elif [ -f "$LOCAL_AMD64" ]; then
        LOCAL_DEFAULT="$LOCAL_AMD64"
    else
        echo "Error: No compiled binaries found in backend/dist/. Please run ./build-go.sh first."
        exit 1
    fi
fi

SYSTEMD_SERVICE="scripts/lib/systemd/system/qmanager-core.service"
OPENWRT_INIT="scripts/etc/init.d/qmanager-core"

echo "========================================="
echo " 🚀 Deploying QManager Go Edition"
echo "========================================="

if [ "$TARGET" = "adb" ]; then
    echo "==> Deploying over ADB..."
    command -v adb >/dev/null 2>&1 || { echo "Error: adb command not found."; exit 1; }

    TARGET_ARCH=$(adb shell "uname -m" 2>/dev/null | tr -d '\r\n')
    echo "==> Detected target architecture: ${TARGET_ARCH}"

    BINARY_TO_PUSH="$LOCAL_DEFAULT"
    case "$TARGET_ARCH" in
        aarch64|arm64)
            [ -f "$LOCAL_ARM64" ] && BINARY_TO_PUSH="$LOCAL_ARM64"
            ;;
        armv7*|arm*)
            [ -f "$LOCAL_ARM7" ] && BINARY_TO_PUSH="$LOCAL_ARM7"
            ;;
        x86_64|amd64)
            [ -f "$LOCAL_AMD64" ] && BINARY_TO_PUSH="$LOCAL_AMD64"
            ;;
    esac

    echo "==> Remounting / read-write over ADB..."
    adb shell "mount -o remount,rw / 2>/dev/null || true"
    adb shell "mkdir -p /usrdata"

    echo "==> Uploading binary: $BINARY_TO_PUSH -> /usrdata/qmanager-core"
    adb push "$BINARY_TO_PUSH" /usrdata/qmanager-core
    adb shell "chmod +x /usrdata/qmanager-core"

    HAS_SYSTEMD=$(adb shell "command -v systemctl >/dev/null 2>&1 && echo yes || echo no" | tr -d '\r\n')
    if [ "$HAS_SYSTEMD" = "yes" ]; then
        echo "==> Detected Init System: Systemd"
        if [ -f "$SYSTEMD_SERVICE" ]; then
            adb push "$SYSTEMD_SERVICE" /lib/systemd/system/qmanager-core.service
            adb shell "mkdir -p /lib/systemd/system/multi-user.target.wants && ln -sf /lib/systemd/system/qmanager-core.service /lib/systemd/system/multi-user.target.wants/qmanager-core.service"
            # FIX PERMANEN: enable eksplisit + verify (symlink manual saja belum cukup di semua build)
            adb shell "systemctl daemon-reload && systemctl enable qmanager-core && systemctl is-enabled qmanager-core"
            adb shell "systemctl restart qmanager-core"
        fi
    fi
    adb shell "mount -o remount,ro / 2>/dev/null || true"
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
        armv7*|arm*)
            [ -f "$LOCAL_ARM7" ] && BINARY_TO_PUSH="$LOCAL_ARM7"
            ;;
        x86_64|amd64)
            [ -f "$LOCAL_AMD64" ] && BINARY_TO_PUSH="$LOCAL_AMD64"
            ;;
    esac

    ssh "root@$TARGET" "mount -o remount,rw / 2>/dev/null || true; mkdir -p /usrdata"
    echo "==> Uploading binary: $BINARY_TO_PUSH -> /usrdata/qmanager-core"
    scp "$BINARY_TO_PUSH" "root@$TARGET:/usrdata/qmanager-core"
    ssh "root@$TARGET" "chmod +x /usrdata/qmanager-core"

    HAS_SYSTEMD=$(ssh "root@$TARGET" "command -v systemctl >/dev/null 2>&1 && echo yes || echo no" | tr -d '\r\n')

    if [ "$HAS_SYSTEMD" = "yes" ]; then
        echo "==> Detected Init System: Systemd"
        if [ -f "$SYSTEMD_SERVICE" ]; then
            # CRITICAL: install unit to /lib (rootfs), NOT /etc.
            # On Quectel modems /etc lives on the late-mounted ubi2_0 volume, so
            # systemd silently skips custom units whose fragment is in /etc during
            # cold boot (no start attempt, no error). Units in /lib/systemd/system
            # (same place as sshd) are guaranteed to be picked up. ExecStart must
            # also not point into /usrdata directly, because systemd then derives
            # RequiresMountsFor=/usrdata which can't resolve at boot -> unit skipped.
            ssh "root@$TARGET" "mount -o remount,rw / 2>/dev/null || true"
            scp "$SYSTEMD_SERVICE" "root@$TARGET:/lib/systemd/system/qmanager-core.service"
            # Wrapper in /lib avoids auto-derived RequiresMountsFor=/usrdata
            ssh "root@$TARGET" "cat > /lib/qmanager-start.sh <<'WMEOF'
#!/bin/sh
# QManager launcher wrapper - lives on rootfs so systemd sees no /usrdata mount dep.
sleep 5
cd /usrdata/qmanager
exec /usrdata/qmanager/qmanager-core
WMEOF
chmod +x /lib/qmanager-start.sh"
            ssh "root@$TARGET" "mkdir -p /lib/systemd/system/multi-user.target.wants && ln -sf /lib/systemd/system/qmanager-core.service /lib/systemd/system/multi-user.target.wants/qmanager-core.service && rm -f /etc/systemd/system/qmanager-core.service /etc/systemd/system/multi-user.target.wants/qmanager-core.service"
            # enable eksplisit + verify is-enabled (biar auto-start tiap boot)
            ssh "root@$TARGET" "systemctl daemon-reload && systemctl enable qmanager-core && echo 'is-enabled:' && systemctl is-enabled qmanager-core"
            ssh "root@$TARGET" "systemctl restart qmanager-core"
            ssh "root@$TARGET" "systemctl status qmanager-core --no-pager"
            ssh "root@$TARGET" "mount -o remount,ro / 2>/dev/null || true"
        fi
    else
        echo "==> Detected Init System: OpenWRT procd (init.d)"
        if [ -f "$OPENWRT_INIT" ]; then
            scp "$OPENWRT_INIT" "root@$TARGET:/etc/init.d/qmanager-core"
            ssh "root@$TARGET" "chmod +x /etc/init.d/qmanager-core && /etc/init.d/qmanager-core enable && /etc/init.d/qmanager-core restart"
        fi
    fi
    ssh "root@$TARGET" "mount -o remount,ro / 2>/dev/null || true"
    echo "==> SSH Deployment Complete!"
fi

echo "========================================="
echo " ✨ QManager Go is live on http://$TARGET"
echo "========================================="

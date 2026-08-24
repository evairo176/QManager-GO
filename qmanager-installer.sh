#!/bin/sh
# =============================================================================
# QManager Bootstrap Installer
# =============================================================================
# Thin wrapper for one-liner installs. Downloads the selected release tarball
# from GitHub, verifies sha256, extracts it, and runs install.sh (or
# uninstall.sh). curl-only — no wget/uclient-fetch fallbacks.
#
# Supports both stable and pre-release channels.
#
# Usage:
#   sh qmanager-installer.sh [OPTIONS]
#
# Options:
#   --uninstall             Run uninstall.sh instead of install.sh
#   --tag <tag>             Use an explicit release tag (e.g., v0.1.14)
#   --channel <ch>          Release channel: stable|prerelease|any (default: any)
#   --repo <owner/repo>     Override GitHub repo (default: latifangren/QManager-GO)
#   -h, --help              Show this help
#
# Environment overrides:
#   QMANAGER_TAG            Same as --tag
#   QMANAGER_CHANNEL        Same as --channel
#   QMANAGER_REPO           Same as --repo
# =============================================================================

set -e

REPO="${QMANAGER_REPO:-latifangren/QManager-GO}"
TAG="${QMANAGER_TAG:-}"
CHANNEL="${QMANAGER_CHANNEL:-any}"
ACTION="install"

usage() {
    cat <<'EOF'
QManager bootstrap installer

Usage:
  sh qmanager-installer.sh [OPTIONS]

Options:
  --uninstall           Run uninstall.sh instead of install.sh
  --tag <tag>           Use an explicit release tag (e.g., v0.1.14)
  --channel <ch>        Release channel: stable | prerelease | any (default: any)
                        - stable:     only releases marked prerelease=false
                        - prerelease: only releases marked prerelease=true
                        - any:        newest release regardless of flag
  --repo <owner/repo>   Override repository (default: dr-dolomite/QManager)
  -h, --help            Show this help

Environment overrides:
  QMANAGER_TAG          Same as --tag
  QMANAGER_CHANNEL      Same as --channel
  QMANAGER_REPO         Same as --repo

Examples:
  # Install newest release (any channel)
  curl -sL https://raw.githubusercontent.com/dr-dolomite/QManager/main/qmanager-installer.sh | sh

  # Install newest stable only
  curl -sL .../qmanager-installer.sh | sh -s -- --channel stable

  # Install a specific tag
  curl -sL .../qmanager-installer.sh | sh -s -- --tag v0.1.14

  # Uninstall
  curl -sL .../qmanager-installer.sh | sh -s -- --uninstall
EOF
}

# --- Arg parsing -------------------------------------------------------------

while [ "$#" -gt 0 ]; do
    case "$1" in
        --uninstall)
            ACTION="uninstall"
            ;;
        --tag)
            shift
            [ "$#" -gt 0 ] || { echo "Missing value for --tag" >&2; exit 1; }
            TAG="$1"
            ;;
        --channel)
            shift
            [ "$#" -gt 0 ] || { echo "Missing value for --channel" >&2; exit 1; }
            CHANNEL="$1"
            ;;
        --repo)
            shift
            [ "$#" -gt 0 ] || { echo "Missing value for --repo" >&2; exit 1; }
            REPO="$1"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

# --- Dependency checks -------------------------------------------------------

if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required but not installed." >&2
    echo "Install it first:  opkg update && opkg install curl ca-bundle" >&2
    exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
    echo "sha256sum is required but not available" >&2
    exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
    echo "tar is required but not available" >&2
    exit 1
fi

if ! command -v awk >/dev/null 2>&1; then
    echo "awk is required but not available" >&2
    exit 1
fi

# --- HTTP helpers (curl-only) ------------------------------------------------

fetch_text() {
    curl -fsSL --max-time 30 --connect-timeout 10 "$1" 2>/dev/null
}

download_file() {
    local url="$1" out="$2"
    curl -fsSL --max-time 600 --connect-timeout 15 -o "$out" "$url"
}

# Parse release tags from GitHub API JSON without jq.
# This parser is intentionally line-oriented so it remains POSIX/BuysBox-safe
# and avoids fragile object splitting by literal "},{".
extract_tag_from_releases_json() {
    local channel="$1"

    awk -v channel="$channel" '
        /^[[:space:]]*"tag_name":[[:space:]]*"/ {
            line = $0
            sub(/^[[:space:]]*"tag_name":[[:space:]]*"/, "", line)
            sub(/".*/, "", line)
            tag = line

            if (channel == "any" && tag != "") {
                print tag
                exit
            }
            next
        }

        /^[[:space:]]*"prerelease":[[:space:]]*true/ {
            if (channel == "prerelease" && tag != "") {
                print tag
                exit
            }
            next
        }

        /^[[:space:]]*"prerelease":[[:space:]]*false/ {
            if (channel == "stable" && tag != "") {
                print tag
                exit
            }
            next
        }
    '
}

# --- Channel selection -------------------------------------------------------

case "$CHANNEL" in
    stable|prerelease|any) ;;
    *)
        echo "Invalid --channel: $CHANNEL (expected: stable, prerelease, any)" >&2
        exit 1
        ;;
esac

# --- Tag resolution ----------------------------------------------------------

if [ -z "$TAG" ]; then
    echo "Resolving latest $CHANNEL release from $REPO..."

    API="https://api.github.com/repos/${REPO}/releases?per_page=50"
    JSON="$(fetch_text "$API" || true)"

    if [ -z "$JSON" ]; then
        echo "Failed to fetch release metadata from $API" >&2
        echo "Check internet connectivity and GitHub API availability." >&2
        exit 1
    fi

    TAG="$(printf '%s\n' "$JSON" | extract_tag_from_releases_json "$CHANNEL")"
fi

if [ -z "$TAG" ]; then
    echo "Failed to resolve a release tag from channel '$CHANNEL'" >&2
    if [ "$CHANNEL" = "stable" ]; then
        echo "There may be no stable releases published yet — try --channel prerelease or --channel any" >&2
    fi
    exit 1
fi

echo "Using release: $TAG"

# --- Download and verify -----------------------------------------------------

BASE="https://github.com/${REPO}/releases/download/${TAG}"
WORK_DIR="/tmp/qmanager-bootstrap"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

cleanup() {
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

cd "$WORK_DIR"

echo "Downloading qmanager.tar.gz..."
if ! download_file "$BASE/qmanager.tar.gz" qmanager.tar.gz; then
    echo "Failed to download qmanager.tar.gz from $BASE" >&2
    exit 1
fi

echo "Downloading sha256sum.txt..."
if ! download_file "$BASE/sha256sum.txt" sha256sum.txt; then
    echo "Failed to download sha256sum.txt from $BASE" >&2
    exit 1
fi

echo "Verifying SHA-256..."
sha256sum -c sha256sum.txt

# --- Extract -----------------------------------------------------------------

echo "Extracting..."
if tar xzf qmanager.tar.gz 2>/dev/null; then
    :
elif command -v gzip >/dev/null 2>&1; then
    gzip -dc qmanager.tar.gz | tar xf -
else
    echo "Unable to extract qmanager.tar.gz (tar -z and gzip both missing)" >&2
    exit 1
fi

[ -d "$WORK_DIR/qmanager_install" ] || {
    echo "Extraction produced no qmanager_install directory — archive layout invalid" >&2
    exit 1
}

# --- Hand off to install.sh / uninstall.sh -----------------------------------

if [ "$ACTION" = "uninstall" ]; then
    exec sh "$WORK_DIR/qmanager_install/uninstall.sh"
else
    exec sh "$WORK_DIR/qmanager_install/install.sh"
fi

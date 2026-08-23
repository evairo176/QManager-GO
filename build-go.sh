#!/bin/bash
# =============================================================================
# build-go.sh — Unified Multi-Architecture Build Script for QManager Go Edition
# =============================================================================
# Usage:
#   ./build-go.sh                Builds frontend + cross-compiles all targets (armv7, arm64, amd64)
#   ./build-go.sh --local        Fast build for current host OS/ARCH
#   ./build-go.sh --skip-web     Skip frontend export (backend compilation only)
# =============================================================================

set -e

SKIP_WEB=false
LOCAL_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-web|--skip-frontend)
      SKIP_WEB=true
      shift
      ;;
    --local)
      LOCAL_ONLY=true
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ "$SKIP_WEB" = false ]; then
  echo "=== Step 1: Building Next.js Static Export ==="
  bun run build

  echo "=== Step 2: Copying Web Assets to Go Embed Path ==="
  mkdir -p backend/web/out
  rm -rf backend/web/out/*
  cp -r out/* backend/web/out/
else
  echo "=== Step 1 & 2: Skipping Frontend Export (--skip-web) ==="
fi

echo "=== Step 3: Compiling Go Core Executable ==="
cd backend
mkdir -p dist

export CGO_ENABLED=0

if [ "$LOCAL_ONLY" = true ]; then
  echo "--> Compiling for local host ($(go env GOOS)/$(go env GOARCH))..."
  go build -ldflags="-s -w" -o dist/qmanager-core ./cmd/server
  echo "Built: backend/dist/qmanager-core"
else
  echo "--> 1. Compiling Linux ARMv7 (Quectel RM520N / SDXLEMUR / 32-bit ARM)..."
  GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s -w" -o dist/qmanager-core-armv7 ./cmd/server

  echo "--> 2. Compiling Linux ARM64 / AArch64 (Raspberry Pi 4/5, NanoPi, ARM64 Routers)..."
  GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o dist/qmanager-core-arm64 ./cmd/server

  echo "--> 3. Compiling Linux AMD64 / x86_64 (x86 Routers, PC, VMs)..."
  GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o dist/qmanager-core-amd64 ./cmd/server

  cp dist/qmanager-core-armv7 dist/qmanager-core
  echo "Built default alias: backend/dist/qmanager-core"
fi

echo ""
echo "=== Build Completed Successfully! ==="
ls -lh dist/

#!/bin/bash
# =============================================================================
# build-go.sh — Unified Build Script for QManager Go Edition
# =============================================================================
# 1. Builds Next.js static export into out/
# 2. Syncs out/ to backend/web/out/ for Go embed.FS
# 3. Cross-compiles Go backend for RM520N-GL (ARMv7)
# =============================================================================

set -e

echo "=== Step 1: Building Next.js Static Export ==="
bun run build

echo "=== Step 2: Copying Web Assets to Go Embed Path ==="
mkdir -p backend/web/out
rm -rf backend/web/out/*
cp -r out/* backend/web/out/

echo "=== Step 3: Cross-Compiling Go Core for RM520N-GL (ARMv7) ==="
cd backend
export CGO_ENABLED=0
export GOOS=linux
export GOARCH=arm
export GOARM=7

go build -ldflags="-s -w" -o dist/qmanager-core ./cmd/server

echo ""
echo "=== Build Completed Successfully! ==="
echo "Executable: backend/dist/qmanager-core"
ls -lh dist/qmanager-core

#!/bin/bash
# Cross-compile script for Quectel RM520N-GL (ARMv7 Cortex-A7 VFPv4)

set -e

echo "=== Building QManager Go Core for RM520N-GL (ARMv7) ==="
mkdir -p dist

export CGO_ENABLED=0
export GOOS=linux
export GOARCH=arm
export GOARM=7

go build -ldflags="-s -w" -o dist/qmanager-core ./cmd/server

echo "Build successful: dist/qmanager-core"
ls -lh dist/qmanager-core

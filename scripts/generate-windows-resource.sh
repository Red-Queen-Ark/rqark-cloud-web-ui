#!/bin/sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ARCH=${1:-amd64}

cd "$ROOT/build/windows/syso"
GOFLAGS=-mod=mod go run github.com/wailsapp/wails/v3/cmd/wails3 generate syso \
  -arch "$ARCH" \
  -icon ../icon.ico \
  -manifest ../wails.exe.manifest \
  -out "../../../rqark-agent-cloud_windows_$ARCH.syso"

echo "rqark-agent-cloud_windows_$ARCH.syso"

#!/bin/sh
# Builds the macOS bundle. The Go side needs CGO for the webview, so this runs
# on macOS only; a cross build would need the Wails docker image.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP_NAME="RqArk Agent Cloud"
BIN_NAME="rqark-agent-cloud"
OUT_DIR="$ROOT/bin"
APP="$OUT_DIR/$APP_NAME.app"

cd "$ROOT"

DESKTOP_BUILD=true bun run build
mkdir -p "$OUT_DIR"
go build -trimpath -ldflags "-s -w" -o "$OUT_DIR/$BIN_NAME" .

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$OUT_DIR/$BIN_NAME" "$APP/Contents/MacOS/$BIN_NAME"
cp build/darwin/Info.plist "$APP/Contents/Info.plist"
cp build/darwin/icon.icns "$APP/Contents/Resources/icon.icns"
printf 'APPL????' > "$APP/Contents/PkgInfo"

codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

echo "$APP"

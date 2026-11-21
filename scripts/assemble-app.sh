#!/bin/sh
# Assembles the macOS bundle from an already built binary.
#
# Runs anywhere: a bundle is a directory, a plist, an icon and the executable.
# Signing is what needs macOS, so this leaves the bundle unsigned and the caller
# signs it (or ad-hoc signs it, which is enough for local use).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP_NAME="RqArk Cloud Desktop"
BIN_NAME="rqark-cloud-desktop"

BIN=${1:-"$ROOT/bin/$BIN_NAME"}
OUT=${2:-"$ROOT/bin/$APP_NAME.app"}

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"

cp "$BIN" "$OUT/Contents/MacOS/$BIN_NAME"
cp "$ROOT/build/darwin/Info.plist" "$OUT/Contents/Info.plist"
cp "$ROOT/build/darwin/icon.icns" "$OUT/Contents/Resources/icon.icns"
printf 'APPL????' > "$OUT/Contents/PkgInfo"

echo "$OUT"

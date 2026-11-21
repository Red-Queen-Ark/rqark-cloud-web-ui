#!/bin/sh
# Builds the macOS app bundle on the host it runs on.
#
# On macOS this compiles natively and ad-hoc signs. On Linux it cross compiles
# through the wails-cross docker image and leaves the bundle unsigned.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN_NAME="rqark-cloud-desktop"
APP_NAME="RqArk Cloud Desktop"
IMAGE=${WAILS_CROSS_IMAGE:-wails-cross}
GOMOD_VOLUME=${WAILS_CROSS_GOMOD_VOLUME:-rqark-wails-gomod}

cd "$ROOT"

DESKTOP_BUILD=true bun run build
mkdir -p bin

if [ "$(uname -s)" = "Darwin" ]; then
  go build -trimpath -ldflags "-s -w" -o "bin/$BIN_NAME" .
  ./scripts/assemble-app.sh "bin/$BIN_NAME"
  codesign --force --deep --sign - "bin/$APP_NAME.app" >/dev/null 2>&1 || true
  echo "bin/$APP_NAME.app"
  exit 0
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -f build/docker/Darwin.Dockerfile -t "$IMAGE" .
fi

# CI keeps the workspace in a docker volume, which the daemon cannot bind mount
# by path: a bind mount of "$ROOT" would arrive empty and the build would find
# no go.mod. The sources are streamed in and the binary streamed out instead.
# The module cache is a named volume, so the dependencies survive between runs.
SRC_TAR=$(mktemp)
OUT_TAR=$(mktemp)
trap 'rm -f "$SRC_TAR" "$OUT_TAR"' EXIT

tar -cf "$SRC_TAR" --exclude=./node_modules --exclude=./.git --exclude=./bin .

docker run --rm -i \
  -v "$GOMOD_VOLUME":/go/pkg/mod \
  -e GOMODCACHE=/go/pkg/mod \
  -e BIN_NAME="$BIN_NAME" \
  "$IMAGE" \
  sh -c '
    set -e
    mkdir -p /src
    tar -xf - -C /src
    cd /src
    CC=cc-darwin-arm64 CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 \
      go build -trimpath -ldflags "-s -w" -o "/tmp/$BIN_NAME" .
    tar -cf - -C /tmp "$BIN_NAME"
  ' <"$SRC_TAR" >"$OUT_TAR"

tar -xf "$OUT_TAR" -C bin
./scripts/assemble-app.sh "bin/$BIN_NAME"
echo "bin/$APP_NAME.app"

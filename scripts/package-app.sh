#!/bin/sh
# Builds the macOS app bundle on the host it runs on.
#
# On macOS this compiles natively and ad-hoc signs. On Linux it cross compiles
# through the wails-cross docker image and leaves the bundle unsigned.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN_NAME="rqark-agent-cloud"
APP_NAME="RqArk Agent Cloud"
IMAGE=${WAILS_CROSS_IMAGE:-wails-cross}

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

# The module cache is mounted so the image does not have to download the
# toolchain and the dependencies on every run.
docker run --rm \
  -v "$ROOT":/src \
  -v "${GOMODCACHE:-$HOME/go/pkg/mod}":/go/pkg/mod \
  -v "$ROOT/bin":/out \
  -w /src \
  -e GOMODCACHE=/go/pkg/mod \
  "$IMAGE" \
  sh -c 'CC=cc-darwin-arm64 CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o /out/'"$BIN_NAME"' .'

./scripts/assemble-app.sh "bin/$BIN_NAME"
echo "bin/$APP_NAME.app"

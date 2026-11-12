# Cross-compiler for the macOS bundle, so the Linux runner can produce it.
#
# The Go side needs CGO for the webview, which needs clang and the macOS SDK.
# Zig is the clang here, and the SDK comes from wailsapp/macosx-sdks. Wails does
# not ship that SDK itself: reviewing Apple's license before using it is the
# operator's call.
FROM golang:1.26-bookworm

ARG ZIG_VERSION=0.14.0
ARG MACOS_SDK_VERSION=26.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl xz-utils ca-certificates gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/*

RUN case "$(dpkg --print-architecture)" in \
        amd64) ZARCH=x86_64 ;; \
        arm64) ZARCH=aarch64 ;; \
        *) echo "unsupported architecture" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://ziglang.org/download/${ZIG_VERSION}/zig-linux-${ZARCH}-${ZIG_VERSION}.tar.xz" | tar -xJ -C /opt \
    && ln -s "/opt/zig-linux-${ZARCH}-${ZIG_VERSION}/zig" /usr/local/bin/zig

RUN curl -fsSL -o /tmp/sdk.tar.xz "https://github.com/wailsapp/macosx-sdks/releases/download/${MACOS_SDK_VERSION}/MacOSX${MACOS_SDK_VERSION}.sdk.tar.xz" \
    && tar -xJf /tmp/sdk.tar.xz -C /opt \
    && mv "/opt/MacOSX${MACOS_SDK_VERSION}.sdk" /opt/macos-sdk \
    && rm /tmp/sdk.tar.xz

RUN for TARGET in aarch64-macos-none x86_64-macos-none; do \
        NAME=$(echo "$TARGET" | sed 's/-macos-none//' | sed 's/aarch64/arm64/; s/x86_64/amd64/'); \
        printf '%s\n' '#!/bin/sh' \
            'ARGS=""' \
            'SKIP=0' \
            'for a in "$@"; do' \
            '  if [ $SKIP -eq 1 ]; then SKIP=0; continue; fi' \
            '  case "$a" in' \
            '    -target) SKIP=1 ;;' \
            '    -mmacosx-version-min=*) ;;' \
            '    *) ARGS="$ARGS $a" ;;' \
            '  esac' \
            'done' \
            "exec zig cc -target $TARGET -isysroot /opt/macos-sdk -I/opt/macos-sdk/usr/include -L/opt/macos-sdk/usr/lib -F/opt/macos-sdk/System/Library/Frameworks -w \$ARGS" \
            > "/usr/local/bin/cc-darwin-$NAME"; \
        chmod +x "/usr/local/bin/cc-darwin-$NAME"; \
    done

ENV MACOS_SDK_PATH=/opt/macos-sdk
WORKDIR /src

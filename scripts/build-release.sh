#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

NAME=${BINARY_NAME:-kirikae}
OUT_DIR=${OUT_DIR:-"$ROOT_DIR/release"}
TARGETS=(
  "darwin-arm64"
  "darwin-x64"
  "linux-x64"
  "linux-arm64"
  "windows-x64"
)

mkdir -p "$OUT_DIR"

for target in "${TARGETS[@]}"; do
  outfile="$OUT_DIR/${NAME}-${target}"
  if [[ "$target" == windows-* ]]; then
    outfile="${outfile}.exe"
  fi
  echo "[build] $outfile"
  bun build --compile --target "bun-${target}" --outfile "$outfile" proxy.ts

  # Ad-hoc sign macOS binaries to avoid Gatekeeper issues
  if [[ "$target" == darwin-* ]] && command -v codesign >/dev/null 2>&1; then
    echo "[sign] $outfile"
    codesign --sign - --force --deep "$outfile" 2>/dev/null || true
  fi

  if [[ "$target" == windows-* ]]; then
    zip -j -q "$OUT_DIR/${NAME}-${target}.zip" "$outfile"
  else
    tar -czf "$OUT_DIR/${NAME}-${target}.tar.gz" -C "$OUT_DIR" "${NAME}-${target}"
  fi
  rm -f "$outfile"
done

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT_DIR"/*.tar.gz "$OUT_DIR"/*.zip > "$OUT_DIR/SHA256SUMS"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_DIR"/*.tar.gz "$OUT_DIR"/*.zip > "$OUT_DIR/SHA256SUMS"
fi

echo "[done] Release artifacts in $OUT_DIR"

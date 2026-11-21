#!/usr/bin/env bash
# Regenerates public/sounds/*.mp3 from the synthesiser. Needs python3 and ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
python3 tools/gen-sounds.py "$tmp" >/dev/null
mkdir -p public/sounds
for f in "$tmp"/*.wav; do
  n="$(basename "$f" .wav)"
  ffmpeg -loglevel error -y -i "$f" -ac 1 -c:a libmp3lame -b:a 48k "public/sounds/$n.mp3"
done
ls -l public/sounds

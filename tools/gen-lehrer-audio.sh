#!/usr/bin/env bash
# One call for all audio: texts (explanations + teacher quips) -> count of requests -> generate (skips existing files).
# Usage: tools/gen-lehrer-audio.sh [key-file] [--dry-run | --proben | --proben-heygen] [--deckel USD] [--lauf NAME]
#   key-file   default $OPENROUTER_KEY_FILE, else ~/.config/openrouter.key (the key is read by gen-audio.py and never printed)
#   --dry-run  only show what would be generated (no key, no network)
#   --proben   one German sample with an expression tag per ElevenLabs voice (21) into public/audio/proben/elevenlabs/ (costs money, counts against the cap)
#   --proben-heygen  the old HeyGen samples into public/audio/proben/
#   --deckel   cap in USD for the whole run (default 4.30, samples included; ledger tools/laufzeit/<lauf>.json)
#   --lauf     ledger name (default lehrer-audio)
set -euo pipefail
cd "$(dirname "$0")/.."

key="${OPENROUTER_KEY_FILE:-$HOME/.config/openrouter.key}"
mode="run"
extra=()
expect=""
for a in "$@"; do
  if [ -n "$expect" ]; then extra+=("$expect" "$a"); expect=""; continue; fi
  case "$a" in
    --dry-run) mode="dry" ;;
    --proben) mode="proben" ;;
    --proben-heygen) mode="proben-heygen" ;;
    --deckel|--lauf) expect="$a" ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $a (allowed: --dry-run, --proben, --proben-heygen, --deckel, --lauf)" >&2; exit 2 ;;
    *) key="$a" ;;
  esac
done

fail() { echo "ABORT: $1" >&2; exit 1; }

if [ "$mode" != "dry" ]; then
  [ -f "$key" ] || fail "key file not found: $key (pass the path as the only argument)"
  command -v ffmpeg >/dev/null || fail "ffmpeg/ffprobe is missing (needed for HeyGen conversion and the duration of the files)"
fi

if [ "$mode" = "proben" ]; then
  python3 tools/gen-audio.py --proben --key-file "$key" "${extra[@]}" || fail "samples failed or cap reached (see message above)"
  echo "Listen to public/audio/proben/elevenlabs/*.mp3, then set the voices in content-src/audio/quip-voices.ts"
  exit 0
fi
if [ "$mode" = "proben-heygen" ]; then
  python3 tools/gen-audio.py --proben-heygen --key-file "$key" || fail "samples failed (see message above)"
  exit 0
fi

npm run --silent audio:texts || fail "audio:texts failed"
echo "--- Plan (existing files are skipped) ---"
python3 tools/gen-audio.py --dry-run "${extra[@]}" || fail "dry run failed"
[ "$mode" = "dry" ] && exit 0
echo "--- Generating ---"
python3 tools/gen-audio.py --key-file "$key" "${extra[@]}" || fail "some texts failed or the cap was reached (listed above); run again to retry only those"
echo "Done. public/audio/manifest.json is updated."

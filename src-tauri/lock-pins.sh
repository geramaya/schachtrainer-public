#!/usr/bin/env bash
# Pins crate versions that are younger than 14 days back to approved older versions
# (supply-chain rule: only crate versions at least 14 days old, reviewed before the lock is committed).
# Order matters: the tauri chain runs top-down because of `~` requirements.
# A failing pin is skipped ONLY if the package is no longer in Cargo.lock; any other failure aborts.
# The list is repeated until a pass changes nothing (max. 4 passes).
set -euo pipefail

pin() { # pin <spec> <version>
  local spec="$1" ver="$2" name="${1%%@*}"
  if ! cargo update -p "$spec" --precise "$ver"; then
    # versions of $name currently in the lock
    local cur
    cur=$(awk -v n="$name" '$0=="name = \""n"\"" {getline; gsub(/version = |"/,""); print}' Cargo.lock)
    if [ -z "$cur" ]; then echo "skip (not in lock): $spec"; return 0; fi
    # tolerated only if every locked version is already <= the target (nothing younger left)
    local v
    for v in $cur; do
      if [ "$(printf '%s\n%s\n' "$v" "$ver" | sort -V | tail -n1)" != "$ver" ]; then
        echo "pin failed while $name $v (> $ver) is still in Cargo.lock: $spec -> $ver" >&2
        exit 1
      fi
    done
    echo "skip (already at or below $ver): $spec [$cur]"
  fi
}

pins() {
  pin tauri-runtime-wry 2.12.3
  pin tauri-runtime 2.12.2
  pin tauri-macros 2.7.4
  pin tauri-codegen 2.7.4
  pin tauri-utils 2.10.2
  pin wry 0.57.1
  pin tao 0.37.2
  pin serde_with 3.24.0
  pin serde_with_macros 3.24.0
  pin jiff@0.2.46 0.2.39
  pin jiff-static@0.2.46 0.2.39
  pin jiff-core@0.1.8 0.1.2
  pin jiff-tzdb@0.1.10 0.1.9
  pin toml@1.2.2+spec-1.1.0 1.2.1+spec-1.1.0
  pin toml_edit@0.25.20+spec-1.1.0 0.25.19+spec-1.1.0
  pin toml_parser 1.1.5+spec-1.1.0
  pin regex 1.13.1
  pin regex-automata 0.4.18
  pin regex-syntax 0.8.11
  pin syn@3.0.10 3.0.9
  pin brotli 9.1.1
  pin brotli-decompressor 6.3.0
  pin bit-vec 0.10.1
  pin bumpalo 3.20.3
  pin bytes 1.12.1
  pin cc 1.11.1
  pin const-oid 0.10.2
  pin crc32fast 1.5.4
  pin ctor 1.0.13
  pin url 2.5.8
  pin form_urlencoded 1.2.2
  pin itoa 1.0.18
  pin link-section 0.19.3
  pin mio 1.2.4
  pin pin-project-lite 0.2.17
  pin plist 1.10.3
  pin smallvec 1.16.5
  pin uuid 1.29.1
  pin walkdir 2.5.0
}

for pass in 1 2 3 4; do
  before=$(sha256sum Cargo.lock)
  pins
  after=$(sha256sum Cargo.lock)
  echo "pass $pass: $( [ "$before" = "$after" ] && echo unchanged || echo changed )"
  [ "$before" = "$after" ] && exit 0
done
echo "Cargo.lock did not settle after 4 passes" >&2
exit 1

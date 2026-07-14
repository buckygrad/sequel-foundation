#!/usr/bin/env bash
# Deletes iCloud Drive conflict copies — files like "name 2.ts" created next to
# "name.ts" when iCloud sync races a writer. On this repo they break tsc
# (.next/types dups), git/gh ("bad object refs/heads/x 2"), and ride into
# commits via `git add -A`.
#
# SAFE BY CONSTRUCTION: a path is deleted ONLY when its suffix-stripped
# original exists beside it — a legitimately-named "Chapter 2.md" with no
# "Chapter.md" sibling is never touched. node_modules is skipped (its iCloud
# corruption has a different runbook: rm -rf node_modules && npm ci).
#
# Usage:
#   scripts/clean-icloud-dups.sh          # full repo scan (npm pretest/prebuild)
#   scripts/clean-icloud-dups.sh --fast   # .git + .next only (the command-time
#                                         # bite points; used by the Claude hook)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--fast" ]]; then
  roots=()
  [[ -d .git ]] && roots+=(.git)
  [[ -d .next ]] && roots+=(.next)
  [[ ${#roots[@]} -eq 0 ]] && exit 0
else
  roots=(.)
fi

re='^(.+) [0-9]+(\.[^.]+)?$'
removed=0
while IFS= read -r -d '' f; do
  base="${f##*/}"
  dir="${f%/*}"
  if [[ "$base" =~ $re ]]; then
    orig="$dir/${BASH_REMATCH[1]}${BASH_REMATCH[2]:-}"
    if [[ -e "$orig" && "$orig" != "$f" ]]; then
      rm -rf -- "$f"
      echo "removed iCloud dup: $f"
      removed=$((removed + 1))
    fi
  fi
done < <(find "${roots[@]}" \( -name node_modules -prune \) -o \( -name "* [0-9]" -o -name "* [0-9].*" \) -print0 2>/dev/null)

if [[ $removed -gt 0 ]]; then
  echo "clean-icloud-dups: removed $removed conflict cop$( [[ $removed -eq 1 ]] && echo y || echo ies )"
fi

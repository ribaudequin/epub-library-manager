#!/usr/bin/env bash
# Dated snapshot of the unversioned memory files.
#
# MEMORY.md, TODO.md, PLAN.md and AGENTS.md are gitignored (see .gitignore), so
# this script is the only thing standing between a bad edit and losing the
# project's working context. There is no other backup.
#
# Adapted from clavis's scripts/snapshot-memory.sh. Differences here:
#   - no SUMMARY.md and no MEMORY/ partition folder in this project
#   - the plan file is PLAN.md, not PLANO.md
#   - snapshots live in .memory-snapshots/ rather than MEMORY/snapshots/, because
#     this project's .gitignore ignores *.md and this keeps them out of the way
#     of any future rule without depending on it
#
# Run at the end of each session, after MEMORY.md -> TODO.md.
set -euo pipefail

cd "$(dirname "$0")/.."

KEEP="${MEMORY_SNAPSHOT_KEEP:-20}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST=".memory-snapshots/$STAMP"

mkdir -p "$DEST"

for f in MEMORY.md TODO.md PLAN.md AGENTS.md MEMORY-ARCHIVE.md; do
  [ -f "$f" ] && cp "$f" "$DEST/"
done

echo "snapshot -> $DEST"

# Prune to the newest $KEEP snapshots.
if [ "$(find .memory-snapshots -mindepth 1 -maxdepth 1 -type d | wc -l)" -gt "$KEEP" ]; then
  find .memory-snapshots -mindepth 1 -maxdepth 1 -type d \
    | sort \
    | head -n "-$KEEP" \
    | xargs -r rm -rf
  echo "pruned to newest $KEEP snapshots"
fi

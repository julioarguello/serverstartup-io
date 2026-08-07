#!/usr/bin/env bash
# kb-backup.sh — mirror the gitignored knowledge base to Dropbox.
# The whole KB (docs/company/, curated + private/) is local-only since 2026-08-07; Dropbox
# provides the off-machine copy and version history. Never deletes on the
# destination — additions and updates only.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/docs/company/"
DEST="$HOME/Library/CloudStorage/Dropbox/Documents/Profesional/Documentación/ServerStartup/kb-backup/"

[ -d "$SRC" ] || { echo "ERROR: $SRC not found" >&2; exit 1; }
[ -d "$(dirname "$DEST")" ] || { echo "ERROR: Dropbox target parent not found: $(dirname "$DEST")" >&2; exit 1; }

mkdir -p "$DEST"
rsync -av "$SRC" "$DEST"
echo "Backed up $(find "$SRC" -type f | wc -l | tr -d ' ') files to $DEST"

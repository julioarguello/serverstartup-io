#!/usr/bin/env bash
# Sync the private working repo's main (+tags) to the public mirror.
# Run after each merge to main. The public repo receives ONLY main and tags —
# never branches, never anything outside the purged lineage (issue #160).
set -euo pipefail
git push public main --tags
echo "public mirror synced: https://github.com/julioarguello/serverstartup-io"

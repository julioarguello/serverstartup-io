#!/bin/bash
# cf-zombie-clean.sh — Kill stale MCP and workerd zombie processes
#
# Prevents Cloudflare API rate limiting (429) caused by accumulated
# mcp-remote processes from old Antigravity sessions.
#
# Usage:
#   ./cf-zombie-clean.sh            # One-shot cleanup
#   ./cf-zombie-clean.sh --install  # Install LaunchAgent (every 30 min)
#   ./cf-zombie-clean.sh --uninstall # Remove LaunchAgent
#
# Naming: cf (cloudflare-ops prefix) - zombie (noun) - clean (verb)

set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
PLIST_NAME="io.serverstartup.cf-zombie-clean"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG_DIR="$HOME/.local/log"
LOG_FILE="$LOG_DIR/cf-zombie-clean.log"
MAX_AGE_SECONDS=7200  # 2 hours

# ── Install / Uninstall ────────────────────────────────────────────
install_agent() {
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
    cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${SCRIPT_PATH}</string>
    </array>
    <key>StartInterval</key>
    <integer>1800</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/cf-zombie-clean-stderr.log</string>
</dict>
</plist>
PLIST
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    echo "✅ LaunchAgent installed and loaded: runs every 30 minutes"
    echo "   Plist: $PLIST_PATH"
    echo "   Log:   $LOG_FILE"
}

uninstall_agent() {
    if [ -f "$PLIST_PATH" ]; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        rm "$PLIST_PATH"
        echo "✅ LaunchAgent uninstalled"
    else
        echo "⚠️  LaunchAgent not found at $PLIST_PATH"
    fi
}

# ── Cleanup logic ──────────────────────────────────────────────────
cleanup() {
    local NOW KILLED=0

    NOW=$(date +%s)
    mkdir -p "$LOG_DIR"

    # Kill old mcp-remote cloudflare processes
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        local PID START START_EPOCH AGE
        PID=$(echo "$line" | awk '{print $2}')
        START=$(ps -p "$PID" -o lstart= 2>/dev/null) || continue
        [ -z "$START" ] && continue
        START_EPOCH=$(date -j -f "%c" "$START" +%s 2>/dev/null) || continue
        [ -z "$START_EPOCH" ] && continue
        AGE=$(( NOW - START_EPOCH ))
        if [ "$AGE" -gt "$MAX_AGE_SECONDS" ]; then
            kill "$PID" 2>/dev/null && KILLED=$((KILLED + 1))
        fi
    done < <(ps aux | grep -E "mcp-remote.*cloudflare|npm exec mcp-remote.*cloudflare" | grep -v grep)

    # Kill old workerd processes (abandoned dev servers)
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        local PID START START_EPOCH AGE
        PID=$(echo "$line" | awk '{print $2}')
        START=$(ps -p "$PID" -o lstart= 2>/dev/null) || continue
        [ -z "$START" ] && continue
        START_EPOCH=$(date -j -f "%c" "$START" +%s 2>/dev/null) || continue
        [ -z "$START_EPOCH" ] && continue
        AGE=$(( NOW - START_EPOCH ))
        if [ "$AGE" -gt "$MAX_AGE_SECONDS" ]; then
            kill "$PID" 2>/dev/null && KILLED=$((KILLED + 1))
        fi
    done < <(ps aux | grep "workerd serve" | grep -v grep)

    if [ "$KILLED" -gt 0 ]; then
        echo "$(date -Iseconds) — Killed $KILLED zombie process(es)" >> "$LOG_FILE"
        echo "🧹 Killed $KILLED zombie process(es)"
    else
        echo "✅ No zombies found"
    fi
}

# ── Main ───────────────────────────────────────────────────────────
case "${1:-}" in
    --install)   install_agent ;;
    --uninstall) uninstall_agent ;;
    *)           cleanup ;;
esac

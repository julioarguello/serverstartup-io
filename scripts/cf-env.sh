#!/usr/bin/env bash
# cloudflare-env.sh — thin shell wrapper for cloudflare-env.py (source mode)
# Usage: . cloudflare-env.sh [-e dev|staging|prod]
eval "$(python3 "$(dirname "$0")/cf-env.py" --shell "$@")"

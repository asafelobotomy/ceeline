#!/usr/bin/env bash
# Encode canonical input into a Ceeline envelope.
# Usage: encode.sh '<json input>'
# Input: JSON with surface, intent, payload (and optional text, source fields)
# Output: validated Ceeline envelope JSON on stdout
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

CLI="$REPO_ROOT/packages/cli/dist/index.js"
if [[ ! -f "$CLI" ]]; then
  echo '{"error":"ceeline CLI not built. Run npm run build in the ceeline repo root."}' >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  echo "$1" | node "$CLI" encode
else
  node "$CLI" encode
fi

#!/usr/bin/env bash
# Decode a Ceeline envelope into canonical meaning.
# Usage: decode.sh '<json envelope>'
# Output: decoded envelope JSON on stdout
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

CLI="$REPO_ROOT/packages/cli/dist/index.js"
if [[ ! -f "$CLI" ]]; then
  echo '{"error":"ceeline CLI not built. Run npm run build in the ceeline repo root."}' >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  echo "$1" | node "$CLI" decode
else
  node "$CLI" decode
fi

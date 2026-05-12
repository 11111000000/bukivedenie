#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

PYTHON_CMD=${PYTHON_CMD:-python3}
API_URL=${SMOKE_API_BASE:-http://127.0.0.1:8000}
BACKEND_LOG="$ROOT_DIR/logs/backend-dev.log"

wait_for_http() {
  url=$1
  for _ in {1..90}; do
    if "$PYTHON_CMD" - "$url" <<'PY' >/dev/null 2>&1
import sys
import urllib.request

url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=1) as resp:
        resp.read(1)
except Exception:
    raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

if ! wait_for_http "$API_URL/api/books"; then
  mkdir -p "$ROOT_DIR/logs"
  echo "Starting backend because $API_URL is unavailable"
  ( bash "$ROOT_DIR/scripts/backend.sh" > "$BACKEND_LOG" 2>&1 ) &
  BACKEND_PID=$!
  trap 'kill "$BACKEND_PID" >/dev/null 2>&1 || true' EXIT INT TERM
  wait_for_http "$API_URL/api/books" || {
    echo "Backend failed to start. Check $BACKEND_LOG" >&2
    exit 1
  }
fi

cd "$ROOT_DIR/frontend"
exec node ../scripts/ui_smoke.mjs "$@"

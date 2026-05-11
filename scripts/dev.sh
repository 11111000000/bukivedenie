#!/usr/bin/env bash
# Start backend and frontend dev servers and forward signals to children.
# Usage: ./scripts/dev.sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

PYTHON_CMD=${PYTHON_CMD:-python}
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_LOG="$ROOT_DIR/logs/backend-dev.log"
FRONTEND_LOG="$ROOT_DIR/logs/frontend-dev.log"

mkdir -p "$ROOT_DIR/logs"

pids=()

cleanup() {
  echo "Stopping children..."
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
    fi
  done
  wait 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

# Start backend
echo "Starting backend: $PYTHON_CMD -m src.webapp --host 127.0.0.1 --port 8000"
( $PYTHON_CMD -m src.webapp --host 127.0.0.1 --port 8000 ) > "$BACKEND_LOG" 2>&1 &
pid_backend=$!
pids+=("$pid_backend")
echo "Backend PID=$pid_backend, log=$BACKEND_LOG"

# Wait for backend to open port
printf "Waiting for backend to be ready..."
for i in {1..60}; do
  if nc -z 127.0.0.1 8000 2>/dev/null; then
    echo " ready"
    break
  fi
  printf "."
  sleep 0.5
done

# Start frontend watcher (rollup/browser-sync) if possible; fallback to local python dev server
if [ -d "$FRONTEND_DIR" ]; then
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo "Node detected. Starting frontend watcher (skip dependency install if node_modules already exists) in $FRONTEND_DIR"
    (
      cd "$FRONTEND_DIR" || exit 1

      # Only install when dependencies are missing or caller explicitly requests reinstall.
      NEED_INSTALL=0
      if [ "${DEV_REINSTALL:-0}" = "1" ]; then
        NEED_INSTALL=1
      elif [ ! -d node_modules ] || [ ! -x node_modules/.bin/rollup ]; then
        NEED_INSTALL=1
      fi

      if [ "$NEED_INSTALL" -eq 1 ]; then
        echo "Installing frontend deps..."
        if [ -f package-lock.json ]; then
          echo "Running: npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund"
          npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund || \
          npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund || exit 1
        else
          echo "Running: npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund"
          npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund || exit 1
        fi
      else
        echo "Dependencies already present; skipping npm install"
      fi

      # start rollup watcher if available, otherwise try browser-sync
      npm run dev:rollup || npm run dev:bs || exit 1
    ) > "$FRONTEND_LOG" 2>&1 &
    pid_frontend=$!
    pids+=("$pid_frontend")
    echo "Frontend PID=$pid_frontend, log=$FRONTEND_LOG"
    # short wait to detect fast failures
    sleep 2
    if ! kill -0 "$pid_frontend" 2>/dev/null; then
      echo "Frontend watcher failed to start or exited quickly. Falling back to python dev proxy. Check $FRONTEND_LOG" >&2
      # start python fallback dev server
      ( python3 "$ROOT_DIR/scripts/dev_local.py" ) > "$FRONTEND_LOG" 2>&1 &
      pid_fallback=$!
      pids+=("$pid_fallback")
      echo "Fallback dev server PID=$pid_fallback, log=$FRONTEND_LOG"
    fi
  else
    echo "Node/npm not available; starting python dev proxy server"
    ( python3 "$ROOT_DIR/scripts/dev_local.py" ) > "$FRONTEND_LOG" 2>&1 &
    pid_fallback=$!
    pids+=("$pid_fallback")
    echo "Fallback dev server PID=$pid_fallback, log=$FRONTEND_LOG"
  fi
else
  echo "Frontend dir not found: $FRONTEND_DIR" >&2
fi

# Tail logs (both) in foreground
# Use tail -f to follow logs; exit when children exit

# Tail both logs in background if available
if command -v tail >/dev/null 2>&1; then
  echo "Tailing logs. Press Ctrl-C to stop."
  tail -f "$BACKEND_LOG" "$FRONTEND_LOG" &
  tail_pid=$!
  pids+=("$tail_pid")
fi

# Wait for children
wait
cleanup

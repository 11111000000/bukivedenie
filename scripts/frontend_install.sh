#!/bin/sh
set -eu

mkdir -p logs
LOG="logs/frontend-install.log"

echo "Running frontend install; logs will be written to $LOG"
cd frontend || exit 1

# Try npm ci first, fallback to npm install. Strip ANSI colors and tee output to log.
CI=true NPM_CONFIG_PROGRESS=false npm ci --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund --no-optional --loglevel=info --no-progress 2>&1 | sed -u 's/\x1b\[[0-9;]*m//g' | tee "../$LOG" || {
  echo "npm ci failed, retrying with npm install..." | tee -a "../$LOG"
  CI=true NPM_CONFIG_PROGRESS=false npm install --no-bin-links --legacy-peer-deps --no-audit --unsafe-perm --prefer-offline --no-fund --no-optional --loglevel=info --no-progress 2>&1 | sed -u 's/\x1b\[[0-9;]*m//g' | tee -a "../$LOG"
}

echo "Install finished; see ../$LOG for full output"

echo "Last 200 lines of log:"
tail -n 200 "../$LOG" || true

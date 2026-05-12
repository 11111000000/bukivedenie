#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

PYTHON_CMD=${PYTHON_CMD:-python3}

exec "$PYTHON_CMD" -m src.webapp --host 127.0.0.1 --port 8000

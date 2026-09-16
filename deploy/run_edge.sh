#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ulimit -n "${HUIJU_NOFILE_LIMIT:-65535}"

/workspace/sglang-venv/bin/python -m backend.huiju.core.preflight --static-assets-only

exec /workspace/sglang-venv/bin/python -m uvicorn backend.huiju.edge.app:app \
  --host 0.0.0.0 \
  --port 8081 \
  --workers 4 \
  --loop uvloop \
  --http h11 \
  --limit-concurrency 4096 \
  --backlog 4096 \
  --timeout-keep-alive 10 \
  --no-access-log

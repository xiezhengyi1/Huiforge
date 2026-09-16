#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# The container grants a high hard limit but supervisor's child default is
# 1024, which is below the 1000-online-user target once logs and databases are
# counted. Raise only this service's soft limit.
ulimit -n "${HUIJU_NOFILE_LIMIT:-65535}"

exec /workspace/sglang-venv/bin/python -m uvicorn backend.huiju.api.app:app \
  --host 0.0.0.0 \
  --port 8081 \
  --workers 1 \
  --loop uvloop \
  --http h11 \
  --limit-concurrency 4096 \
  --backlog 4096 \
  --timeout-keep-alive 10 \
  --no-access-log

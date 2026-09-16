#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

worker_index="${1:?worker index required}"
port="$((8100 + worker_index))"
ulimit -n "${HUIJU_NOFILE_LIMIT:-65535}"

if [[ "${worker_index}" == "0" ]]; then
  export HUIJU_MEDIA_WORKER_ENABLED=1
  export HUIJU_GPU_WARMUP_ENABLED=1
else
  export HUIJU_MEDIA_WORKER_ENABLED=0
  export HUIJU_GPU_WARMUP_ENABLED=0
fi

exec /workspace/sglang-venv/bin/python -m uvicorn backend.huiju.api.app:app \
  --host 127.0.0.1 \
  --port "${port}" \
  --workers 1 \
  --loop uvloop \
  --http h11 \
  --proxy-headers \
  --forwarded-allow-ips 127.0.0.1 \
  --limit-concurrency 1536 \
  --backlog 2048 \
  --timeout-keep-alive 20 \
  --no-access-log

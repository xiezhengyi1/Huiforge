#!/usr/bin/env bash
set -euo pipefail

release_name="${1:?release name required}"
archive="${2:?archive path required}"
root=/workspace/huiju-api
release="$root/releases/$release_name"
current="$root/current"
config=/etc/supervisor/conf.d/huiju-api.conf
previous_link="$(readlink "$current")"
source_release="$(readlink -f "$current")"
backup="$root/backups/pre-$release_name-$(date +%Y%m%d-%H%M%S)"
switched=0
config_changed=0

rollback() {
  trap - EXIT
  set +e
  supervisorctl stop huiju-api huiju-backends:* >/dev/null 2>&1
  if [[ "$config_changed" == 1 ]]; then cp "$backup/huiju-api.conf" "$config"; fi
  if [[ "$switched" == 1 ]]; then
    ln -s "$previous_link" "$root/current.rollback"
    mv -Tf "$root/current.rollback" "$current"
  fi
  supervisorctl reread >/dev/null 2>&1
  supervisorctl update >/dev/null 2>&1
  supervisorctl restart huiju-backends:* huiju-api >/dev/null 2>&1
}
trap 'code=$?; if [[ $code -ne 0 ]]; then rollback; fi; exit $code' EXIT

test -s "$archive"
case "$source_release" in "$root"/releases/*) ;; *) exit 2 ;; esac
test ! -e "$release"
printf 'step=release_target_ready\n'

mkdir -p "$release" "$root/shared/var" "$backup"
cp "$config" "$backup/huiju-api.conf"
printf '%s\n' "$previous_link" > "$backup/current-release"
tar -xzf "$archive" -C "$release"
chmod +x "$release/deploy/run_edge.sh" "$release/deploy/run_backend.sh"
ln -s "$root/shared/var" "$release/var"
if [[ -f "$source_release/.env" ]]; then ln -s "$source_release/.env" "$release/.env"; fi
printf 'step=source_extracted\n'

test -f "$release/backend/huiju/api/app.py"
test -f "$release/backend/huiju/edge/app.py"
test -f "$release/frontend/pages/studio.html"
test -f "$release/frontend/js/features/workflow/schema.js"

(
  cd "$release"
  /workspace/sglang-venv/bin/python -m compileall -q backend
  HUIJU_MEDIA_WORKER_ENABLED=0 HUIJU_GPU_WARMUP_ENABLED=0 \
    /workspace/sglang-venv/bin/python -m backend.huiju.core.preflight --static-assets-only
)
printf 'step=preflight_passed\n'

grep -q 'run_edge.sh' "$config"
grep -q 'run_backend.sh' "$config"
sed -i 's#run_edge.sh#deploy/run_edge.sh#g; s#run_backend.sh#deploy/run_backend.sh#g' "$config"
sed -E -i 's#(deploy/)+run_edge\.sh#deploy/run_edge.sh#g; s#(deploy/)+run_backend\.sh#deploy/run_backend.sh#g' "$config"
config_changed=1
printf 'step=supervisor_entry_updated\n'

ln -s "releases/$release_name" "$root/current.next"
mv -Tf "$root/current.next" "$current"
switched=1
printf 'step=current_switched\n'
supervisorctl reread
supervisorctl update
printf 'step=supervisor_reloaded\n'
supervisorctl restart huiju-backends:* huiju-api
printf 'step=services_restarted\n'

for _ in $(seq 1 90); do
  if curl -fsS -o /tmp/huiju-release-ready.json http://127.0.0.1:8081/api/v1/health/ready; then break; fi
  sleep 1
done
test -s /tmp/huiju-release-ready.json
printf 'step=ready_payload_received\n'
/workspace/sglang-venv/bin/python - "$release_name" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path("/tmp/huiju-release-ready.json").read_text())
assert payload["release"] == sys.argv[1]
PY
printf 'step=ready_release_verified\n'

switched=0
trap - EXIT
printf 'release=%s\n' "$release_name"
printf 'previous=%s\n' "$previous_link"
printf 'status=ready\n'

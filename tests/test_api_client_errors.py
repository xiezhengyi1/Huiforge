from pathlib import Path
import subprocess


def test_json_client_preserves_public_api_error_for_actionable_feedback():
    module = Path(__file__).resolve().parents[1] / "frontend/js/core/api-client.js"
    script = f"import {{fetchJson}} from {module.as_uri()!r};\n" + """
import assert from 'node:assert/strict';
globalThis.window = globalThis;
globalThis.fetch = async () => ({ok:false,status:402,headers:new Headers(),json:async()=>({detail:'credits_insufficient'})});
await assert.rejects(fetchJson('/api/v1/video-workflows/jobs'),error => error.status===402 && error.body.detail==='credits_insufficient');
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

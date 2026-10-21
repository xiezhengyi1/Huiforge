from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def test_local_draft_identity_and_storage_failures():
    source = (ROOT / "frontend/js/app.js").read_text(encoding="utf-8")

    def function(name):
        start = source.index(f"function {name}(")
        return source[start:source.index("\n}", start) + 2]

    functions = "\n".join(function(name) for name in (
        "workflowRecordFromDialog", "readLocalWorkflows", "writeLocalWorkflows",
        "updateWorkflowDraftStatus", "saveWorkflowLocally", "loadWorkflowRecord",
    ))
    script = r'''
const assert = require('node:assert/strict');
const WORKFLOW_LOCAL_KEY = 'drafts';
let currentWorkflowDraft = null;
let storage = '[]';
let failWrite = false;
const window = { localStorage: {
  getItem: () => storage,
  setItem: (key, value) => { if (failWrite) throw new Error('quota'); storage = value; },
}};
const workflowShareName = { value: '原稿' };
const workflowShareDescription = { value: '说明' };
const workflowShareTags = { value: '角色,雨夜' };
const workflowShareStatus = { textContent: '' };
const status = { textContent: '' };
const document = { querySelector: () => status };
const serializeWorkflowGraph = () => ({ version: 6, nodes: [], edges: [] });
const activeWorkflowScope = 'local';
const renderSharedWorkflows = () => {};
const showWorkflowToast = () => {};
const loadWorkflowGraph = graph => { currentWorkflowDraft = null; };
''' + functions + r'''
saveWorkflowLocally();
const original = readLocalWorkflows()[0];
workflowShareName.value = '修订';
saveWorkflowLocally();
assert.equal(readLocalWorkflows().length, 1);
assert.equal(currentWorkflowDraft.id, original.id);
assert.equal(currentWorkflowDraft.created_at, original.created_at);
assert.ok(currentWorkflowDraft.updated_at >= original.created_at);
assert.equal(currentWorkflowDraft.name, '修订');

saveWorkflowLocally(true);
const copyId = currentWorkflowDraft.id;
assert.notEqual(copyId, original.id);
assert.equal(readLocalWorkflows().length, 2);
workflowShareName.value = '副本';
saveWorkflowLocally();
assert.equal(readLocalWorkflows().find(x => x.id === original.id).name, '修订');

loadWorkflowRecord(original, 'local');
assert.equal(currentWorkflowDraft.id, original.id);
assert.equal(workflowShareName.value, '原稿');
assert.equal(workflowShareDescription.value, '说明');
assert.equal(workflowShareTags.value, '角色、雨夜');
saveWorkflowLocally();
assert.equal(readLocalWorkflows().length, 2);

failWrite = true;
const before = storage;
saveWorkflowLocally(true);
assert.equal(storage, before);
assert.equal(currentWorkflowDraft.id, original.id);
assert.match(workflowShareStatus.textContent, /存储空间不足/);
failWrite = false;

loadWorkflowRecord(original, 'community');
assert.equal(currentWorkflowDraft, null);
saveWorkflowLocally();
assert.notEqual(currentWorkflowDraft.id, original.id);
assert.equal(readLocalWorkflows().length, 3);
loadWorkflowRecord(original, 'import');
assert.equal(currentWorkflowDraft, null);
saveWorkflowLocally();
assert.equal(readLocalWorkflows().length, 4);
'''
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr

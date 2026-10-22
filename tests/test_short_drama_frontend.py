from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]

SHARED_WORKSPACE_DOM = r'''
class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.selectors = new Map();
    this.classList = {toggle() {}};
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  querySelector(selector) { return this.selectors.get(selector) || null; }
  querySelectorAll() { return this.children.filter(node => node.tag === 'button'); }
  focus() {}
  scrollIntoView() {}
  get lastElementChild() { return this.children.at(-1); }
}
function createWorkspace() {
  const nodes = new Map(['sessions', 'messages', 'empty', 'prompt', 'tool-prompt', 'auto-execute', 'send', 'button-label', 'status', 'login', 'new', 'refresh-jobs', 'form', 'stage'].map(id => [id, new Element()]));
  const root = new Element();
  root.id = 'quick-workspace';
  root.ownerDocument = {createElement(tag) { const node = new Element(); node.tag = tag; return node; }};
  root.selectors.set('#prompt', nodes.get('prompt'));
  root.selectors.set('#tool-prompt', nodes.get('tool-prompt'));
  root.selectors.set('#generation-form', nodes.get('form'));
  root.selectors.set('#generate-button', nodes.get('send'));
  root.selectors.set('#result-stage', nodes.get('stage'));
  for (const id of ['sessions', 'messages', 'empty', 'auto-execute', 'status', 'login', 'new', 'refresh-jobs']) root.selectors.set('#short-drama-' + id, nodes.get(id));
  nodes.get('send').selectors.set('.button-label', nodes.get('button-label'));
  nodes.get('button-label').textContent = '生成';
  return {root, nodes};
}
'''


def test_short_drama_capabilities_open_the_agent_workspace():
    from fastapi.testclient import TestClient
    from backend.huiju.api.app import app

    response = TestClient(app).get("/api/v1/capabilities")
    items = {item["id"]: item for group in response.json()["groups"] for item in group["items"]}
    assert items["short-drama-agent"]["action"] == "short_drama_agent"
    assert items["script-to-board"]["action"] == "short_drama_agent"


def test_session_tasks_restore_without_duplicate_assistant_summaries():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ collectShortDramaTasks }} from {module.as_uri()!r};\n" + r'''
import assert from 'node:assert/strict';
const image = { name:'generate_image', arguments:{prompt:'角色定妆图'}, result:{ok:true,job_id:'image-1',status:'queued',status_url:'/api/v1/images/jobs/image-1'} };
const audio = { name:'synthesize_speech', arguments:{text:'你好'}, result:{ok:true,job_id:'audio-1',status:'queued',status_url:'/api/v1/audio/jobs/audio-1'} };
const failed = { name:'generate_video', arguments:{prompt:'雨夜'}, result:{ok:false,error:'insufficient_credits'} };
const messages = [
  {id:'m1',role:'user',content:'请生成'},
  {id:'m2',role:'tool',tool:image},
  {id:'m3',role:'tool',tool:audio},
  {id:'m4',role:'assistant',content:'已提交',tool:{tools:[image,audio]}},
  {id:'m5',role:'tool',tool:image},
  {id:'m6',role:'tool',tool:failed},
  {id:'m7',role:'tool',tool:{name:'get_job_status',arguments:{job_id:'image-1'},result:{ok:true,job_id:'image-1',status:'running'}}},
];
const tasks = collectShortDramaTasks(messages);
assert.deepEqual(tasks.map(t=>[t.name,t.result.job_id]),[
  ['generate_image','image-1'],['synthesize_speech','audio-1'],['generate_video',undefined],
]);
assert.equal(tasks[2].result.error,'insufficient_credits');
assert.deepEqual(collectShortDramaTasks([]),[]);
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_reopening_during_message_submission_keeps_controls_locked_without_refetch():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
let releasePost;
let postPending = false;
let getRequests = 0;
const request = async (url, options) => {
  if (options.method === 'POST') {
    postPending = true;
    return new Promise(resolve => { releasePost = () => { postPending = false; resolve({body: {}}); }; });
  }
  getRequests += 1;
  return {body: url.endsWith('/sessions') ? {items: [{id, title: '会话', updated_at: 1}]} : {id, title: '会话', messages: []}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange() {}});
await controller.open(true);
nodes.get('tool-prompt').value = '继续规划';
const sending = nodes.get('form').listeners.submit({preventDefault() {}});
assert.equal(postPending, true);
assert.equal(nodes.get('send').disabled, true);
const priorGetRequests = getRequests;
await controller.open(true);
assert.equal(postPending, true);
assert.equal(nodes.get('send').disabled, true, 'reopening cannot unlock a pending submission');
assert.equal(nodes.get('tool-prompt').disabled, true);
assert.equal(getRequests, priorGetRequests, 'reopening must not reload a session while it is being submitted');
releasePost();
await sending;
assert.equal(nodes.get('send').disabled, false);
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_switching_sessions_during_poll_resumes_the_current_session_polling():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const timers = new Map();
let timerId = 0;
globalThis.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
globalThis.clearTimeout = id => timers.delete(id);
const fireTimer = () => {
  assert.equal(timers.size, 1);
  const [id, callback] = timers.entries().next().value;
  timers.delete(id);
  return callback();
};
const {root, nodes} = createWorkspace();
let releaseA;
let aQueries = 0;
let bQueries = 0;
const task = id => ({id: 'message-' + id, role: 'tool', tool: {
  name: 'generate_image', arguments: {prompt: '角色图'},
  result: {ok: true, job_id: 'job-' + id, status: 'queued', status_url: '/jobs/' + id, credits: 0},
}});
const request = async url => {
  if (url.endsWith('/sessions')) return {body: {items: [{id: 'A', title: 'A', updated_at: 1}, {id: 'B', title: 'B', updated_at: 1}]}};
  if (url === '/jobs/A') {
    aQueries += 1;
    if (aQueries === 2) return new Promise(resolve => { releaseA = () => resolve({body: {status: 'queued'}}); });
    return {body: {status: 'queued'}};
  }
  if (url === '/jobs/B') {
    bQueries += 1;
    return {body: {status: 'completed', images: [{url: '/generated/role-b.png'}]}};
  }
  const id = url.endsWith('/B') ? 'B' : 'A';
  return {body: {id, title: id, messages: [task(id)]}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange() {}});
await controller.open(true);
const backgroundA = fireTimer();
await nodes.get('sessions').listeners.change({target: {value: 'B'}});
assert.equal(bQueries, 0);
await fireTimer();
assert.equal(timers.size, 0);
releaseA();
await backgroundA;
assert.equal(timers.size, 1, 'finishing an old session poll must schedule the current session');
await fireTimer();
assert.equal(bQueries, 1, 'the current session task must actually be queried');
const card = nodes.get('messages').children[0];
assert.equal(card.dataset.jobId, 'job-B');
assert.equal(card.dataset.status, 'completed');
assert.equal(card.children.at(-1).children[0].src, '/generated/role-b.png');
assert.equal(timers.size, 0);
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_inactive_agent_does_not_intercept_shared_generation_form_or_clear_prompt():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
let posts = 0;
let releasePost;
let messageChanges = 0;
const request = async (url, options) => {
  if (options.method === 'POST') {
    posts += 1;
    if (posts === 1) return new Promise(resolve => { releasePost = () => resolve({body: {}}); });
    return {body: {}};
  }
  return {body: url.endsWith('/sessions') ? {items: [{id, title: '会话', updated_at: 1}]} : {id, title: '会话', messages: []}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange() { messageChanges += 1; }});
assert.equal(nodes.get('send').disabled, false, 'constructing an inactive agent cannot lock image generation');
assert.equal(nodes.get('tool-prompt').disabled, false);
assert.equal(nodes.get('button-label').textContent, '生成');
let prevented = false;
nodes.get('tool-prompt').value = '普通生图提示词';
await nodes.get('form').listeners.submit({preventDefault() { prevented = true; }});
assert.equal(prevented, false, 'an inactive agent must leave normal form submission untouched');
assert.equal(posts, 0);
await controller.open(true);
nodes.get('tool-prompt').value = '规划一部雨夜短剧';
const sending = nodes.get('form').listeners.submit({preventDefault() {}});
assert.equal(posts, 1);
controller.suspend();
const priorMessageChanges = messageChanges;
nodes.get('tool-prompt').value = '切回生图后新写的图片提示词';
nodes.get('tool-prompt').disabled = false;
nodes.get('send').disabled = false;
nodes.get('button-label').textContent = '生成';
prevented = false;
await nodes.get('form').listeners.submit({preventDefault() { prevented = true; }});
assert.equal(prevented, false, 'suspended agents must not intercept image submission');
assert.equal(posts, 1, 'image submission cannot send an extra agent request');
releasePost();
await sending;
assert.equal(messageChanges, priorMessageChanges, 'finishing an inactive agent request cannot change the image output layout');
assert.equal(nodes.get('tool-prompt').value, '切回生图后新写的图片提示词', 'finishing an old agent request cannot erase the image prompt');
assert.equal(nodes.get('tool-prompt').disabled, false);
assert.equal(nodes.get('send').disabled, false);
assert.equal(nodes.get('button-label').textContent, '生成');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_agent_submits_visible_shared_prompt_without_clearing_hidden_primary_prompt():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
const submitted = [];
const request = async (url, options) => {
  if (options.method === 'POST') {
    submitted.push(JSON.parse(options.body));
    return {body: {}};
  }
  if (url.endsWith('/sessions')) return {body: {items: [{id, title: '会话', updated_at: 1}]}};
  return {body: {id, title: '会话', messages: submitted.length ? [
    {id: 'user-1', role: 'user', content: '规划一部雨夜短剧'},
    {id: 'assistant-1', role: 'assistant', content: '先整理人物与分镜。'},
  ] : []}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange() {}});
nodes.get('prompt').value = '隐藏主提示词必须保留';
await controller.open(true);
nodes.get('tool-prompt').value = '规划一部雨夜短剧';
await nodes.get('form').listeners.submit({preventDefault() {}});
assert.deepEqual(submitted, [{message: '规划一部雨夜短剧', auto_execute: false}], 'the agent must submit the visible unified composer');
assert.equal(nodes.get('tool-prompt').value, '', 'a successful agent send clears the visible unified composer');
assert.equal(nodes.get('prompt').value, '隐藏主提示词必须保留', 'agent cleanup cannot alter the hidden primary prompt');
assert.equal(nodes.get('prompt').disabled, false, 'agent control state cannot lock the hidden primary prompt');
assert.equal(nodes.get('status').textContent, '', 'the assistant reply must not add a saved-success notification');
assert.equal(nodes.get('status').hidden, true, 'successful replies must hide the empty status');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_message_presence_callback_restores_reply_and_resets_new_session():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
const changes = [];
const request = async url => url.endsWith('/sessions')
  ? {body: {items: [{id, title: '已有回复的会话', updated_at: 1}]}}
  : {body: {id, title: '已有回复的会话', messages: [
    {id: 'user-1', role: 'user', content: '先规划人物'},
    {id: 'assistant-1', role: 'assistant', content: '主角是一位夜归摄影师。'},
  ]}};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange(hasMessages) { changes.push(hasMessages); }});
assert.deepEqual(changes, [], 'an inactive agent cannot change the shared output layout');
await controller.open(true);
assert.equal(changes.at(-1), true, 'restoring an existing reply must enable the shared output layout');
assert.equal(nodes.get('messages').children.length, 2);
assert.equal(nodes.get('status').textContent, '', 'restored sessions must not show a success or default-mode notification');
assert.equal(nodes.get('status').hidden, true);
nodes.get('prompt').value = '普通生图主提示词';
nodes.get('tool-prompt').value = '尚未发送的短剧草稿';
nodes.get('new').listeners.click();
assert.equal(changes.at(-1), false, 'a new session must restore the empty composer layout');
assert.equal(nodes.get('messages').children.length, 0);
assert.equal(nodes.get('status').textContent, '', 'new conversations must start without a default notification');
assert.equal(nodes.get('status').hidden, true);
assert.equal(nodes.get('tool-prompt').value, '');
assert.equal(nodes.get('prompt').value, '普通生图主提示词', 'new-session cleanup must leave the hidden primary prompt intact');
await nodes.get('sessions').listeners.change({target: {value: id}});
assert.equal(changes.at(-1), true, 'switching back to a saved reply must restore the output layout');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_new_session_pending_state_opens_dialogue_before_any_messages_exist():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
const changes = [];
let releaseSession;
const request = async (url, options) => {
  if (url.endsWith('/sessions') && options.method === 'GET') return {body: {items: []}};
  if (url.endsWith('/sessions') && options.method === 'POST') {
    return new Promise(resolve => { releaseSession = () => resolve({body: {id, title: '新会话', updated_at: 1}}); });
  }
  if (options.method === 'POST') return {body: {}};
  return {body: {id, title: '新会话', messages: [
    {id: 'assistant-1', role: 'assistant', content: '先整理人物与场景。'},
  ]}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange(hasMessages) { changes.push(hasMessages); }});
await controller.open(true);
nodes.get('tool-prompt').value = '规划一部雨夜短剧';
const sending = nodes.get('form').listeners.submit({preventDefault() {}});
assert.equal(nodes.get('messages').children.length, 0);
assert.equal(changes.at(-1), true, 'submitting a new conversation must immediately reveal the dialogue area');
assert.notEqual(nodes.get('status').textContent, '', 'pending feedback must appear before session creation finishes');
assert.equal(nodes.get('status').hidden, false, 'pending feedback must be visible in the dialogue area');
controller.suspend();
const priorChanges = changes.length;
nodes.get('tool-prompt').value = '切回生图后新写的图片提示词';
nodes.get('button-label').textContent = '生成';
releaseSession();
await sending;
assert.equal(changes.length, priorChanges, 'finishing a suspended new conversation cannot change the image output layout');
assert.equal(nodes.get('tool-prompt').value, '切回生图后新写的图片提示词');
assert.equal(nodes.get('button-label').textContent, '生成');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_send_error_remains_visible_in_dialogue_without_any_saved_reply():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
const changes = [];
const request = async (url, options) => {
  if (options.method === 'POST') {
    const error = new Error('provider_unavailable');
    error.status = 502;
    throw error;
  }
  return {body: url.endsWith('/sessions') ? {items: [{id, title: '会话', updated_at: 1}]} : {id, title: '会话', messages: []}};
};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange(hasMessages) { changes.push(hasMessages); }});
await controller.open(true);
nodes.get('status').hidden = true;
nodes.get('tool-prompt').value = '规划一部雨夜短剧';
await nodes.get('form').listeners.submit({preventDefault() {}});
assert.equal(nodes.get('status').hidden, false, 'a send error must unhide the dialogue status');
assert.notEqual(nodes.get('status').textContent, '', 'a send error must explain why the assistant did not reply');
assert.equal(changes.at(-1), true, 'an error must keep the dialogue area open even without messages');
assert.equal(nodes.get('messages').children.length, 0);
assert.equal(nodes.get('tool-prompt').value, '规划一部雨夜短剧', 'a failed send must preserve the editable input');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    ("scroll_position", "expected_position"),
    [(None, 700), (700, 700), (200, 200)],
    ids=["first-open-at-bottom", "refresh-stays-at-bottom", "refresh-keeps-reading-position"],
)
def test_long_conversation_restores_scroll_position_after_message_replacement(scroll_position, expected_position):
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const stage = nodes.get('stage');
let scrollTop = 0;
Object.defineProperty(stage, 'scrollTop', {
  get() { return scrollTop; },
  set(value) { scrollTop = Math.max(0, Math.min(value, stage.scrollHeight - stage.clientHeight)); },
});
const transcript = nodes.get('messages');
const replaceChildren = transcript.replaceChildren.bind(transcript);
transcript.replaceChildren = (...items) => {
  replaceChildren(...items);
  stage.scrollTop = 0;
};
const id = 'a'.repeat(32);
const request = async url => url.endsWith('/sessions')
  ? {body: {items: [{id, title: '长会话', updated_at: 1}]}}
  : {body: {id, title: '长会话', messages: [
    {id: 'user-1', role: 'user', content: '规划角色与分镜。'.repeat(80)},
    {id: 'assistant-1', role: 'assistant', content: '角色是一位夜归摄影师。'.repeat(80)},
    {id: 'task-1', role: 'tool', tool: {
      name: 'generate_image', arguments: {prompt: '角色定妆图'},
      result: {ok: true, job_id: 'image-1', status: 'completed', status_url: '/jobs/image-1', credits: 8, images: [{url: '/generated/role.png'}]},
    }},
  ]}};
const controller = createShortDramaController({
  root, request, mediaUrl: value => value, onCreditsChange() {},
  onMessagesChange(hasMessages) {
    stage.scrollHeight = hasMessages ? 1000 : 0;
    stage.clientHeight = hasMessages ? 300 : 0;
  },
});
await controller.open(true);
'''
    if scroll_position is not None:
        script += f"stage.scrollTop = {scroll_position};\nawait nodes.get('refresh-jobs').listeners.click();\n"
    script += f"assert.equal(stage.scrollTop, {expected_position}, 'rendering the conversation must retain the visible reading position');\n"
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr

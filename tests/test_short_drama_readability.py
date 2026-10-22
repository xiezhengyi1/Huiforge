import subprocess

from test_short_drama_frontend import ROOT, SHARED_WORKSPACE_DOM


def test_remake_handoff_starts_without_unrelated_conversation_context():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{createShortDramaController}} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root,nodes}=createWorkspace();
const request=async url=>({body:url.endsWith('/sessions')?{items:[{id:'old',title:'此前的故事'}]}:{id:'old',title:'此前的故事',messages:[{id:'previous',role:'assistant',content:'此前的人物设定'}]}});
const controller=createShortDramaController({root,request,mediaUrl:x=>x,onCreditsChange(){},onMessagesChange(){}});
await controller.open(true);
controller.newDraft();
nodes.get('tool-prompt').value='新的复刻分镜';
assert.equal(nodes.get('sessions').value,'');
assert.equal(nodes.get('messages').children.length,0);
assert.equal(nodes.get('auto-execute').checked,false);
assert.equal(nodes.get('tool-prompt').value,'新的复刻分镜');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_storyboard_capability_opens_the_working_agent_flow():
    from fastapi.testclient import TestClient
    from backend.huiju.api.app import app

    items = [item for group in TestClient(app).get('/api/v1/capabilities').json()['groups'] for item in group['items']]
    item = next(item for item in items if item['id'] == 'storyboard-video')
    assert item['action'] == 'short_drama_agent'
    assert item['availability'] == 'storyboard_video'


def test_storyboard_receipt_shows_each_shot_progress_without_model_polling():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
globalThis.setTimeout = () => 1;
globalThis.clearTimeout = () => {};
const {root, nodes} = createWorkspace();
const task = {id:'receipt',role:'tool',tool:{name:'generate_storyboard',arguments:{title:'雨夜来信'},result:{ok:true,job_id:'film-1',status:'queued',credits:150,status_url:'/api/v1/storyboards/jobs/film-1'}}};
const request = async url => ({body: url.endsWith('/sessions') ? {items:[{id:'session-1',title:'短片'}]} : url.endsWith('/film-1') ? {status:'running',phase:'generating',total_shots:3,completed_shots:1,shots:[{index:0,status:'completed'},{index:1,status:'running'},{index:2,status:'pending'}]} : {id:'session-1',title:'短片',messages:[task]}});
const controller = createShortDramaController({root,request,mediaUrl:value=>value,onCreditsChange(){},onMessagesChange(){}});
await controller.open(true);
const all = node => [node,...node.children.flatMap(all)];
const rendered = all(nodes.get('messages'));
const progress = rendered.find(n => n.tag==='progress');
assert.ok(progress,'the task must expose actual shot progress');
assert.equal(progress.max,3);
assert.equal(progress.value,1);
assert.equal(rendered.some(n=>n.textContent==='分镜成片'),true);
assert.equal(rendered.some(n=>n.textContent==='镜头 3 · 待生成'),true);
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_assistant_sections_and_emphasis_render_as_safe_readable_elements():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ renderDramaText }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root} = createWorkspace();
const result = renderDramaText(root.ownerDocument, '## 故事梗概\n雨夜，一封**没有署名**的来信。\n\n### 分镜\n1. 路灯下的信封\n2. 女侦探抬头\n\n<img src=x onerror=alert(1)>');
const all = node => [node, ...node.children.flatMap(all)];
const nodes = all(result);
assert.equal(nodes.filter(n => n.tag === 'h2')[0].children[0].textContent, '故事梗概');
assert.equal(nodes.filter(n => n.tag === 'h3').length, 1);
assert.equal(nodes.filter(n => n.tag === 'li').length, 2);
assert.equal(nodes.find(n => n.tag === 'strong').textContent, '没有署名');
assert.equal(nodes.some(n => n.tag === 'img'), false);
assert.equal(nodes.some(n => n.textContent === '<img src=x onerror=alert(1)>'), true);
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_storyboard_list_keeps_original_shot_numbers_when_continuing_or_skipping():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ renderDramaText }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root} = createWorkspace();
const result = renderDramaText(root.ownerDocument, '### 续接分镜\n3. 路灯下停步\n4. 读信\n8. 回头望向巷口');
const list = result.children.find(node => node.tag === 'ol');
assert.equal(list.start, 3, 'continuing a storyboard must not renumber the first shot as one');
assert.deepEqual(list.children.map(node => node.value), [3, 4, 8], 'skipped shot numbers must remain the original shot references');
assert.deepEqual(list.children.map(node => node.children[0].textContent), ['路灯下停步', '读信', '回头望向巷口']);
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_expanded_long_request_remains_readable_after_task_refresh():
    module = ROOT / "frontend/js/features/short-drama/controller.js"
    script = f"import {{ createShortDramaController }} from {module.as_uri()!r};\n" + SHARED_WORKSPACE_DOM + r'''
import assert from 'node:assert/strict';
const {root, nodes} = createWorkspace();
const id = 'a'.repeat(32);
const requestText = '保留人物服装和雨夜场景。'.repeat(24) + '末尾约束：画面禁止字幕。';
const request = async url => url.endsWith('/sessions')
  ? {body: {items: [{id, title: '长需求', updated_at: 1}]}}
  : {body: {id, title: '长需求', messages: [
    {id: 'user-1', role: 'user', content: requestText},
    {id: 'task-1', role: 'tool', tool: {
      name: 'generate_image', arguments: {prompt: '角色定妆图'},
      result: {ok: true, job_id: 'image-1', status: 'completed', status_url: '/jobs/image-1', credits: 8, images: [{url: '/generated/role.png'}]},
    }},
  ]}};
const controller = createShortDramaController({root, request, mediaUrl: value => value, onCreditsChange() {}, onMessagesChange() {}});
const details = () => nodes.get('messages').children[0].children.find(node => node.tag === 'details');
const toggle = (node, open) => {
  node.open = open;
  for (const [event, handler] of Object.entries(node.listeners)) {
    if (event === 'toggle') handler({target: node});
  }
};
await controller.open(true);
assert.equal(Boolean(details().open), false, 'long requests begin collapsed');
assert.equal(details().children[1].textContent, requestText, 'collapsing a request must retain every constraint in the expanded content');
toggle(details(), true);
await nodes.get('refresh-jobs').listeners.click();
assert.equal(Boolean(details().open), true, 'task refresh must not hide the request that the user is reading');
assert.equal(details().children[1].textContent, requestText);
toggle(details(), false);
await nodes.get('refresh-jobs').listeners.click();
assert.equal(Boolean(details().open), false, 'a deliberately collapsed request must stay collapsed after refresh');
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr

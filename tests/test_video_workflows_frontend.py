from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "frontend/js/features/video-workflows/controller.js"

DOM = r'''
import assert from 'node:assert/strict';
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.listeners = new Map(); this.selectors = new Map();
    this.attributes = {}; this.dataset = {}; this.value = ''; this.textContent = '';
    this.hidden = true; this.disabled = false; this.files = []; this.events = [];
    this.classList = {toggle() {}};
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  querySelector(selector) { return this.selectors.get(selector); }
  dispatchEvent(event) { this.events.push(event); this.listeners.get(event.type)?.(event); return true; }
  focus() {}
  scrollIntoView() {}
}
const timers = new Map(); let timerId = 0;
globalThis.setTimeout = fn => { timers.set(++timerId, fn); return timerId; };
globalThis.clearTimeout = id => timers.delete(id);
async function tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); await fn(); }
function setup(saved = new Map()) {
  const copied = []; const root = new Element(); root.hidden = false;
  const ids = ['parameters', 'source-panel', 'source', 'source-name', 'voice-field', 'voice', 'tool-view', 'content', 'status', 'login', 'refresh'];
  const nodes = new Map(ids.map(id => [id, new Element()]));
  for (const [id, node] of nodes) root.selectors.set('#video-workflow-' + id, node);
  for (const id of ['generation-form', 'tool-prompt', 'generate-button']) root.selectors.set('#' + id, new Element());
  const label = new Element(); root.querySelector('#generate-button').selectors.set('.button-label', label);
  const win = {
    localStorage: {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)},
    navigator: {clipboard: {writeText: async value => copied.push(value)}},
    CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
  };
  root.ownerDocument = {createElement: tag => new Element(tag), defaultView: win};
  nodes.get('voice').value = 'Cherry';
  const input = root.querySelector('#tool-prompt'); const form = root.querySelector('#generation-form');
  const send = root.querySelector('#generate-button'); input.disabled = false; send.disabled = false;
  const all = node => [node, ...node.children.flatMap(all)];
  const text = node => node.textContent + node.children.map(text).join(' ');
  return {root, nodes, input, form, send, saved, copied, all, text};
}
const completed = (kind, extra = {}) => ({job_id:'b'.repeat(32), kind, status:'completed', phase:'completed', transcript:'', segments:[], script:'', credits:{charged_credits:0}, ...extra});
const receipt = {job_id:'b'.repeat(32), status:'queued', status_url:'/api/v1/video-workflows/jobs/' + 'b'.repeat(32), credits:{charged_credits:0}};
const submit = state => state.form.listeners.get('submit')({preventDefault() {}});
async function upload(state) {
  state.nodes.get('source').files = [new File(['video'], '源视频.mp4', {type:'video/mp4'})];
  await state.nodes.get('source').listeners.get('change')();
}
'''


def run_js(script: str):
    source = f"import {{ createVideoWorkflowController }} from {MODULE.as_uri()!r};\n" + DOM + script
    result = subprocess.run(["node", "--input-type=module", "-e", source], capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr


def test_inactive_controller_leaves_shared_form_alone_and_suspend_hides_own_ui():
    run_js(r'''
const s = setup(); let calls = 0;
const controller = createVideoWorkflowController({root:s.root, request:async () => { calls++; }, mediaUrl:v=>v, onCreditsChange() {}, onMessagesChange() {}});
let prevented = false;
await s.form.listeners.get('submit')({preventDefault() { prevented = true; }});
assert.equal(prevented, false); assert.equal(calls, 0);
await controller.open('video-dubbing', false);
assert.equal(s.nodes.get('source-panel').hidden, false);
assert.equal(s.send.disabled, true);
controller.suspend();
assert.equal(s.nodes.get('parameters').hidden, true); assert.equal(s.nodes.get('tool-view').hidden, true);
assert.equal(s.send.disabled, false); assert.equal(s.input.disabled, false);
''')


def test_video_dubbing_uploads_separately_accepts_empty_script_and_renders_private_result():
    run_js(r'''
const s = setup(); const requests = []; let credits = 0;
const request = async (url, options) => {
  requests.push([url, options]);
  if (url === '/api/v1/media/uploads') { assert.equal(options.body.get('media').name, '源视频.mp4'); return {body:{upload_id:'a'.repeat(32)}}; }
  if (options.method === 'POST') return {body:receipt};
  return {body:completed('video-dubbing', {script:'重配台词', url:'/private/dub.mp4', credits:{charged_credits:3}})};
};
const controller = createVideoWorkflowController({root:s.root, request, mediaUrl:v=>v, onCreditsChange() {credits++;}, onMessagesChange() {}});
await controller.open('video-dubbing', true); await upload(s); await submit(s);
const payload = JSON.parse(requests.find(([url]) => url === '/api/v1/video-workflows/jobs')[1].body);
assert.deepEqual(payload, {kind:'video-dubbing',source_upload_id:'a'.repeat(32),prompt:'',voice:'Cherry',language_type:'Chinese'});
assert.equal(requests.filter(([, options]) => options.method === 'POST').length, 2);
assert.equal(s.all(s.nodes.get('content')).find(n=>n.tag === 'video').src, '/private/dub.mp4');
assert.equal(s.all(s.nodes.get('content')).find(n=>n.tag === 'video').controls, true);
assert.ok(s.all(s.nodes.get('content')).some(n=>n.tag === 'a' && n.download && n.href === '/private/dub.mp4'));
assert.equal(credits, 1); assert.ok([...s.saved.values()].includes('b'.repeat(32)));
assert.equal(s.nodes.get('status').hidden, true);
''')


def test_remake_plan_is_safe_structured_copyable_and_only_dispatches_user_confirmed_handoff():
    run_js(r'''
const s = setup(); let posts = 0;
const plan = {title:'新故事<script>',summary:'保留反转节奏',rhythm:'铺垫→反转',dialogue:'新台词',shots:[{prompt:'<img src=x onerror=alert(1)>',duration:4},{prompt:'角色走进雨中',duration:6}]};
const request = async (url, options) => {
  if (url === '/api/v1/media/uploads') return {body:{upload_id:'a'.repeat(32)}};
  if (options.method === 'POST') { posts++; return {body:receipt}; }
  return {body:completed('viral-remake', {plan})};
};
const controller = createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('viral-remake', true); await upload(s); s.input.value='改成太空题材'; await submit(s);
const nodes = s.all(s.nodes.get('content'));
assert.ok(nodes.some(n=>n.tag === 'h3' && n.textContent.includes('镜头 2')));
assert.ok(s.text(s.nodes.get('content')).includes('<img src=x onerror=alert(1)>'));
assert.ok(nodes.every(n=>n.innerHTML === undefined));
await nodes.find(n=>n.tag === 'button' && n.textContent === '复制分镜').listeners.get('click')();
assert.ok(s.copied[0].includes('角色走进雨中')); assert.ok(s.copied[0].includes('6 秒'));
nodes.find(n=>n.tag === 'button' && n.textContent === '用这些分镜制作短片').listeners.get('click')();
assert.equal(s.root.events.at(-1).type,'video-workflow-use-plan');
assert.equal(s.root.events.at(-1).detail.text,s.copied[0]); assert.equal(posts,1);
''')


def test_reload_restores_saved_job_and_polls_until_terminal_without_resubmitting():
    run_js(r'''
const s = setup(new Map([['huiju.video-workflows.viral-remake', 'c'.repeat(32)]])); let reads=0; const requests=[];
const request = async (url, options) => {
  requests.push([url,options.method]); reads++;
  return {body: reads < 3 ? {...completed('viral-remake'),job_id:'c'.repeat(32),status:'running',phase:'analyzing'} : completed('viral-remake')};
};
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('viral-remake',true); assert.equal(timers.size,1);
await tick(); assert.equal(timers.size,1); await tick(); assert.equal(timers.size,0);
assert.ok(requests.every(([,method])=>method==='GET'));
assert.ok(requests[0][0].endsWith('c'.repeat(32)));
''')


def test_history_selection_uses_source_job_id_without_upload_or_visible_id_field():
    run_js(r'''
const s=setup(); let payload; let uploads=0;
const request=async (url,options)=>{
  if(url==='/api/v1/media/uploads') uploads++;
  if(options.method==='POST'){payload=JSON.parse(options.body);return {body:receipt};}
  return {body:completed('video-dubbing')};
};
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('video-dubbing',true);
s.root.listeners.get('video-workflow-source')({detail:{sourceJobId:'d'.repeat(32),name:'已生成雨夜片段'}});
s.input.value='新的旁白'; await submit(s);
assert.equal(payload.source_job_id,'d'.repeat(32)); assert.equal('source_upload_id' in payload,false); assert.equal(uploads,0);
assert.equal(s.nodes.get('source-name').textContent,'已生成雨夜片段');
''')


def test_submission_error_shows_safe_credit_message_and_never_retries():
    run_js(r'''
const s=setup(); let posts=0;
const request=async (url,options)=>{
  if(url==='/api/v1/media/uploads') return {body:{upload_id:'a'.repeat(32)}};
  posts++; throw Object.assign(new Error('private upstream stack'), {status:402,body:{detail:'credits_insufficient'}});
};
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('video-dubbing',true); await upload(s); await submit(s);
assert.equal(posts,1); assert.equal(timers.size,0);
assert.ok(s.nodes.get('status').textContent.includes('额度不足'));
assert.equal(s.nodes.get('status').textContent.includes('private upstream'),false);
assert.equal(s.send.disabled,false);
''')


def test_missing_source_is_actionable_and_does_not_submit():
    run_js(r'''
const s=setup(); let calls=0;
const controller=createVideoWorkflowController({root:s.root,request:async()=>{calls++;},mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('viral-remake',true); s.input.value='改编故事'; await submit(s);
assert.equal(calls,0); assert.ok(s.nodes.get('status').textContent.includes('源视频'));
''')


def test_suspending_during_restore_does_not_mutate_shared_generation_or_restart_polling():
    run_js(r'''
const s=setup(new Map([['huiju.video-workflows.video-dubbing','c'.repeat(32)]])); let release; let changes=0;
const request=()=>new Promise(resolve=>{release=()=>resolve({body:completed('video-dubbing')});});
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {changes++;}});
const opening=controller.open('video-dubbing',true); controller.suspend(); const prior=changes;
s.input.value='切回生图的新提示词'; release(); await opening;
assert.equal(s.input.value,'切回生图的新提示词'); assert.equal(s.input.disabled,false); assert.equal(s.send.disabled,false);
assert.equal(changes,prior); assert.equal(timers.size,0); assert.equal(s.nodes.get('tool-view').hidden,true);
''')


def test_late_upload_cannot_replace_image_mode_state_or_reopen_results():
    run_js(r'''
const s=setup(); let release; let changes=0;
const request=()=>new Promise(resolve=>{release=()=>resolve({body:{upload_id:'a'.repeat(32)}});});
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {changes++;}});
await controller.open('video-dubbing',true);
s.nodes.get('source').files=[new File(['video'],'源视频.mp4',{type:'video/mp4'})];
const uploading=s.nodes.get('source').listeners.get('change')();
controller.suspend(); const prior=changes; s.input.value='生图的新描述';
release(); await uploading;
assert.equal(s.input.value,'生图的新描述'); assert.equal(s.input.disabled,false); assert.equal(s.send.disabled,false);
assert.equal(s.nodes.get('source-name').textContent,''); assert.equal(changes,prior); assert.equal(timers.size,0);
''')


def test_submission_finishing_after_exit_is_saved_without_replay_and_restores_on_return():
    run_js(r'''
const s=setup(); let release; let posts=0; let reads=0; let changes=0;
const request=async (url,options)=>{
  if(url==='/api/v1/media/uploads') return {body:{upload_id:'a'.repeat(32)}};
  if(options.method==='POST'){posts++; return new Promise(resolve=>{release=()=>resolve({body:receipt});});}
  reads++; return {body:completed('video-dubbing')};
};
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {changes++;}});
await controller.open('video-dubbing',true); await upload(s); s.input.value='配音文案';
const sending=submit(s); controller.suspend(); const prior=changes;
s.input.value='普通视频生成的新描述'; release(); await sending;
assert.equal(s.input.value,'普通视频生成的新描述'); assert.equal(s.send.disabled,false); assert.equal(changes,prior);
assert.equal(reads,0); assert.equal(posts,1); assert.equal(timers.size,0);
assert.equal(s.saved.get('huiju.video-workflows.video-dubbing'),'b'.repeat(32));
await controller.open('video-dubbing',true); assert.equal(reads,1); assert.equal(posts,1); assert.equal(s.nodes.get('tool-view').hidden,false);
''')


def test_all_public_job_failure_codes_show_actionable_visible_messages():
    run_js(r'''
const codes=['asr_transcription_timeout','video_workflow_concurrency_limit','media_worker_not_enabled','ffmpeg_not_available','audio_provider_not_configured','video_analysis_not_configured','video_workflow_not_found','asr_provider_arrearage'];
for(const error of codes){
  const s=setup(new Map([['huiju.video-workflows.video-dubbing','c'.repeat(32)]]));
  const request=async()=>({body:{...completed('video-dubbing'),status:'failed',phase:'failed',error}});
  const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
  await controller.open('video-dubbing',true);
  assert.equal(s.nodes.get('status').hidden,false,error); assert.ok(s.nodes.get('status').textContent.length>8,error);
  assert.equal(s.nodes.get('status').textContent.includes(error),false);
  if(error==='asr_provider_arrearage') assert.ok(s.nodes.get('status').textContent.includes('账户欠费'));
  controller.suspend();
}
''')


def test_failed_replacement_upload_cannot_submit_the_previous_video():
    run_js(r'''
const s=setup(); let uploads=0; let posts=0;
const request=async(url,options)=>{
  if(url==='/api/v1/media/uploads'){
    uploads++;
    if(uploads===1) return {body:{upload_id:'a'.repeat(32)}};
    throw Object.assign(new Error('invalid upload'),{status:422});
  }
  if(options.method==='POST'){posts++;return {body:receipt};}
  return {body:completed('video-dubbing')};
};
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('video-dubbing',true); await upload(s); await upload(s); await submit(s);
assert.equal(posts,0,'a failed replacement must not submit the previous source');
assert.ok(s.nodes.get('status').textContent.includes('源视频'));
''')


def test_polling_preserves_expanded_transcript_and_timeline():
    run_js(r'''
const s=setup(new Map([['huiju.video-workflows.video-dubbing','b'.repeat(32)]]));
const request=async()=>({body:{...completed('video-dubbing'),status:'running',phase:'synthesizing',transcript:'原台词',segments:[{start:0,end:2,text:'你好'}]}});
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('video-dubbing',true);
const opened=s.all(s.nodes.get('content')).filter(n=>n.tag==='details');
assert.equal(opened.length,2);
for(const details of opened){details.open=true;details.dispatchEvent({type:'toggle'});}
await tick();
const refreshed=s.all(s.nodes.get('content')).filter(n=>n.tag==='details');
assert.ok(refreshed.every(n=>n.open===true),'polling cannot collapse the transcript or timeline while reading');
controller.suspend();
''')


def test_new_job_resets_previous_details_expansion():
    run_js(r'''
const s=setup(); let posts=0;
const request=async(url,options)=>{
  if(url==='/api/v1/media/uploads')return {body:{upload_id:'a'.repeat(32)}};
  const id=posts===1?'b'.repeat(32):'e'.repeat(32);
  if(options.method==='POST'){posts++;return {body:{...receipt,job_id:posts===1?'b'.repeat(32):'e'.repeat(32)}};}
  return {body:completed('video-dubbing',{job_id:id,transcript:'原台词',segments:[{start:0,end:2,text:'你好'}]})};
};
const controller=createVideoWorkflowController({root:s.root,request,mediaUrl:v=>v,onCreditsChange() {},onMessagesChange() {}});
await controller.open('video-dubbing',true);await upload(s);await submit(s);
for(const details of s.all(s.nodes.get('content')).filter(n=>n.tag==='details')){details.open=true;details.dispatchEvent({type:'toggle'});}
await submit(s);
assert.ok(s.all(s.nodes.get('content')).filter(n=>n.tag==='details').every(n=>n.open===false));
''')

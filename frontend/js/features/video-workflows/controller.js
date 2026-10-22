import { renderDramaText } from "../short-drama/controller.js?v=20261021-video-workflows-v4";

const JOBS_URL = "/api/v1/video-workflows/jobs";
const PHASE_LABELS = {
  queued:"任务已排队…", extracting:"正在读取源视频…", transcribing:"正在识别视频台词…",
  analyzing:"正在分析画面与节奏…", planning:"正在整理重制分镜…", synthesizing:"正在生成配音…", aligning:"正在对齐音轨并合成视频…",
};
const ERRORS = {
  video_source_not_found:"源视频不可用，请重新上传或从生成记录中选择。",
  video_source_not_completed:"源视频尚未生成完成，请完成后再提交。",
  video_audio_required:"源视频没有可识别音轨，请填写配音文案。",
  dubbing_script_required:"未识别到可用台词，请填写配音文案后重新提交。",
  dubbing_script_too_long:"配音文案过长，请精简后重新提交。",
  credits_insufficient:"额度不足，请补充额度后重新提交。",
  media_concurrency_limit:"已有视频任务正在处理，请完成后再提交。",
  video_workflow_concurrency_limit:"已有视频处理任务正在运行，请完成后再提交。",
  video_workflow_not_found:"找不到上次的视频任务，请重新选择源视频。",
  media_worker_not_enabled:"视频处理服务尚未启用，请联系管理员。",
  ffmpeg_not_available:"视频合成服务尚未启用，请联系管理员。",
  audio_provider_not_configured:"配音服务尚未配置，请联系管理员。",
  video_analysis_not_configured:"视频分析服务尚未配置，请联系管理员。",
  asr_provider_arrearage:"语音识别服务账户欠费，请联系管理员。",
  asr_transcription_timeout:"台词识别超时，请缩短源视频或填写配音文案。",
  asr_transcription_failed:"台词识别未完成，请检查音轨或填写配音文案。",
  asr_provider_unavailable:"语音识别服务尚未就绪，请稍后再试。",
  vision_analysis_failed:"画面分析未完成，请检查源视频后重新提交。",
  remake_plan_failed:"分镜规划未完成，请补充重制意图后重新提交。",
  tts_generation_failed:"配音生成未完成，请稍后重新提交。",
  video_workflow_interrupted:"任务已中断，未自动重复提交。请查看已有结果后再决定是否重试。",
  video_workflow_processing_failed:"视频处理未完成，请检查源视频后重新提交。",
};
const storageKey = kind => `huiju.video-workflows.${kind}`;

function planText(plan) {
  return [`# ${plan.title}`, plan.summary, `## 节奏\n${plan.rhythm}`, `## 台词\n${plan.dialogue}`,
    ...plan.shots.map((shot, index) => `## 镜头 ${index + 1} · ${shot.duration} 秒\n${shot.prompt}`)].join("\n\n");
}

export function createVideoWorkflowController({ root, request, mediaUrl, onCreditsChange, onMessagesChange }) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const get = id => root.querySelector(`#video-workflow-${id}`);
  const form = root.querySelector("#generation-form");
  const input = root.querySelector("#tool-prompt");
  const send = root.querySelector("#generate-button");
  const sourceInput = get("source");
  const sourceName = get("source-name");
  const voice = get("voice");
  const content = get("content");
  const status = get("status");
  let enabled = false;
  let available = false;
  let authenticated = true;
  let busy = false;
  let refreshing = false;
  let kind = "";
  let source = null;
  let job = null;
  let timer = null;
  let revision = 0;
  const credited = new Set();
  const expandedDetails = new Set();
  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const pending = () => job && ["queued", "running"].includes(job.status);
  const stopPolling = () => { clearTimeout(timer); timer = null; };

  function disclosure(name, title) {
    const key = `${job.job_id}:${name}`;
    const node = element("details", "drama-request-summary");
    node.open = expandedDetails.has(key);
    node.addEventListener("toggle", () => {
      if (node.open) expandedDetails.add(key);
      else expandedDetails.delete(key);
    });
    node.append(element("summary", "", title));
    return node;
  }

  function setStatus(text, error = false) {
    status.textContent = text;
    status.hidden = !text;
    status.classList.toggle("is-error", error);
    if (enabled) onMessagesChange(Boolean(job) || Boolean(text));
  }

  function syncControls() {
    if (!enabled) return;
    const locked = !available || !authenticated || busy || pending();
    input.disabled = Boolean(locked);
    send.disabled = Boolean(locked);
    sourceInput.disabled = Boolean(locked);
    voice.disabled = Boolean(locked);
    get("refresh").disabled = busy || refreshing || !job;
    send.querySelector(".button-label").textContent = busy ? "正在提交…" : kind === "viral-remake" ? "拆解视频" : "开始配音";
    form.setAttribute("aria-busy", String(busy || Boolean(pending())));
  }

  function reportError(error) {
    if (error.status === 401) {
      authenticated = false;
      get("login").hidden = false;
      setStatus("请先登录，再上传和处理视频。", true);
    } else if (ERRORS[error.body?.detail]) setStatus(ERRORS[error.body.detail], true);
    else if (error.status === 413) setStatus("源视频过大，请缩短或压缩后上传。", true);
    else if (error.status === 422) setStatus("请检查视频格式与处理参数后重新提交。", true);
    else setStatus("请求未完成。已提交的任务可点击刷新查看；任务不会自动重复提交。", true);
  }

  function render() {
    const nodes = [];
    if (job?.plan) {
      const plan = job.plan;
      nodes.push(element("h2", "video-workflow-title", plan.title));
      nodes.push(renderDramaText(doc, `${plan.summary}\n\n**节奏：**${plan.rhythm}\n\n**台词：**${plan.dialogue}`));
      const shots = element("ol", "video-workflow-shots");
      plan.shots.forEach((shot, index) => {
        const item = element("li", "video-workflow-shot");
        item.append(element("h3", "", `镜头 ${index + 1} · ${shot.duration} 秒`), renderDramaText(doc, shot.prompt));
        shots.append(item);
      });
      nodes.push(shots);
      const actions = element("div", "video-workflow-actions");
      const copy = element("button", "toolbar-select-trigger", "复制分镜");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try { await win.navigator.clipboard.writeText(planText(plan)); }
        catch { setStatus("复制未完成，请选中分镜文字进行复制。", true); }
      });
      const use = element("button", "toolbar-select-trigger", "用这些分镜制作短片");
      use.type = "button";
      use.addEventListener("click", () => root.dispatchEvent(new win.CustomEvent("video-workflow-use-plan", { bubbles:true, detail:{ text:planText(plan) } })));
      actions.append(copy, use);
      nodes.push(actions);
    }
    if (job?.script) {
      nodes.push(element("h2", "video-workflow-title", "配音文案"), renderDramaText(doc, job.script));
    }
    if (job?.transcript) {
      const transcript = disclosure("transcript", "查看原视频台词");
      transcript.append(renderDramaText(doc, job.transcript));
      nodes.push(transcript);
    }
    if (job && job.segments.length) {
      const timeline = disclosure("timeline", "查看台词时间轴");
      const segments = element("ol", "video-workflow-segments");
      job.segments.forEach(segment => segments.append(element("li", "", `${segment.start.toFixed(1)}–${segment.end.toFixed(1)} 秒 · ${segment.text}`)));
      timeline.append(segments);
      nodes.push(timeline);
    }
    if (job?.status === "completed" && job.url) {
      const url = mediaUrl(job.url);
      if (url) {
        const video = element("video", "video-workflow-result");
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        const download = element("a", "video-workflow-download", "下载配音视频");
        download.href = url;
        download.download = "配音视频.mp4";
        nodes.push(video, download);
      }
    }
    if (job && job.credits.charged_credits > 0) nodes.push(element("p", "drama-task-cost", `实际消耗 ${job.credits.charged_credits} 额度`));
    content.replaceChildren(...nodes);
    get("refresh").hidden = !job;
  }

  function schedulePolling() {
    stopPolling();
    if (enabled && pending()) timer = setTimeout(() => loadJob(job.job_id), 3000);
  }

  async function loadJob(id) {
    const currentRevision = revision;
    refreshing = true;
    syncControls();
    try {
      const { body } = await request(`${JOBS_URL}/${id}`, { method:"GET" }, 10000);
      if (!enabled || revision !== currentRevision) return;
      if (job?.job_id !== body.job_id) expandedDetails.clear();
      job = body;
      render();
      if (job.status === "failed") setStatus(ERRORS[job.error], true);
      else setStatus(pending() ? PHASE_LABELS[job.phase] : "");
      if (["completed", "failed"].includes(job.status) && !credited.has(job.job_id)) {
        credited.add(job.job_id);
        await onCreditsChange();
      }
    } catch (error) {
      if (enabled && revision === currentRevision) reportError(error);
    } finally {
      refreshing = false;
      if (enabled && revision === currentRevision) { syncControls(); schedulePolling(); }
    }
  }

  async function open(nextKind, ready) {
    const changed = kind !== nextKind;
    kind = nextKind;
    available = ready;
    enabled = true;
    authenticated = true;
    revision += 1;
    stopPolling();
    for (const id of ["parameters", "source-panel", "tool-view"]) get(id).hidden = false;
    get("voice-field").hidden = kind !== "video-dubbing";
    get("login").hidden = true;
    if (changed) {
      source = null;
      job = null;
      sourceInput.value = "";
      sourceName.textContent = "";
      sourceName.hidden = true;
      render();
    }
    syncControls();
    if (!available) { setStatus("这项视频处理服务尚未启用，请稍后再试。", true); return; }
    if (busy) { setStatus("正在提交源视频任务…"); return; }
    const id = win.localStorage.getItem(storageKey(kind));
    if (id) { setStatus("正在恢复上次任务…"); await loadJob(id); }
    else setStatus("");
  }

  function suspend() {
    enabled = false;
    revision += 1;
    stopPolling();
    for (const id of ["parameters", "source-panel", "tool-view"]) get(id).hidden = true;
    input.disabled = false;
    send.disabled = false;
    sourceInput.disabled = false;
    voice.disabled = false;
    form.setAttribute("aria-busy", "false");
  }

  sourceInput.addEventListener("change", async () => {
    if (!enabled) return;
    const file = sourceInput.files[0];
    if (!file) return;
    source = null;
    sourceName.textContent = "";
    sourceName.hidden = true;
    const currentRevision = revision;
    busy = true;
    syncControls();
    setStatus("正在上传源视频…");
    try {
      const data = new FormData();
      data.append("media", file);
      const { body } = await request("/api/v1/media/uploads", { method:"POST", body:data }, 120000);
      if (!enabled || revision !== currentRevision) return;
      source = { source_upload_id:body.upload_id };
      sourceName.textContent = file.name;
      sourceName.hidden = false;
      setStatus("");
    } catch (error) { if (enabled && revision === currentRevision) reportError(error); }
    finally { busy = false; syncControls(); }
  });

  root.addEventListener("video-workflow-source", event => {
    if (!enabled || busy || pending()) return;
    source = { source_job_id:event.detail.sourceJobId };
    sourceInput.value = "";
    sourceName.textContent = event.detail.name;
    sourceName.hidden = false;
    setStatus("");
  });

  form.addEventListener("submit", async event => {
    if (!enabled) return;
    event.preventDefault();
    if (!available || !authenticated || busy || pending()) return;
    if (!source) { setStatus("请先选择源视频，再提交处理需求。", true); return; }
    const submittedKind = kind;
    const payload = { kind, ...source, prompt:input.value.trim(), voice:voice.value, language_type:"Chinese" };
    busy = true;
    stopPolling();
    syncControls();
    setStatus("正在提交视频任务…");
    try {
      const { body } = await request(JOBS_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload) }, 30000);
      win.localStorage.setItem(storageKey(submittedKind), body.job_id);
      if (enabled && kind === submittedKind) { input.value = ""; await loadJob(body.job_id); }
    } catch (error) { if (enabled && kind === submittedKind) reportError(error); }
    finally { busy = false; syncControls(); }
  });
  get("refresh").addEventListener("click", () => loadJob(job.job_id));
  return { open, suspend };
}

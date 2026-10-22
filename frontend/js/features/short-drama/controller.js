const SESSIONS_URL = "/api/v1/agents/short-drama/sessions";
const TOOL_LABELS = {
  generate_image:"生成画面", edit_image:"编辑画面", generate_video:"生成视频",
  edit_video:"编辑视频", synthesize_speech:"生成配音", convert_video_to_depth:"生成深度视频",
  generate_storyboard:"分镜成片", compose_storyboard:"合成短片",
};
const JOB_LABELS = { queued:"排队中", running:"生成中", completed:"已完成", failed:"生成失败", cancelled:"已取消", unavailable:"暂无法查询，可到生成记录查看" };
const TOOL_ERRORS = {
  credits_insufficient:"额度不足，请补充额度后再提交。", paid_plan_required:"所选模型需要会员权限，请选择其他模型。", model_unavailable:"所选模型当前不可用，请选择其他模型。",
  queue_full:"生成队列已满，请稍后再提交。", video_provider_unavailable:"视频生成服务暂不可用。",
  media_concurrency_limit:"已有生成任务正在处理中，请完成后再提交。",
  audio_provider_unavailable:"配音服务暂不可用。", qwen_image_rate_limited:"生图请求过于频繁，请稍后再试。",
  unknown_upload:"参考素材不可用，请重新选择素材。", invalid_arguments:"任务参数不完整，请补充创作需求。",
  storyboard_concurrency_limit:"已有分镜短片正在制作，请完成后再提交。",
  ffmpeg_not_available:"视频合成服务尚未启用，请联系管理员。",
  media_job_not_found:"找不到已完成的视频，请从生成记录中选择。",
  storyboard_video_not_completed:"请等待所有镜头生成完成后再合成。",
  storyboard_clip_specs_mismatch:"镜头的视频和音频规格不一致，请选择相同规格的视频。",
  storyboard_video_not_configured:"分镜视频生成服务尚未启用。",
  storyboard_submission_interrupted:"制作被中断，已完成的镜头已保留，请确认后继续制作。",
  storyboard_shot_failed:"当前镜头生成失败，制作已停止，已完成的镜头已保留。",
  storyboard_provider_arrearage:"视频服务账户欠费，制作已停止，请联系管理员处理后重新提交。",
  storyboard_compose_failed:"视频合成失败，请查看已完成的镜头。",
};

export function renderDramaText(doc, text) {
  const container = doc.createElement("div");
  container.className = "drama-message-content";
  const inline = (node, value) => {
    for (const part of value.split(/(\*\*[^*]+\*\*)/g)) {
      if (!part) continue;
      const strong = part.startsWith("**") && part.endsWith("**");
      const span = doc.createElement(strong ? "strong" : "span");
      span.textContent = strong ? part.slice(2, -2) : part;
      node.append(span);
    }
  };
  let paragraph = [];
  let list = null;
  let listTag = "";
  const flush = () => {
    if (!paragraph.length) return;
    const node = doc.createElement("p");
    inline(node, paragraph.join("\n"));
    container.append(node);
    paragraph = [];
  };
  for (const line of text.split("\n")) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const item = line.match(/^(\d+[.)、]|[-*])\s+(.+)$/);
    const label = line.match(/^(梗概|角色|场景|旁白|镜头\s*\d+|分镜\s*\d+)[：:](.*)$/);
    if (!line.trim() || heading || item || label) flush();
    if (heading) {
      const node = doc.createElement(heading[1].length < 3 ? "h2" : "h3");
      inline(node, heading[2]);
      container.append(node);
    } else if (item) {
      const tag = /^\d/.test(item[1]) ? "ol" : "ul";
      if (!list || listTag !== tag) {
        list = doc.createElement(tag);
        if (tag === "ol") list.start = Number.parseInt(item[1], 10);
        listTag = tag;
        container.append(list);
      }
      const node = doc.createElement("li");
      if (tag === "ol") node.value = Number.parseInt(item[1], 10);
      inline(node, item[2]);
      list.append(node);
    } else if (label) {
      const node = doc.createElement("p");
      inline(node, `**${label[1]}：**${label[2]}`);
      container.append(node);
    } else if (line.trim()) paragraph.push(line);
    if (!item) list = null;
  }
  flush();
  return container;
}

export function collectShortDramaTasks(messages) {
  const tasks = [];
  const seen = new Set();
  for (const message of messages) {
    if (message.role !== "tool" || message.tool.name === "get_job_status") continue;
    const event = message.tool;
    if (event.result.job_id) {
      if (seen.has(event.result.job_id)) continue;
      seen.add(event.result.job_id);
    }
    tasks.push({ messageId:message.id, ...event });
  }
  return tasks;
}

export function createShortDramaController({ root, request, mediaUrl, onCreditsChange, onMessagesChange }) {
  const doc = root.ownerDocument;
  const get = (id) => root.querySelector(`#short-drama-${id}`);
  const list = get("sessions");
  const transcript = get("messages");
  const viewport = root.querySelector("#result-stage");
  const empty = get("empty");
  const input = root.querySelector("#tool-prompt");
  const form = root.querySelector("#generation-form");
  const execute = get("auto-execute");
  const send = root.querySelector("#generate-button");
  const status = get("status");
  const login = get("login");
  let available = false;
  let enabled = false;
  let authenticated = false;
  let busy = false;
  let refreshing = false;
  let session = null;
  let sessions = [];
  let messages = [];
  let timer = null;
  const jobStates = new Map();
  const expandedRequests = new Set();

  function element(tag, className, text) {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setStatus(text, error = false) {
    status.textContent = text;
    status.hidden = !text;
    status.classList.toggle("is-error", error);
    if (enabled) onMessagesChange(messages.length > 0 || Boolean(text));
    if (enabled && text) status.scrollIntoView({ behavior:"instant", block:"nearest" });
  }

  function syncControls() {
    if (!enabled) return;
    send.disabled = busy || !available || !authenticated;
    input.disabled = send.disabled;
    execute.disabled = send.disabled;
    get("new").disabled = busy || !authenticated;
    get("refresh-jobs").disabled = busy || refreshing || !session;
    list.disabled = busy || !authenticated;
    send.querySelector(".button-label").textContent = busy ? "正在处理…" : "发送";
    form.setAttribute("aria-busy", String(busy));
    transcript.setAttribute("aria-busy", String(busy));
  }

  function reportError(error) {
    if (error.status === 401) {
      authenticated = false;
      login.hidden = false;
      setStatus("请先登录，再创建和继续你的短剧。", true);
    } else if (error.status === 429) {
      setStatus("请求过于频繁，请稍后再试。", true);
    } else if (error.status === 503) {
      setStatus("短剧助手服务尚未就绪，请稍后再试或联系管理员。", true);
    } else {
      setStatus("助手暂未完成回复。已提交的任务请查看会话回执；请求不会自动重发。", true);
    }
  }

  function renderSessions() {
    list.replaceChildren(element("option", "", "新对话"), ...sessions.map((item) => {
      const option = element("option", "", item.title);
      option.value = item.id;
      return option;
    }));
    list.children[0].value = "";
    list.value = session?.id || "";
  }

  function renderTask(task) {
    const card = element("article", "drama-task");
    const header = element("div", "drama-task-header");
    const result = task.result;
    header.append(element("strong", "", TOOL_LABELS[task.name]));
    card.append(header);
    if (!result.ok) {
      card.dataset.status = "failed";
      header.append(element("span", "drama-task-status", "未提交"));
      card.append(element("p", "drama-task-prompt", TOOL_ERRORS[result.error] || "任务未提交，请调整需求后再试。"));
      return card;
    }
    const state = jobStates.get(result.job_id) || result;
    card.dataset.status = state.status;
    card.dataset.jobId = result.job_id;
    header.append(element("span", "drama-task-status", JOB_LABELS[state.status]));
    const prompt = task.arguments.title || task.arguments.prompt || task.arguments.text;
    if (prompt) card.append(element("p", "drama-task-prompt", prompt));
    if (state.total_shots) {
      card.append(element("p", "drama-storyboard-summary", `${state.completed_shots} / ${state.total_shots} 个镜头完成${state.phase === "composing" ? " · 正在合成" : ""}`));
      const progress = element("progress", "drama-storyboard-progress");
      progress.max = state.total_shots;
      progress.value = state.completed_shots;
      progress.setAttribute("aria-label", "分镜制作进度");
      const shots = element("ol", "drama-storyboard-shots");
      state.shots.forEach((shot, index) => {
        const label = shot.status === "pending" ? "待生成" : shot.status === "submitting" ? "提交中" : JOB_LABELS[shot.status];
        shots.append(element("li", "", `镜头 ${index + 1} · ${label}`));
      });
      card.append(progress, shots);
    }
    const cost = element("small", "drama-task-cost", `${task.name === "generate_storyboard" ? "预算 " : ""}${result.credits} 额度`);
    cost.title = `任务 ${result.job_id}`;
    card.append(cost);
    if (state.status === "failed" && state.error) {
      card.append(element("p", "drama-task-prompt", TOOL_ERRORS[state.error] || "制作失败，请查看已完成的素材后再提交。"));
    }
    if (state.status === "completed") {
      const output = element("div", "drama-task-result");
      const kind = task.name.includes("image") ? "image" : task.name === "synthesize_speech" ? "audio" : "video";
      const urls = kind === "image" ? state.images.map((image) => image.url) : [state.url];
      for (const value of urls) {
        const url = mediaUrl(value);
        if (!url) continue;
        const media = element(kind === "image" ? "img" : kind, "");
        media.src = url;
        if (kind === "image") { media.alt = "短剧生成画面"; media.loading = "lazy"; }
        else media.controls = true;
        const link = element("a", "", "打开生成结果 ↗");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        output.append(media, link);
      }
      card.append(output);
    }
    return card;
  }

  function renderMessages() {
    const previousScroll = viewport.scrollTop;
    const atEnd = transcript.children.length === 0 || viewport.scrollHeight - previousScroll - viewport.clientHeight < 48;
    const taskByMessage = new Map(collectShortDramaTasks(messages).map((task) => [task.messageId, task]));
    get("refresh-jobs").hidden = ![...taskByMessage.values()].some((task) => task.result.ok);
    const nodes = [];
    for (const message of messages) {
      if (message.role === "tool") {
        if (taskByMessage.has(message.id)) nodes.push(renderTask(taskByMessage.get(message.id)));
        continue;
      }
      const card = element("article", "drama-message");
      card.dataset.role = message.role;
      card.append(element("b", "drama-message-role", message.role === "user" ? "你" : "短剧助手"));
      if (message.role === "assistant") card.append(renderDramaText(doc, message.content));
      else if (message.content.length > 180) {
        const details = element("details", "drama-request-summary");
        details.open = expandedRequests.has(message.id);
        details.addEventListener("toggle", () => {
          if (details.open) expandedRequests.add(message.id);
          else expandedRequests.delete(message.id);
        });
        details.append(element("summary", "", `${message.content.slice(0, 100)}… · 展开需求`), element("div", "drama-message-content", message.content));
        card.append(details);
      } else card.append(element("div", "drama-message-content", message.content));
      nodes.push(card);
    }
    transcript.replaceChildren(...nodes);
    empty.hidden = messages.length > 0;
    if (enabled) onMessagesChange(messages.length > 0 || Boolean(status.textContent));
    viewport.scrollTop = atEnd ? viewport.scrollHeight : previousScroll;
  }

  function stopPolling() {
    clearTimeout(timer);
    timer = null;
  }

  function suspend() {
    enabled = false;
    stopPolling();
    input.disabled = false;
    send.disabled = false;
    form.setAttribute("aria-busy", "false");
  }

  function scheduleRefresh() {
    stopPolling();
    const pending = collectShortDramaTasks(messages).some((task) => {
      if (!task.result.ok) return false;
      const state = jobStates.get(task.result.job_id) || task.result;
      return ["queued", "running"].includes(state.status);
    });
    if (enabled && pending && !root.hidden) timer = setTimeout(refreshTasks, 5000);
  }

  async function refreshTasks() {
    if (!enabled || refreshing || !session) return;
    refreshing = true;
    syncControls();
    const sessionId = session.id;
    const tasks = collectShortDramaTasks(messages).filter((task) => task.result.ok && (jobStates.get(task.result.job_id) || task.result).status !== "completed");
    await Promise.all(tasks.map(async (task) => {
      try {
        const { body } = await request(task.result.status_url, { method:"GET" }, 10000);
        if (session?.id === sessionId) jobStates.set(task.result.job_id, body);
      } catch {
        if (session?.id === sessionId) jobStates.set(task.result.job_id, { status:"unavailable" });
      }
    }));
    refreshing = false;
    if (session?.id === sessionId) renderMessages();
    scheduleRefresh();
    syncControls();
  }

  async function readSession(id) {
    const { body } = await request(`${SESSIONS_URL}/${encodeURIComponent(id)}`, { method:"GET" }, 10000);
    session = body;
    messages = body.messages;
    renderSessions();
    renderMessages();
    scheduleRefresh();
  }

  async function open(isAvailable) {
    enabled = true;
    if (busy) { syncControls(); return; }
    available = isAvailable;
    busy = true;
    execute.checked = false;
    login.hidden = true;
    stopPolling();
    syncControls();
    setStatus("正在读取短剧会话…");
    try {
      const { body } = await request(SESSIONS_URL, { method:"GET" }, 10000);
      authenticated = true;
      sessions = body.items;
      jobStates.clear();
      if (sessions.length) {
        await readSession(sessions[0].id);
        await refreshTasks();
      } else {
        session = null;
        messages = [];
        renderSessions();
        renderMessages();
      }
      setStatus(available ? "" : "短剧助手尚未启用，请联系管理员配置服务。");
    } catch (error) {
      session = null;
      messages = [];
      sessions = [];
      renderSessions();
      renderMessages();
      reportError(error);
    } finally { busy = false; syncControls(); }
  }

  form.addEventListener("submit", async (event) => {
    if (!enabled) return;
    event.preventDefault();
    const message = input.value.trim();
    if (busy || !available || !authenticated || !message) return;
    const autoExecute = execute.checked;
    execute.checked = false;
    busy = true;
    stopPolling();
    syncControls();
    setStatus(autoExecute ? "助手正在处理，生成任务将保留在本会话…" : "助手正在整理故事与分镜…");
    try {
      if (!session) {
        const { body } = await request(SESSIONS_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ title:message.slice(0, 60) }) }, 10000);
        session = body;
        sessions.unshift(body);
        renderSessions();
      }
      await request(`${SESSIONS_URL}/${session.id}/messages`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ message, auto_execute:autoExecute }) }, 900000);
      if (enabled) input.value = "";
      await readSession(session.id);
      await refreshTasks();
      await onCreditsChange();
      setStatus("");
      if (enabled) transcript.lastElementChild?.scrollIntoView({ behavior:"smooth", block:"nearest" });
    } catch (error) {
      if (session && error.status !== 401) {
        try { await readSession(session.id); } catch { /* Preserve the last confirmed transcript; the failed send is never retried. */ }
      }
      reportError(error);
    } finally { busy = false; syncControls(); scheduleRefresh(); }
  });

  function newDraft() {
    stopPolling();
    session = null;
    messages = [];
    jobStates.clear();
    input.value = "";
    execute.checked = false;
    renderSessions();
    renderMessages();
    syncControls();
    setStatus("");
    input.focus();
  }
  get("new").addEventListener("click", newDraft);
  list.addEventListener("change", async (event) => {
    if (busy) return;
    const id = event.target.value;
    if (!id) { newDraft(); return; }
    busy = true;
    execute.checked = false;
    stopPolling();
    syncControls();
    try {
      jobStates.clear();
      await readSession(id);
      await refreshTasks();
      setStatus("");
    } catch (error) { reportError(error); }
    finally { busy = false; syncControls(); }
  });
  get("refresh-jobs").addEventListener("click", refreshTasks);
  syncControls();
  return { open, suspend, newDraft };
}

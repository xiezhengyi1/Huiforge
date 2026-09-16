"use strict";

const TOKEN_KEY = "huiju_admin_usage_token";
const SVG_NS = "http://www.w3.org/2000/svg";
const PROVIDER_COLORS = ["#2563eb", "#22a6c8", "#0f9f6e", "#e87b24", "#7c5ce5", "#d84a4a"];
const METRICS = {
  visitors: { label: "日独立访客合计（跨日可重复）", format: formatNumber },
  jobs: { label: "周期模型任务", format: formatNumber },
  provider_cost_usd: { label: "周期估算成本", format: formatMoney },
};

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || "",
  days: 30,
  metric: "visitors",
  data: null,
  toastTimer: 0,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function formatNumber(value, maximumFractionDigits = 0) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(number);
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (number === 0) return "$0.00";
  if (number < 0.01) return `$${number.toFixed(4)}`;
  return `$${number.toFixed(2)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatChange(value, suffix = "") {
  if (value === null || value === undefined) return "上期为 0，暂无可比值";
  const number = Number(value || 0);
  if (number === 0) return `与上期持平${suffix}`;
  return `较上期${number > 0 ? "增加" : "减少"} ${Math.abs(number).toFixed(1)}%${suffix}`;
}

function formatDuration(value) {
  const ms = Number(value || 0);
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatDay(day) {
  const parts = String(day || "").split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : day;
}

function formatTimestamp(value, withDate = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: withDate ? "2-digit" : undefined,
    day: withDate ? "2-digit" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(Number(value) * 1000));
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function requestAnalytics() {
  if (!state.token) throw new Error("token_required");
  const response = await fetch(`/api/v1/admin/analytics?days=${state.days}`, {
    headers: { Authorization: `Bearer ${state.token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "analytics_unavailable";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.error || detail;
    } catch (_) {}
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function loadData({ unlock = false } = {}) {
  const refresh = $("#refreshButton");
  refresh.classList.add("is-loading");
  refresh.disabled = true;
  setText("railStatus", "正在读取服务器");
  try {
    const payload = await requestAnalytics();
    state.data = payload;
    sessionStorage.setItem(TOKEN_KEY, state.token);
    document.body.classList.remove("is-locked");
    $("#dashboard").inert = false;
    $("#unlockError").textContent = "";
    $(".rail-note").classList.add("is-live");
    setText("railStatus", "服务器数据已连接");
    render(payload);
    if (!unlock) showToast("数据已刷新");
  } catch (error) {
    const messages = {
      admin_token_invalid: "管理员令牌无效，请重新输入。",
      admin_usage_not_configured: "服务器尚未配置 HUIJU_ADMIN_USAGE_TOKEN。",
      dashboard_server_connection_failed: "本地代理无法连接线上服务器，请检查启动终端中的 SSH 状态。",
      dashboard_ssh_disconnected: "SSH 连接已断开，请重新启动本地数据台。",
      token_required: "请输入管理员令牌。",
    };
    const message = messages[error.message] || "无法读取服务器数据，请检查服务状态。";
    $("#unlockError").textContent = message;
    if (error.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      state.token = "";
      $("#adminToken").value = "";
    }
    document.body.classList.add("is-locked");
    $(".rail-note").classList.remove("is-live");
    setText("railStatus", "连接未授权");
  } finally {
    refresh.classList.remove("is-loading");
    refresh.disabled = false;
  }
}

function render(data) {
  const { traffic, accounts, usage, recovery } = data;
  const range = usage.range;
  setText("todayVisitors", formatNumber(traffic.today.visitors));
  setText("todayViews", formatNumber(traffic.today.page_views));
  setText("todayApiWrites", formatNumber(traffic.today.api_writes));
  setText("monthVisitors", formatNumber(traffic.month.visitors));
  setText("allVisitors", formatNumber(traffic.all_time.visitors));
  setText("activeMembers", formatNumber(accounts.active_members));
  setText("memberRate", formatPercent(accounts.member_rate));
  setText("registeredUsers", formatNumber(accounts.registered_users));
  $("#memberMeter").style.width = `${Math.min(100, Number(accounts.member_rate || 0))}%`;
  setText("monthCost", formatMoney(usage.month.provider_cost_usd));
  setText("todayCost", formatMoney(usage.today.provider_cost_usd));
  setText("unpricedJobs", formatNumber(range.unpriced_jobs));

  setText("rangeJobs", formatNumber(range.jobs));
  setText("rangeLabel", `${data.range.days} 天 · ${formatChange(usage.change?.jobs)}`);
  setText("providerRequests", formatNumber(range.provider_requests));
  setText("successRate", formatPercent(range.success_rate));
  setText("failureNote", `${formatNumber(range.failed)} 次失败 · 成功率较上期 ${Number(usage.change?.success_rate || 0) >= 0 ? "+" : ""}${Number(usage.change?.success_rate || 0).toFixed(1)}pp`);
  setText("avgDuration", formatDuration(range.avg_duration_ms));
  setText("medianDuration", `中位数 ${formatDuration(range.median_duration_ms)}`);
  setText("p95Duration", formatDuration(range.p95_duration_ms));
  setText("maxDuration", `最慢 ${formatDuration(range.max_duration_ms)}`);
  setText("creditsCharged", formatNumber(range.credits_charged));
  setText("costPerJob", `单任务成本 ${formatMoney(range.completed ? range.provider_cost_usd / range.completed : 0)}`);

  setText("ringValue", formatPercent(range.success_rate));
  $("#successRing").style.setProperty("--score", `${Math.min(360, Number(range.success_rate || 0) * 3.6)}deg`);
  setText("completedJobs", formatNumber(range.completed));
  setText("failedJobs", formatNumber(range.failed));
  setText("pricingCoverage", formatPercent(range.nonlocal_jobs ? range.priced_jobs / range.nonlocal_jobs * 100 : 100));
  setText("requestsPerJob", range.jobs ? (range.provider_requests / range.jobs).toFixed(2) : "0.00");
  setText("outputsPerJob", range.jobs ? (range.outputs / range.jobs).toFixed(2) : "0.00");
  setText("releaseId", data.release);

  setText("walletOwners", `${formatNumber(accounts.wallet_owners)} 个活跃钱包`);
  setText("accountUsers", formatNumber(accounts.registered_users));
  setText("accountMembers", formatNumber(accounts.active_members));
  setText("newUsers", formatNumber(accounts.new_users_daily.reduce((sum, item) => sum + item.users, 0)));
  setText("historyCount", formatNumber(accounts.content.histories));
  setText("assetCount", formatNumber(accounts.content.assets));
  setText("workflowCount", formatNumber(accounts.content.workflows));
  setText("mediaJobCount", formatNumber(accounts.content.media_jobs));

  setText("rangeStart", new Date(data.range.start * 1000).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }));
  setText("rangeEnd", new Date(data.range.end * 1000).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }));
  setText("trackingSince", traffic.tracking_started_at
    ? `日访问趋势自 ${new Date(traffic.tracking_started_at * 1000).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} 开始累计；此前仅保留总量`
    : "日访问趋势将在新统计版本首次记录后开始累计");
  setText("lastUpdated", `最后更新 ${formatTimestamp(data.generated_at)}`);

  const unavailable = Number(traffic.coverage?.unavailable_days || 0);
  const notice = $("#coverageNotice");
  notice.classList.toggle("is-complete", unavailable === 0);
  setText("coverageTitle", unavailable ? "存在历史数据缺口" : "当前周期每日数据完整");
  setText("coverageText", unavailable
    ? `所选周期中 ${formatNumber(unavailable)} 天仅有旧版累计总量，不能可靠拆分日 UV；${traffic.coverage?.exact_from_day || "v165 启用日"} 起为精确日数据。`
    : `从 ${traffic.coverage?.exact_from_day || "当前统计起点"} 起按服务器会话去重，并纳入每日恢复快照。`);

  renderTrend();
  renderModels(usage.by_model, range.jobs);
  renderProviders(usage.by_provider);
  renderTiers(accounts.membership_tiers, accounts.active_members);
  renderRecent(usage.recent_events);
  renderSlowest(usage.slowest_events);
  renderRecovery(recovery || {});
  renderErrors(usage.error_breakdown || [], range.failed);
  renderDefinitions(data.definitions);
}

function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTrend() {
  const svg = $("#trendChart");
  const rows = state.data?.traffic?.daily || [];
  const metric = METRICS[state.metric];
  const values = rows.map((row) => row.coverage === "unavailable" ? null : Number(row[state.metric] || 0));
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  setText("chartTotal", metric.format(total));
  setText("chartCaption", metric.label);
  svg.replaceChildren();
  const empty = values.every((value) => value === null || value === 0);
  $("#chartEmpty").hidden = !empty;

  const defs = svgNode("defs");
  const gradient = svgNode("linearGradient", { id: "areaGradient", x1: "0", y1: "0", x2: "0", y2: "1" });
  gradient.append(svgNode("stop", { offset: "0%", "stop-color": "#2563eb", "stop-opacity": ".2" }));
  gradient.append(svgNode("stop", { offset: "100%", "stop-color": "#2563eb", "stop-opacity": "0" }));
  defs.append(gradient);
  svg.append(defs);

  const width = 760;
  const height = 250;
  const left = 34;
  const right = 14;
  const top = 20;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(...values.map((value) => Number(value || 0)), 1);
  for (let index = 0; index <= 4; index += 1) {
    const y = top + chartHeight * index / 4;
    svg.append(svgNode("line", { x1: left, y1: y, x2: width - right, y2: y, class: "grid-line" }));
    const tick = max * (1 - index / 4);
    svg.append(svgNode("text", { x: 0, y: y + 3, class: "axis-label" }, state.metric === "provider_cost_usd" ? tick.toFixed(2) : formatNumber(tick)));
  }
  if (!rows.length) return;
  const points = values.map((value, index) => ({
    x: left + (rows.length === 1 ? chartWidth / 2 : chartWidth * index / (rows.length - 1)),
    y: value === null ? null : top + chartHeight - chartHeight * value / max,
    value,
    day: rows[index].day,
  }));
  const availablePoints = points.filter((point) => point.value !== null);
  const unavailablePoints = points.filter((point) => point.value === null);
  if (unavailablePoints.length) {
    const bandEnd = availablePoints.length ? availablePoints[0].x - 5 : width - right;
    svg.append(svgNode("rect", { x: left, y: top, width: Math.max(0, bandEnd - left), height: chartHeight, rx: 6, class: "unavailable-band" }));
    svg.append(svgNode("text", { x: left + 8, y: top + 15, class: "unavailable-label" }, "旧版无日明细"));
  }
  if (availablePoints.length) {
    const line = availablePoints.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    const area = `${line} L${availablePoints.at(-1).x},${top + chartHeight} L${availablePoints[0].x},${top + chartHeight} Z`;
    svg.append(svgNode("path", { d: area, class: "chart-area" }));
    svg.append(svgNode("path", { d: line, class: "chart-line" }));
  }

  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
  points.forEach((point, index) => {
    if (point.value !== null) {
      const circle = svgNode("circle", { cx: point.x, cy: point.y, r: 3.5, class: "chart-point" });
      circle.append(svgNode("title", {}, `${point.day} · ${metric.format(point.value)}`));
      svg.append(circle);
    }
    if (index % labelEvery === 0 || index === points.length - 1) {
      svg.append(svgNode("text", { x: point.x, y: height - 8, "text-anchor": "middle", class: "axis-label" }, formatDay(point.day)));
    }
  });
}

function renderModels(groups, totalJobs) {
  const body = $("#modelRows");
  body.replaceChildren();
  setText("modelCount", `${formatNumber(groups.length)} 个模型`);
  if (!groups.length) {
    const row = element("tr");
    const cell = element("td", "empty-row", "当前周期暂无模型调用");
    cell.colSpan = 5;
    row.append(cell);
    body.append(row);
    return;
  }
  groups.slice(0, 12).forEach((group) => {
    const row = element("tr");
    const name = element("td");
    name.append(element("b", "", group.key));
    const share = element("td", "share-cell");
    const shareWrap = element("div");
    const bar = element("i");
    bar.style.setProperty("--share", `${totalJobs ? group.jobs / totalJobs * 100 : 0}%`);
    shareWrap.append(bar, element("b", "", formatNumber(group.jobs)));
    share.append(shareWrap);
    const success = element("td", "", formatPercent(group.success_rate));
    const duration = element("td", "", formatDuration(group.avg_duration_ms));
    const cost = element("td", "", formatMoney(group.provider_cost_usd));
    row.append(name, share, success, duration, cost);
    body.append(row);
  });
}

function renderProviders(groups) {
  const legend = $("#providerLegend");
  legend.replaceChildren();
  const total = groups.reduce((sum, group) => sum + group.jobs, 0);
  setText("providerTotal", formatNumber(total));
  let angle = 0;
  const segments = [];
  groups.slice(0, 6).forEach((group, index) => {
    const color = PROVIDER_COLORS[index];
    const next = angle + (total ? group.jobs / total * 360 : 0);
    segments.push(`${color} ${angle}deg ${next}deg`);
    angle = next;
    const item = element("div");
    const dot = element("i");
    dot.style.setProperty("--legend-color", color);
    item.append(dot, element("span", "", group.key), element("b", "", `${formatPercent(total ? group.jobs / total * 100 : 0)} · ${formatMoney(group.provider_cost_usd)}`));
    legend.append(item);
  });
  if (!groups.length) legend.append(element("span", "empty-row", "暂无服务商调用"));
  $("#providerDonut").style.background = segments.length
    ? `conic-gradient(${segments.join(",")})`
    : "conic-gradient(#edf1f5 0deg 360deg)";
}

function renderTiers(tiers, activeMembers) {
  const list = $("#tierList");
  list.replaceChildren();
  if (!tiers.length) {
    list.append(element("div", "empty-row", "当前没有有效付费会员"));
    return;
  }
  tiers.forEach((tier) => {
    const item = element("div");
    const bar = element("i");
    bar.style.setProperty("--tier-share", `${activeMembers ? tier.members / activeMembers * 100 : 0}%`);
    item.append(element("span", "", tier.tier), bar, element("b", "", formatNumber(tier.members)));
    list.append(item);
  });
}

function renderRecent(events) {
  const body = $("#recentRows");
  body.replaceChildren();
  if (!events.length) {
    const row = element("tr");
    const cell = element("td", "empty-row", "当前周期暂无模型调用明细");
    cell.colSpan = 6;
    row.append(cell);
    body.append(row);
    return;
  }
  events.forEach((event) => {
    const row = element("tr");
    const model = element("td", "event-model");
    model.append(element("b", "", event.model), element("span", "", `${event.operation} · ${event.media_kind}`));
    const status = element("td");
    status.append(element("span", `status-pill${event.status === "completed" ? "" : " failed"}`, event.status === "completed" ? "完成" : "失败"));
    row.append(
      element("td", "", formatTimestamp(event.created_at)),
      model,
      element("td", "", event.provider),
      status,
      element("td", "", formatDuration(event.duration_ms)),
      element("td", "", event.provider_cost_usd === null ? "未定价" : formatMoney(event.provider_cost_usd)),
    );
    body.append(row);
  });
}

function renderSlowest(events) {
  const list = $("#slowList");
  list.replaceChildren();
  if (!events.length) {
    list.append(element("li", "empty-row", "当前周期暂无耗时数据"));
    return;
  }
  events.forEach((event, index) => {
    const item = element("li");
    const detail = element("div");
    detail.append(element("strong", "", event.model), element("span", "", `${event.provider} · ${formatTimestamp(event.created_at)}`));
    item.append(element("b", "", String(index + 1).padStart(2, "0")), detail, element("em", "", formatDuration(event.duration_ms)));
    list.append(item);
  });
}

function renderRecovery(recovery) {
  const labels = {
    healthy: "备份正常",
    stale: "备份已过期",
    missing: "尚无恢复点",
    corrupt: "完整性异常",
  };
  const stateNode = $("#recoveryState");
  stateNode.textContent = labels[recovery.state] || "状态未知";
  stateNode.className = `recovery-state ${recovery.state === "healthy" ? "healthy" : recovery.state === "corrupt" ? "corrupt" : ""}`;
  setText("lastSnapshot", recovery.last_snapshot_at ? formatTimestamp(recovery.last_snapshot_at) : "尚未创建");
  setText("restorePoints", `${formatNumber(recovery.restore_points)} 个`);
  setText("snapshotIntegrity", recovery.integrity === "ok" ? "通过" : recovery.integrity === "failed" ? "失败" : "待校验");
  setText("retentionDays", `${formatNumber(recovery.retention_days || 0)} 天`);
  setText("recoveryNote", recovery.state === "healthy"
    ? `恢复点覆盖 ${recovery.oldest_day || "—"} 至 ${recovery.newest_day || "—"}；每日文件持续刷新，跨日后成为完整日快照。`
    : "点击“立即备份”建立完整性校验后的恢复点；真正恢复需先停止入口服务，再运行离线恢复命令。");
}

function renderErrors(errors, total) {
  const list = $("#errorList");
  list.replaceChildren();
  setText("errorTotal", `${formatNumber(total)} 次失败`);
  if (!errors.length) {
    list.append(element("div", "empty-row", "当前周期没有失败任务"));
    return;
  }
  errors.slice(0, 8).forEach((error) => {
    const item = element("div");
    const bar = element("i");
    bar.style.setProperty("--error-share", `${Math.min(100, Number(error.share || 0))}%`);
    item.append(element("span", "", error.code), element("b", "", `${formatNumber(error.count)} · ${formatPercent(error.share)}`), bar);
    list.append(item);
  });
}

function renderDefinitions(definitions) {
  const titles = {
    visitor: "浏览人数",
    api_write: "业务写 API",
    provider_request: "上游 API",
    cost: "估算成本",
    duration: "执行时间",
    recovery: "每日恢复",
  };
  const list = $("#definitionList");
  list.replaceChildren();
  Object.entries(titles).forEach(([key, title]) => {
    const item = element("div");
    item.append(element("dt", "", title), element("dd", "", definitions[key] || "—"));
    list.append(item);
  });
}

$("#unlockForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.token = $("#adminToken").value.trim();
  await loadData({ unlock: true });
});

$("#toggleToken").addEventListener("click", () => {
  const input = $("#adminToken");
  input.type = input.type === "password" ? "text" : "password";
  $("#toggleToken").textContent = input.type === "password" ? "显示" : "隐藏";
});

$("#lockButton").addEventListener("click", () => {
  state.token = "";
  state.data = null;
  sessionStorage.removeItem(TOKEN_KEY);
  $("#adminToken").value = "";
  document.body.classList.add("is-locked");
  $("#dashboard").inert = true;
  setText("railStatus", "等待连接");
});

$("#refreshButton").addEventListener("click", () => loadData());

$("#exportButton").addEventListener("click", async () => {
  const button = $("#exportButton");
  button.disabled = true;
  try {
    const response = await fetch(`/api/v1/admin/analytics/export?days=${state.days}&format=csv`, {
      headers: { Authorization: `Bearer ${state.token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("export_failed");
    const blob = await response.blob();
    const link = document.createElement("a");
    const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "");
    link.download = match?.[1] || "huiju-analytics.csv";
    link.href = URL.createObjectURL(blob);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("每日汇总已导出，不包含会话标识或私有内容");
  } catch (_) {
    showToast("导出失败，请检查服务器状态");
  } finally {
    button.disabled = false;
  }
});

$("#snapshotButton").addEventListener("click", async () => {
  const button = $("#snapshotButton");
  button.disabled = true;
  try {
    const response = await fetch("/api/v1/admin/analytics/snapshot", {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("snapshot_failed");
    await loadData();
    showToast("每日恢复点已创建并通过完整性校验");
  } catch (_) {
    showToast("备份失败，请检查持久化目录权限");
  } finally {
    button.disabled = false;
  }
});

$$('[data-days]').forEach((button) => button.addEventListener("click", async () => {
  state.days = Number(button.dataset.days);
  $$('[data-days]').forEach((item) => item.classList.toggle("active", item === button));
  await loadData();
}));

$$('[data-metric]').forEach((button) => button.addEventListener("click", () => {
  state.metric = button.dataset.metric;
  $$('[data-metric]').forEach((item) => item.classList.toggle("active", item === button));
  renderTrend();
}));

const sections = $$('main > section[id]');
const navLinks = $$('.side-rail nav a');
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`));
  }, { rootMargin: "-20% 0px -65%", threshold: [0, .25, .5] });
  sections.forEach((section) => observer.observe(section));
}

if (state.token) {
  $("#adminToken").value = state.token;
  loadData({ unlock: true });
} else {
  $("#adminToken").focus();
}

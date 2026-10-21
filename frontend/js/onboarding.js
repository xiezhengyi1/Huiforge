"use strict";

(() => {
  const flows = window.HuijuOnboardingFlows || {};
  const state = { flow: null, flowId: "", identity: window.HuijuOnboardingIdentity || "", index: 0, target: null, open: false, transitioning: false, started: new Set() };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const layer = document.createElement("div");
  layer.className = "onboarding-layer";
  layer.hidden = true;
  layer.innerHTML = `
    <button class="onboarding-blocker" type="button" tabindex="-1" aria-hidden="true"></button>
    <div class="onboarding-focus-ring" aria-hidden="true"></div>
    <section class="onboarding-popover" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" tabindex="-1">
      <div class="onboarding-head"><span class="onboarding-step-label"></span><button class="onboarding-skip" type="button">跳过引导</button></div>
      <h2 id="onboarding-title"></h2>
      <p id="onboarding-description"></p>
      <small class="onboarding-click-hint">点击卡片空白处继续 →</small>
      <div class="onboarding-footer"><div class="onboarding-progress" aria-label="引导进度"></div><div class="onboarding-actions"><button class="onboarding-back" type="button">上一步</button><button class="onboarding-next" type="button">下一步</button></div></div>
    </section>`;
  document.body.append(layer);

  const ring = layer.querySelector(".onboarding-focus-ring");
  const popover = layer.querySelector(".onboarding-popover");
  const title = layer.querySelector("#onboarding-title");
  const description = layer.querySelector("#onboarding-description");
  const label = layer.querySelector(".onboarding-step-label");
  const progress = layer.querySelector(".onboarding-progress");
  const backButton = layer.querySelector(".onboarding-back");
  const nextButton = layer.querySelector(".onboarding-next");
  const skipButton = layer.querySelector(".onboarding-skip");

  const replay = document.createElement("button");
  replay.className = "onboarding-replay";
  replay.type = "button";
  replay.title = "重新查看当前界面的新手引导";
  replay.setAttribute("aria-label", "重新查看新手引导");
  replay.innerHTML = '<span aria-hidden="true">?</span><b>新手引导</b>';
  document.body.append(replay);

  function currentView() {
    return document.body.classList.contains("workflow-active") ? "workflow" : "main";
  }

  function identityKey() {
    return String(state.identity || "anonymous-device").replace(/[^a-z0-9_.-]/gi, "_").slice(0, 80);
  }

  function storageKey(flow) {
    return `huiju.onboarding.${identityKey()}.${flow.id || state.flowId}.v${flow.version || 1}`;
  }

  function wasSeen(flow) {
    try { return localStorage.getItem(storageKey(flow)) === "done"; } catch { return false; }
  }

  function markSeen(flow, reason) {
    try { localStorage.setItem(storageKey(flow), "done"); } catch { /* Private mode still gets a usable tour. */ }
    window.dispatchEvent(new CustomEvent("huiju:onboarding-complete", { detail: { flow: state.flowId, reason } }));
  }

  function visibleTarget(step) {
    const selectors = [
      step?.selector,
      step?.fallbackSelector,
      ...(Array.isArray(step?.fallbackSelectors) ? step.fallbackSelectors : []),
    ].filter(Boolean);
    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)];
      const match = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return !node.hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
      });
      if (match) return match;
    }
    return null;
  }

  function normalizePlacement(value) {
    const candidate = String(value || "").toLowerCase();
    if (["top", "bottom", "left", "right"].includes(candidate)) return candidate;
    return ["top", "bottom", "left", "right"].find((side) => candidate.startsWith(side)) || "bottom";
  }

  async function prepareStep(step) {
    const prepare = step.beforeShow || step.prepare;
    if (typeof prepare === "function") await prepare({ flow: state.flow, step, index: state.index });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function place() {
    if (!state.open || !state.target) return;
    const step = state.flow.steps[state.index];
    const rect = state.target.getBoundingClientRect();
    const padding = Number(step.spotlightPadding ?? step.highlightPadding ?? 7);
    ring.style.top = `${Math.max(4, rect.top - padding)}px`;
    ring.style.left = `${Math.max(4, rect.left - padding)}px`;
    ring.style.width = `${Math.min(innerWidth - 8, rect.width + padding * 2)}px`;
    ring.style.height = `${Math.min(innerHeight - 8, rect.height + padding * 2)}px`;
    const computedRadius = parseFloat(getComputedStyle(state.target).borderRadius) || 10;
    const requestedRadius = Number(step.spotlightRadius ?? step.highlightRadius);
    ring.style.borderRadius = `${Number.isFinite(requestedRadius) ? requestedRadius : Math.min(22, Math.max(10, computedRadius + 4))}px`;
    if (innerWidth <= 700) return;

    const gap = 17;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const available = {
      bottom: innerHeight - rect.bottom,
      top: rect.top,
      right: innerWidth - rect.right,
      left: rect.left,
    };
    const preferredPlacement = normalizePlacement(innerWidth <= 700 ? step.mobilePlacement : step.placement);
    const preferred = [preferredPlacement, "bottom", "top", "right", "left"].filter((item, index, list) => item && list.indexOf(item) === index);
    const placement = preferred.find((item) => available[item] >= ((item === "top" || item === "bottom") ? height + gap : width + gap)) || preferred.sort((a, b) => available[b] - available[a])[0] || "bottom";
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - width / 2;
    if (placement === "top") top = rect.top - height - gap;
    if (placement === "right") { top = rect.top + rect.height / 2 - height / 2; left = rect.right + gap; }
    if (placement === "left") { top = rect.top + rect.height / 2 - height / 2; left = rect.left - width - gap; }
    top = Math.max(12, Math.min(innerHeight - height - 12, top));
    left = Math.max(12, Math.min(innerWidth - width - 12, left));
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.right = "auto";
    popover.style.bottom = "auto";
    popover.dataset.placement = placement;
    const arrowPosition = placement === "top" || placement === "bottom"
      ? rect.left + rect.width / 2 - left - 7
      : rect.top + rect.height / 2 - top - 7;
    popover.style.setProperty("--arrow-offset", `${Math.max(20, Math.min((placement === "top" || placement === "bottom" ? width : height) - 34, arrowPosition))}px`);
  }

  async function show(index, direction = 1) {
    if (!state.flow || state.transitioning) return;
    state.transitioning = true;
    nextButton.disabled = true;
    backButton.disabled = true;
    skipButton.disabled = true;
    try {
      const steps = state.flow.steps || [];
      let nextIndex = index;
      let attempts = 0;
      while (attempts < steps.length) {
        if (nextIndex < 0 || nextIndex >= steps.length) { finish("completed"); return; }
        const previousStep = steps[state.index];
        if (state.target && state.index !== nextIndex && typeof previousStep?.afterHide === "function") {
          await previousStep.afterHide({ flow: state.flow, step: previousStep, index: state.index });
        }
        state.index = nextIndex;
        const step = steps[nextIndex];
        await prepareStep(step);
        const target = visibleTarget(step);
        if (target) {
          state.target = target;
          const rect = target.getBoundingClientRect();
          if (rect.top < 10 || rect.bottom > innerHeight - 10) {
            target.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
            await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 20 : 280));
          }
          title.textContent = step.title;
          description.textContent = step.description || step.body || "";
          label.textContent = `${state.flow.label || "新手引导"} · ${nextIndex + 1}/${steps.length}`;
          progress.replaceChildren(...steps.map((_, itemIndex) => {
            const dot = document.createElement("i");
            dot.classList.toggle("active", itemIndex === nextIndex);
            return dot;
          }));
          backButton.hidden = nextIndex === 0;
          nextButton.textContent = nextIndex === steps.length - 1 ? "开始创作" : "下一步";
          place();
          popover.focus({ preventScroll: true });
          return;
        }
        nextIndex += direction;
        attempts += 1;
      }
      finish("unavailable");
    } finally {
      state.transitioning = false;
      nextButton.disabled = false;
      backButton.disabled = false;
      skipButton.disabled = false;
    }
  }

  async function start(flowId = currentView(), options = {}) {
    const flow = flows[flowId];
    if (!flow || state.open || (!options.force && wasSeen(flow))) return false;
    if (typeof flow.matches === "function" && !flow.matches()) return false;
    if (typeof flow.prepare === "function") await flow.prepare();
    state.flow = flow;
    state.flowId = flowId;
    state.index = 0;
    state.open = true;
    state.started.add(`${identityKey()}:${flowId}`);
    layer.hidden = false;
    document.body.classList.add("onboarding-open");
    await show(0, 1);
    return true;
  }

  function finish(reason = "skipped") {
    if (!state.open) return;
    const finishedFlow = state.flow;
    markSeen(finishedFlow, reason);
    if (typeof finishedFlow.onExit === "function") finishedFlow.onExit({ reason });
    layer.hidden = true;
    document.body.classList.remove("onboarding-open");
    state.flow = null;
    state.flowId = "";
    state.target = null;
    state.open = false;
    replay.focus({ preventScroll: true });
  }

  function maybeStart(flowId = currentView()) {
    const flow = flows[flowId];
    if (!flow || wasSeen(flow) || state.open) return;
    window.setTimeout(() => start(flowId), flowId === "workflow" ? 380 : 120);
  }

  nextButton.addEventListener("click", () => show(state.index + 1, 1));
  popover.addEventListener("click", (event) => {
    if (state.open && !state.transitioning && !event.target.closest("button")) show(state.index + 1, 1);
  });
  backButton.addEventListener("click", () => show(state.index - 1, -1));
  skipButton.addEventListener("click", () => finish("skipped"));
  replay.addEventListener("click", () => start(currentView(), { force: true }));
  window.addEventListener("resize", place, { passive: true });
  window.addEventListener("scroll", place, { passive: true, capture: true });
  window.addEventListener("huiju:workspace-view", (event) => maybeStart(event.detail?.view === "workflow" ? "workflow" : "main"));
  window.addEventListener("huiju:onboarding-identity", (event) => {
    state.identity = String(event.detail?.key || "anonymous-device");
    maybeStart(currentView());
  });
  document.addEventListener("keydown", (event) => {
    if (!state.open) return;
    if (event.key === "Escape") { event.preventDefault(); finish("skipped"); }
    if (event.key === "ArrowRight") { event.preventDefault(); show(state.index + 1, 1); }
    if (event.key === "ArrowLeft" && state.index > 0) { event.preventDefault(); show(state.index - 1, -1); }
    if ((event.key === "Enter" || event.key === " ") && document.activeElement === popover) { event.preventDefault(); show(state.index + 1, 1); }
    if (event.key === "Tab") {
      const controls = [...popover.querySelectorAll("button:not([hidden])")];
      if (!controls.length) return;
      const active = controls.indexOf(document.activeElement);
      const next = event.shiftKey ? (active <= 0 ? controls.length - 1 : active - 1) : (active + 1) % controls.length;
      event.preventDefault();
      controls[next].focus();
    }
  });

  window.HuijuOnboarding = Object.freeze({ start, finish, maybeStart, reset(flowId = currentView()) { const flow = flows[flowId]; if (!flow) return; try { localStorage.removeItem(storageKey(flow)); } catch {} } });
  if (state.identity) maybeStart(currentView());
  else window.setTimeout(() => { if (!state.identity) { state.identity = "anonymous-device"; maybeStart(currentView()); } }, 2200);
})();

(function registerWorkflowOnboarding(global) {
  "use strict";

  const FLOW_ID = "workflow";
  const FLOW_VERSION = 2;
  const WORKSPACE_SELECTOR = "#workflow-workspace";
  const WORKSPACE_TRIGGER_SELECTOR = '[data-workspace-view="workflow"]';
  const PICKER_SELECTOR = "#workflow-node-picker";
  const PICKER_CLOSE_SELECTOR = "#workflow-node-picker-close";
  let pickerOpenedByTour = false;
  let previousFocus = null;

  const waitFor = (predicate, timeout = 1200) => new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      const value = predicate();
      if (value || Date.now() - startedAt >= timeout) return resolve(value || null);
      global.requestAnimationFrame(check);
    };
    check();
  });

  const visible = (element) => Boolean(
    element
    && element.isConnected
    && !element.hidden
    && element.getClientRects().length,
  );

  async function prepareWorkflow() {
    previousFocus = global.document.activeElement instanceof global.HTMLElement
      ? global.document.activeElement
      : null;

    const workspace = global.document.querySelector(WORKSPACE_SELECTOR);
    if (!workspace) return false;
    if (!visible(workspace)) global.document.querySelector(WORKSPACE_TRIGGER_SELECTOR)?.click();

    return Boolean(await waitFor(() => {
      const target = global.document.querySelector(WORKSPACE_SELECTOR);
      return visible(target) && global.document.body.classList.contains("workflow-active")
        ? target
        : null;
    }));
  }

  async function revealNodePicker() {
    const picker = global.document.querySelector(PICKER_SELECTOR);
    if (!picker) return false;
    if (visible(picker)) return true;

    const viewport = global.document.querySelector("#workflow-viewport");
    if (!visible(viewport)) return false;
    const rect = viewport.getBoundingClientRect();
    viewport.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.min(Math.max(rect.width / 2, 40), rect.width - 40),
      clientY: rect.top + Math.min(Math.max(rect.height / 2, 40), rect.height - 40),
      view: global,
    }));
    pickerOpenedByTour = Boolean(await waitFor(() => visible(picker) ? picker : null));
    return pickerOpenedByTour;
  }

  function closeTourPicker() {
    if (!pickerOpenedByTour) return;
    global.document.querySelector(PICKER_CLOSE_SELECTOR)?.click();
    pickerOpenedByTour = false;
  }

  async function revealNodeControls() {
    closeTourPicker();
    global.document.querySelector("#workflow-fit")?.click();
    return Boolean(await waitFor(() => {
      const node = global.document.querySelector('#workflow-board .workflow-node-dynamic:not([data-node-category="input"]):not([data-node-category="output"])');
      return visible(node) ? node : null;
    }));
  }

  function finishWorkflowOnboarding() {
    closeTourPicker();
    if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
  }

  const workflow = Object.freeze({
    id: FLOW_ID,
    version: FLOW_VERSION,
    storageKey: `huiju.onboarding.${FLOW_ID}.v${FLOW_VERSION}`,
    route: "studio.html?workspace=workflow",
    rootSelector: WORKSPACE_SELECTOR,
    triggerSelector: WORKSPACE_TRIGGER_SELECTOR,
    label: "工作流幕布新手引导",
    ariaLabel: "工作流幕布新手引导",
    prepare: prepareWorkflow,
    onExit: finishWorkflowOnboarding,
    steps: Object.freeze([
      Object.freeze({
        id: "workflow-canvas",
        selector: "#workflow-canvas-shell",
        title: "欢迎来到工作流幕布",
        description: "这里是一块可平移、缩放的无界幕布。拖动空白处浏览流程，使用左下角缩放控件调整视野。",
        placement: "bottom",
        mobilePlacement: "center",
        optional: false,
        targetMissing: "skip",
        highlightPadding: 8,
      }),
      Object.freeze({
        id: "workflow-import-json",
        selector: "#workflow-import",
        fallbackSelector: ".workflow-floating-actions",
        title: "导入别人分享的工作流文件",
        description: "收到别人导出的 JSON 文件后，点击“导入”选择文件即可还原节点、连线和参数。导入前无需新建空白流程；系统会校验文件大小与格式。",
        placement: "bottom",
        mobilePlacement: "bottom",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 7,
        beforeShow: closeTourPicker,
      }),
      Object.freeze({
        id: "workflow-community-library",
        selector: '[data-workflow-library-tab="shared"]',
        fallbackSelector: ".workflow-resource-dock",
        title: "直接复用社区或本机工作流",
        description: "点击底部“工作流”打开资源库，可在“社区”查看其他创作者发布的流程，在“本机”继续自己的草稿。选择流程后会载入幕布，再按需要修改参数。",
        placement: "top",
        mobilePlacement: "bottom",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 7,
      }),
      Object.freeze({
        id: "workflow-node-library",
        selector: PICKER_SELECTOR,
        fallbackSelector: "#workflow-viewport",
        title: "双击空白处添加节点",
        description: "节点库按输入、生成、编辑和输出分类。双击幕布空白处即可打开；此处已为你临时展开，选择节点不会自动运行。",
        placement: "right",
        mobilePlacement: "center",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 6,
        beforeShow: revealNodePicker,
        prepare: revealNodePicker,
        afterHide: closeTourPicker,
      }),
      Object.freeze({
        id: "workflow-node-options",
        selector: '#workflow-board .workflow-node-dynamic:not([data-node-category="input"]):not([data-node-category="output"])',
        fallbackSelectors: ["#workflow-board [data-node-field]", "#workflow-board .workflow-node-dynamic"],
        title: "先检查每个节点的输入与选项",
        description: "每张节点卡片都有自己的模型、提示词、分辨率、画笔或输出格式等选项。连线负责传递上游结果，卡片内参数只影响当前节点；拖动标题可整理位置，右上角可移除节点。",
        placement: "right",
        mobilePlacement: "bottom",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 8,
        beforeShow: revealNodeControls,
      }),
      Object.freeze({
        id: "workflow-run-node",
        selector: "#workflow-board [data-workflow-run-node]",
        fallbackSelectors: ['#workflow-board .workflow-node-dynamic:not([data-node-category="input"]):not([data-node-category="output"])', "#workflow-board .workflow-node-dynamic"],
        title: "先用“运行节点”局部试跑",
        description: "调整完一个生成或编辑节点后，可先运行该节点。系统只执行它和必要的上游输入，并把结果显示在节点内，适合逐段检查参数，避免每次都重跑整条流程。",
        placement: "right",
        mobilePlacement: "bottom",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 7,
        beforeShow: revealNodeControls,
      }),
      Object.freeze({
        id: "workflow-connect",
        selector: '#workflow-board [data-port-direction="output"]',
        fallbackSelector: "#workflow-lines",
        title: "从输出端连到输入端",
        description: "从节点右侧输出点拖向下一个节点的输入点，松开即可连线。端口类型必须匹配；点击连线后可按 Delete 删除。",
        placement: "right",
        mobilePlacement: "bottom",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 10,
        beforeShow: () => {
          closeTourPicker();
          return true;
        },
      }),
      Object.freeze({
        id: "workflow-run",
        selector: "#workflow-run",
        title: "运行完整工作流",
        description: "各节点试跑无误、连线和参数确认完整后，再从这里执行整条流程。系统会从输出节点向上追溯依赖并检查缺失输入；Credits 只按实际调用的能力扣除。",
        placement: "bottom",
        mobilePlacement: "bottom",
        optional: false,
        targetMissing: "skip",
        highlightPadding: 8,
      }),
      Object.freeze({
        id: "workflow-save-share",
        selector: "#workflow-share",
        title: "保存、导出或分享",
        description: "保存到本机便于继续编辑，也可以导出 JSON 备份；登录后还能发布到工作流广场供他人复用。",
        placement: "bottom",
        mobilePlacement: "bottom",
        optional: false,
        targetMissing: "skip",
        highlightPadding: 8,
      }),
      Object.freeze({
        id: "workflow-credits",
        selector: ".studio-topbar .credits-button.credits-link",
        fallbackSelector: ".credits-button.credits-link",
        title: "随时查看 Credits",
        description: "这里显示当前余额。点击可查看会员额度与各模型消耗；建议运行复杂工作流前先确认余额。",
        placement: "left",
        mobilePlacement: "bottom",
        optional: true,
        targetMissing: "use-fallback",
        highlightPadding: 8,
      }),
    ]),
  });

  const registry = global.HuijuOnboardingFlows || {};
  registry.workflow = workflow;
  global.HuijuOnboardingFlows = registry;

  if (typeof module === "object" && module.exports) module.exports = workflow;
})(typeof window !== "undefined" ? window : globalThis);

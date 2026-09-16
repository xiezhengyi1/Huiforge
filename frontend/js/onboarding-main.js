(function registerMainWorkspaceOnboarding(global) {
  "use strict";

  const doc = global.document;

  function firstVisible(selector) {
    if (!doc) return null;
    const candidates = doc.querySelectorAll(selector);
    return [...candidates].find((element) => {
      if (!(element instanceof global.HTMLElement)) return false;
      if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
      const style = global.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }) || null;
  }

  function openMainWorkspace() {
    if (!doc) return;
    const quickButton = doc.querySelector('[data-workspace-view="quick"]');
    const quickWorkspace = doc.querySelector("#quick-workspace");
    const mainAlreadyVisible = quickWorkspace && !quickWorkspace.hidden
      && !doc.body.classList.contains("workflow-active");
    if (!mainAlreadyVisible && quickButton instanceof global.HTMLElement) quickButton.click();
  }

  function closeFloatingPanels() {
    if (!doc) return;
    const expandedTriggers = [
      "#model-select-trigger",
      "#output-settings-trigger",
      "#preset-select-trigger",
      "#style-select-trigger",
    ];
    expandedTriggers.forEach((selector) => {
      const trigger = doc.querySelector(selector);
      if (trigger?.getAttribute("aria-expanded") === "true") trigger.click();
    });
  }

  const steps = [
    {
      id: "capabilities",
      selector: ".studio-sidebar .capability-nav",
      fallbackSelectors: [".studio-sidebar", '[data-workspace-view="quick"]'],
      title: "先选择创作能力",
      description: "从 AI 生图、图片编辑、视频、短剧到配声，左侧能力导航会把主工作区切换到对应任务。手机端若折叠侧栏，可先打开菜单。",
      placement: "right",
      mobilePlacement: "bottom",
      spotlightPadding: 8,
      spotlightRadius: 14,
      optional: true,
      beforeShow: openMainWorkspace,
    },
    {
      id: "task-input",
      selector: "#generation-form",
      fallbackSelectors: ["#prompt", "#source-image-group", ".controls-panel"],
      title: "输入任务或添加素材",
      description: "用文字说清主体、场景、构图与限制；图生图、图生视频等任务会在这里显示素材上传区和专属设置。",
      placement: "bottom",
      mobilePlacement: "bottom",
      spotlightPadding: 8,
      spotlightRadius: 18,
      beforeShow() {
        openMainWorkspace();
        closeFloatingPanels();
      },
    },
    {
      id: "model-and-parameters",
      selector: "#generation-form .prompt-tools",
      fallbackSelectors: ["#model-select-trigger", "#output-settings-trigger"],
      title: "选择模型与输出参数",
      description: "模型决定能力和计费；相邻选项可调整比例、清晰度、数量、预设与风格。切换任务后，可用参数会自动变化。",
      placement: "top",
      mobilePlacement: "bottom",
      spotlightPadding: 6,
      spotlightRadius: 12,
      beforeShow: closeFloatingPanels,
    },
    {
      id: "generate",
      selector: "#generate-button",
      fallbackSelectors: ["#generation-form [type='submit']"],
      title: "确认消耗并开始生成",
      description: "按钮右侧会显示本次预计消耗的 Credits。提交后可取消等待，任务状态会同步显示在结果区。",
      placement: "top",
      mobilePlacement: "top",
      spotlightPadding: 7,
      spotlightRadius: 12,
      beforeShow: closeFloatingPanels,
    },
    {
      id: "results",
      selector: "#quick-workspace .results-panel",
      fallbackSelectors: ["#result-stage", "#result-grid"],
      title: "在结果区查看与保存作品",
      description: "生成进度、错误提示和最终作品都会出现在这里。完成后可预览、下载，并把可复用内容加入个人资产。",
      placement: "left",
      mobilePlacement: "top",
      spotlightPadding: 8,
      spotlightRadius: 18,
      optional: true,
    },
    {
      id: "history",
      selector: "#history-trigger-button",
      fallbackSelectors: ["#history-panel", "#history-list"],
      title: "随时找回生成记录",
      description: "点击时钟按钮打开生成记录。这里保留当前浏览器中的作品链接、时间和提示词，方便复用与对比。",
      placement: "top",
      mobilePlacement: "top",
      spotlightPadding: 7,
      spotlightRadius: 12,
      optional: true,
      beforeShow() {
        const panel = doc?.querySelector("#history-panel");
        const close = doc?.querySelector("#history-drawer-close");
        if (panel?.getAttribute("aria-hidden") === "false" && close instanceof global.HTMLElement) close.click();
      },
    },
    {
      id: "credits",
      selector: ".studio-topbar .credits-button",
      fallbackSelectors: ["#credits-total", "a[href='pricing.html']"],
      title: "查看 Credits 与会员状态",
      description: "这里显示当前可用 Credits。生成前先核对按钮上的预计消耗；点击额度入口可查看会员权益和完整计费规则。",
      placement: "bottom-end",
      mobilePlacement: "bottom",
      spotlightPadding: 7,
      spotlightRadius: 999,
      optional: true,
    },
  ];

  const flow = Object.freeze({
    id: "main-workspace",
    version: 1,
    storageKey: "huiju:onboarding:main-workspace:v1",
    label: "主工作区新手引导",
    ariaLabel: "主工作区新手引导",
    steps: Object.freeze(steps.map((step) => Object.freeze(step))),
    matches() {
      return Boolean(firstVisible("#quick-workspace"))
        && !doc?.body.classList.contains("workflow-active");
    },
    prepare: openMainWorkspace,
    onExit: closeFloatingPanels,
  });

  const registry = global.HuijuOnboardingFlows || {};
  registry.main = flow;
  global.HuijuOnboardingFlows = registry;
  global.dispatchEvent?.(new global.CustomEvent("huiju:onboarding-flow-ready", {
    detail: { key: "main", flow },
  }));
})(window);

# Huiforge 前端审查工作流

## 审查

用同一构建打开首页、工作台和工作流。桌面检查侧栏的展开、收起和视图切换，平板检查布局断点两侧，手机检查最窄宽度下的主操作、画布和弹层。记录路径、窗口尺寸、触发步骤和截图。用 Tab、Enter、Space 和 Escape 重走对应操作，观察焦点、状态和返回位置。

常用复查尺寸为 1440 × 900、1024 × 768、801 × 650、768 × 720、390 × 844 和 320 × 640。工作流画布允许平移，画布外的页面操作仍应能在窄屏内完成。[W3C WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow)

## 优化

先处理操作不可达、状态歧义和遮挡，再处理对齐、留白和视觉层级。为每项问题写出可观察的验收条件。导航在收起和展开时应有明确状态，图标按钮有可读名称和可见焦点。按页面任务调整控件密度，给预览和画布留出空间。[Nielsen Norman Group 可用性原则](https://www.nngroup.com/articles/ten-usability-heuristics/) · [Material Design 桌面布局](https://m3.material.io/foundations/desktop/components) · [W3C 按钮与展开模式](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)

## 修改

沿用现有主题变量、SVG 和交互入口，优先修改实际生效的布局规则。状态变更同步更新可访问名称和 `aria-expanded`。按项目工具约定更新变更的 JS、CSS 和 CSS 导入的版本参数。

## 复审

用相同的尺寸、页面和操作步骤重测，核对浏览器加载的资源版本。检查主控件能通过键盘操作，弹层在视口内，切换页面时导航偏好仍生效。对发生布局变化的截图做前后对照，再运行项目测试。复审发现的新问题回到审查阶段，补充复现证据后继续修正。

export const componentGovernanceGroups = Object.freeze([
  {
    id: "primitive",
    title: "Primitive",
    description: "稳定的基础交互原语",
    items: [
      { id: "button", name: "Button", summary: "承载明确命令和主要操作。", sourcePath: "desktop/src/components/ui/button.jsx", variants: ["default", "primary", "ghost", "subtle"], sizes: ["sm", "md", "icon"], states: ["default", "hover", "focus", "disabled"], usedBy: ["工作台", "任务执行", "项目概览"] },
      { id: "badge", name: "Badge", summary: "显示四种通用状态语义和中性元信息。", sourcePath: "desktop/src/components/ui/badge.jsx", variants: ["neutral", "info", "success", "warning", "danger"], sizes: ["default"], states: ["default"], usedBy: ["任务队列", "执行结果", "治理页面"] },
      { id: "input", name: "Input", summary: "单行文本输入与表单编辑。", sourcePath: "desktop/src/components/ui/input.jsx", variants: ["default"], sizes: ["default"], states: ["default", "focus", "disabled"], usedBy: ["对话输入", "模型连接"] },
      { id: "select", name: "Select", summary: "从稳定选项集中选择单值。", sourcePath: "desktop/src/components/ui/select.jsx", variants: ["default"], sizes: ["default"], states: ["default", "focus", "disabled"], usedBy: ["模型连接", "运行配置"] },
      { id: "tabs", name: "Tabs", summary: "在同一上下文中切换并列视图。", sourcePath: "desktop/src/components/ui/tabs.jsx", variants: ["default"], sizes: ["default"], states: ["default", "active", "focus"], usedBy: ["中心工作区", "任务详情"] },
      { id: "notice", name: "Notice", summary: "反馈信息、成功、警告与错误状态。", sourcePath: "desktop/src/components/ui/notice.jsx", variants: ["info", "success", "danger", "muted"], sizes: ["default"], states: ["default"], usedBy: ["全部工作面"] },
      { id: "switch", name: "Switch", summary: "即时切换单个二元设置。", sourcePath: "desktop/src/components/ui/switch.jsx", variants: ["off", "on"], sizes: ["default"], states: ["default", "focus", "disabled"], usedBy: ["Agent 配置", "系统设置"] },
    ],
  },
  {
    id: "pattern",
    title: "Pattern",
    description: "跨页面复用的结构与行为",
    items: [
      { id: "overview-page-header", name: "OverviewPageHeader", summary: "统一治理页面标题、说明、状态和动作。", sourcePath: "desktop/src/components/workbench/overview-section.jsx", variants: ["default", "with-actions"], sizes: ["responsive"], states: ["default"], usedBy: ["项目概览", "当前进度", "Token", "组件"] },
      { id: "overview-section", name: "OverviewSection", summary: "1 至 3 列的扁平治理分区。", sourcePath: "desktop/src/components/workbench/overview-section.jsx", variants: ["one-column", "two-column", "three-column"], sizes: ["responsive"], states: ["default", "actionable"], usedBy: ["项目概览", "当前进度"] },
      { id: "workspace-tree", name: "WorkspaceTree", summary: "呈现已登记路由和嵌套治理层级。", sourcePath: "desktop/src/components/workbench/workspace-tree.jsx", variants: ["expanded", "collapsed"], sizes: ["rail"], states: ["default", "active", "expanded"], usedBy: ["左侧项目导航"] },
      { id: "task-command-bar", name: "TaskCommandBar", summary: "集中任务上下文中的可执行命令。", sourcePath: "desktop/src/components/workbench/task-command-bar.jsx", variants: ["default"], sizes: ["responsive"], states: ["default", "disabled", "loading"], usedBy: ["当前任务", "Patch 草案", "执行结果"] },
    ],
  },
  {
    id: "composition",
    title: "Composition",
    description: "页面级组合，不下沉为基础组件",
    items: [
      { id: "project-overview-surface", name: "ProjectOverviewSurface", summary: "项目身份、组成和工程结构的唯一归属页。", sourcePath: "desktop/src/components/workbench/project-overview-renderer.jsx", variants: ["global", "project"], sizes: ["responsive"], states: ["loading", "ready", "stale", "error"], usedBy: ["项目概览"] },
      { id: "current-progress-surface", name: "CurrentProgressSurface", summary: "目标、完成度、任务与下一步的只读聚合。", sourcePath: "desktop/src/main.jsx", variants: ["default"], sizes: ["responsive"], states: ["ready", "empty"], usedBy: ["当前进度"] },
      { id: "task-surface", name: "TaskSurface", summary: "任务、草案、执行与结果的工作面组合。", sourcePath: "desktop/src/main.jsx", variants: ["active", "queue", "patch", "result"], sizes: ["responsive"], states: ["planned", "running", "done", "failed"], usedBy: ["任务执行"] },
    ],
  },
]);

export const tokenGovernanceGroups = Object.freeze([
  {
    id: "color",
    title: "颜色",
    description: "页面、文字、边框和状态语义",
    tokens: [
      { name: "--desktop-surface-canvas", usage: "中央工作画布", sample: "color" },
      { name: "--desktop-surface-panel", usage: "标准面板", sample: "color" },
      { name: "--desktop-text-primary", usage: "主要文字", sample: "color" },
      { name: "--desktop-text-secondary", usage: "辅助文字", sample: "color" },
      { name: "--desktop-border-default", usage: "默认边框", sample: "color" },
      { name: "--desktop-accent", usage: "主题强调", sample: "color" },
    ],
  },
  {
    id: "typography",
    title: "字体",
    description: "稳定字号与语义文字层级",
    tokens: [
      { name: "--desktop-type-display-size", usage: "页面展示标题", sample: "type" },
      { name: "--desktop-type-title-size", usage: "面板标题", sample: "type" },
      { name: "--desktop-type-body-size", usage: "正文", sample: "type" },
      { name: "--desktop-type-meta-size", usage: "元信息", sample: "type" },
      { name: "--mono", usage: "路径与代码", sample: "mono" },
    ],
  },
  {
    id: "spacing",
    title: "间距",
    description: "控件、面板和章节节奏",
    tokens: [
      { name: "--desktop-space-overview-section", usage: "治理页头部到分区、分区到分区", sample: "space" },
      { name: "--desktop-space-xs", usage: "紧凑间距", sample: "space" },
      { name: "--desktop-space-md", usage: "默认间距", sample: "space" },
      { name: "--desktop-space-lg", usage: "组间距", sample: "space" },
      { name: "--desktop-space-xl", usage: "面板间距", sample: "space" },
      { name: "--desktop-space-2xl", usage: "章节间距", sample: "space" },
    ],
  },
  {
    id: "radius",
    title: "圆角",
    description: "控件和工具容器轮廓",
    tokens: [
      { name: "--radius-xs", usage: "紧凑控件", sample: "radius" },
      { name: "--radius-sm", usage: "标准控件", sample: "radius" },
      { name: "--radius-md", usage: "工具面板", sample: "radius" },
    ],
  },
  {
    id: "state",
    title: "语义状态",
    description: "交互和功能反馈",
    tokens: [
      { name: "--desktop-state-hover-bg", usage: "悬停背景", sample: "color" },
      { name: "--desktop-state-selected-bg", usage: "选中背景", sample: "color" },
      { name: "--desktop-state-info-bg", usage: "信息背景", sample: "color" },
      { name: "--desktop-state-warning-bg", usage: "警告背景", sample: "color" },
      { name: "--desktop-state-danger-bg", usage: "错误背景", sample: "color" },
    ],
  },
]);

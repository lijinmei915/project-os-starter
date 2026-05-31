export type AssistantComponentName =
  | "ProductHeader"
  | "SegmentedSwitch"
  | "MetaPanel"
  | "SectionHeading"
  | "SectionBlock"
  | "DocumentGrid"
  | "OptionCard"
  | "ChecklistItem"
  | "AddItemCard"
  | "WritePlanPanel"
  | "TextField"
  | "Button";

export type AssistantCompositionName = "NewProjectWorkbench" | "OldProjectAuditWorkbench";

export type ComponentLayer = "Primitive" | "Pattern" | "Deprecated Pattern" | "Composition";

export type ProductHeaderVariant = "default" | "compact";
export type SegmentedSwitchVariant = "header-pill-tabs" | "two-options" | "multi-options";
export type MetaPanelVariant = "default" | "compact" | "inline" | "status-card";
export type SectionHeadingVariant = "numbered" | "numbered-with-description" | "plain";
export type SectionBlockVariant = "with-options" | "with-form" | "with-results";
export type DocumentGridVariant = "required" | "optional-grouped";
export type OptionCardVariant = "choice" | "strategy" | "source";
export type AddItemCardVariant = "document" | "upload" | "generic";
export type WritePlanPanelVariant = "directory-organize";
export type TextFieldVariant = "text" | "path" | "code";
export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ProductHeaderState = "default" | "truncated";
export type SegmentedSwitchState = "default" | "selected" | "hover" | "focus-visible" | "disabled";
export type MetaPanelState = "default" | "truncated" | "empty";
export type OptionCardState = "default" | "selected" | "hover" | "focus-visible" | "disabled";
export type ChecklistItemState =
  | "locked"
  | "optional-unchecked"
  | "optional-checked"
  | "pending"
  | "pass"
  | "warning"
  | "error"
  | "disabled";
export type AddItemCardState = "idle" | "copy" | "planned" | "hover" | "focus-visible" | "disabled";
export type WritePlanPanelState = "ready" | "writing" | "error" | "success";
export type TextFieldState = "default" | "readonly" | "selected" | "focus" | "invalid" | "disabled";
export type ButtonState = "default" | "copy" | "hover" | "focus-visible" | "loading" | "disabled";

export type OptionCardTone = "light" | "dark";
export type ChecklistItemType = "material" | "audit" | "gap";
export type IconSlot = "sparkle" | "plus" | "refresh" | "user" | "users" | "rocket" | "layers" | "shield" | "folder-search" | "check" | "warning" | "pulse" | "custom";

export interface AssistantComponentContract {
  name: AssistantComponentName;
  layer: Exclude<ComponentLayer, "Composition">;
  rootClassName: string;
  dataComponent: AssistantComponentName;
  variants?: readonly string[];
  states: readonly string[];
  slots?: readonly string[];
  aliases?: readonly string[];
  dataSource?: string;
  accessibility: readonly string[];
}

export interface AssistantCompositionContract {
  name: AssistantCompositionName;
  layer: "Composition";
  uses: readonly AssistantComponentName[];
  purpose: string;
}

export const assistantComponentContracts: AssistantComponentContract[] = [
  {
    name: "ProductHeader",
    layer: "Pattern",
    rootClassName: "kit-header",
    dataComponent: "ProductHeader",
    variants: ["default", "compact"],
    states: ["default", "truncated"],
    slots: ["brand", "title", "description", "primaryAction"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "Brand badge 不能替代页面 H1",
      "页面只能有一个主 H1",
      "装饰性图标必须 aria-hidden=true",
    ],
  },
  {
    name: "SegmentedSwitch",
    layer: "Primitive",
    rootClassName: "kit-switch",
    dataComponent: "SegmentedSwitch",
    variants: ["header-pill-tabs", "two-options", "multi-options"],
    states: ["default", "selected", "hover", "focus-visible", "disabled"],
    slots: ["option", "icon", "label"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "必须表达当前选中项",
      "Header 内使用 header-pill-tabs 变体，外层只允许轻量浅底和细边框",
      "必须使用 tab 语义：role=tablist、role=tab、aria-selected、aria-controls",
      "未选中 tab 也必须处于浅底胶囊热区内",
      "选中态不能改变按钮尺寸",
      "每个选项必须可键盘聚焦",
    ],
  },
  {
    name: "MetaPanel",
    layer: "Deprecated Pattern",
    rootClassName: "kit-meta",
    dataComponent: "MetaPanel",
    variants: ["default", "compact", "inline", "status-card"],
    states: ["default", "truncated", "empty"],
    slots: ["title", "generatedAt", "score"],
    accessibility: [
      "当前页面不在顶层 Header 使用 MetaPanel",
      "体检结果必须归入接手老项目右侧结果区",
      "报告状态必须说明生成时间和分数含义",
      "缺值时不能显示空白面板",
    ],
  },
  {
    name: "SectionHeading",
    layer: "Pattern",
    rootClassName: "kit-section-heading",
    dataComponent: "SectionHeading",
    variants: ["numbered", "numbered-with-description", "plain"],
    states: [],
    slots: ["title", "step", "label", "description"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "numbered 变体必须包含可读的步骤编号文本",
      "numbered-with-description 变体必须把说明文案放在标题下一行",
      "plain 变体不能伪造步骤编号",
    ],
  },
  {
    name: "SectionBlock",
    layer: "Pattern",
    rootClassName: "kit-section-block",
    dataComponent: "SectionBlock",
    variants: ["with-options", "with-form", "with-results"],
    states: [],
    slots: ["heading", "content"],
    dataSource: "docs/design/ai-project-assistant/components.ts",
    accessibility: [
      "必须包含一个 SectionHeading 和一个明确内容区",
      "标题到内容的距离固定使用 --component-section-content-gap",
      "内容区内部使用对应列表或控件组件的 gap token",
      "不能在标题、列表或表单上写 inline margin-top 来补间距",
    ],
  },
  {
    name: "DocumentGrid",
    layer: "Pattern",
    rootClassName: "kit-material-list",
    dataComponent: "DocumentGrid",
    variants: ["required", "optional-grouped"],
    states: [],
    slots: ["groupHeader", "documentCard"],
    aliases: ["kit-option-list"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "项目文档卡片必须自适应 3 / 2 / 1 列，不靠手写断点逐项控制",
      "分组标题必须跨整行，不能挤进文档卡片列",
      "文档路径过长时必须省略，不撑破卡片",
      "预览按钮必须使用图标库 eye 图标，不能使用 emoji",
      "预览按钮尺寸必须使用 --component-document-action-size，图标尺寸必须使用 --component-document-action-icon-size",
      "预览按钮圆角必须与 checkbox 一致，使用 --radius-xs",
      "预览按钮默认态只显示 eye 图标，不能有默认外框或底色；hover 才显示底色",
      "预览按钮必须位于文档卡右上角并有 aria-label",
    ],
  },
  {
    name: "OptionCard",
    layer: "Pattern",
    rootClassName: "kit-option-card",
    dataComponent: "OptionCard",
    variants: ["choice", "strategy"],
    states: ["default", "selected", "hover", "focus-visible", "disabled"],
    slots: ["icon", "title", "description", "trailing"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "选中态必须可被文本或状态属性识别",
      "hover 和 focus-visible 不能改变卡片尺寸",
      "深色 selected 只用于当前启动策略",
    ],
  },
  {
    name: "ChecklistItem",
    layer: "Pattern",
    rootClassName: "kit-checklist-item",
    dataComponent: "ChecklistItem",
    states: ["locked", "optional-unchecked", "optional-checked", "pending", "pass", "warning", "error", "disabled"],
    slots: ["leadingIcon", "title", "description", "trailingIcon"],
    aliases: ["RequiredMaterialItem"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "locked 状态必须设置 aria-disabled=true",
      "状态图标不能是唯一状态来源",
      "trailing 状态必须固定位置，不挤压正文",
    ],
  },
  {
    name: "AddItemCard",
    layer: "Pattern",
    rootClassName: "kit-add",
    dataComponent: "AddItemCard",
    variants: ["document", "upload", "generic"],
    states: ["idle", "copy", "planned", "hover", "focus-visible", "disabled"],
    slots: ["icon", "label", "status"],
    aliases: ["AddDocumentButton", "UploadDropZone"],
    accessibility: [
      "卡片式添加入口必须有明确 aria-label",
      "disabled 状态必须阻止点击并弱化 hover",
      "不能只用加号表达用途",
    ],
  },
  {
    name: "WritePlanPanel",
    layer: "Pattern",
    rootClassName: "kit-plan-card",
    dataComponent: "WritePlanPanel",
    variants: ["directory-organize"],
    states: ["ready", "writing", "error", "success"],
    slots: ["status", "summary", "similarMatches", "actions", "error"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "必须先展示整理方案，再允许写入项目",
      "同名文件必须说明不覆盖原文件",
      "相似命名必须允许用户确认合并来源",
      "错误必须显示在操作区附近",
    ],
  },
  {
    name: "TextField",
    layer: "Primitive",
    rootClassName: "kit-field",
    dataComponent: "TextField",
    variants: ["text", "path", "code"],
    states: ["default", "readonly", "selected", "focus", "invalid", "disabled"],
    slots: ["value", "trailingAction", "helperText", "errorText"],
    accessibility: [
      "路径和命令使用 mono 字体",
      "readonly 字段必须可复制",
      "本地目录选择必须有明确 aria-label",
      "invalid 状态必须有靠近控件的错误说明",
    ],
  },
  {
    name: "Button",
    layer: "Primitive",
    rootClassName: "kit-button",
    dataComponent: "Button",
    variants: ["primary", "secondary", "ghost"],
    states: ["default", "copy", "hover", "focus-visible", "loading", "disabled"],
    slots: ["icon", "label"],
    accessibility: [
      "按钮必须可键盘聚焦",
      "loading 状态必须保持按钮宽度",
      "主操作一次只出现一个最强视觉层级",
    ],
  },
];

export const assistantCompositionContracts: AssistantCompositionContract[] = [
  {
    name: "NewProjectWorkbench",
    layer: "Composition",
    purpose: "新项目初始化工作台",
    uses: ["ProductHeader", "SegmentedSwitch", "SectionHeading", "SectionBlock", "DocumentGrid", "OptionCard", "ChecklistItem", "AddItemCard", "WritePlanPanel", "Button"],
  },
  {
    name: "OldProjectAuditWorkbench",
    layer: "Composition",
    purpose: "老项目体检工作台",
    uses: ["ProductHeader", "SegmentedSwitch", "SectionHeading", "SectionBlock", "OptionCard", "TextField", "ChecklistItem", "AddItemCard", "Button"],
  },
];

export type AssistantComponentName =
  | "ProductHeader"
  | "SegmentedSwitch"
  | "MetaPanel"
  | "SectionHeading"
  | "OptionCard"
  | "ChecklistItem"
  | "AddItemCard"
  | "TextField"
  | "Button";

export type AssistantCompositionName = "NewProjectWorkbench" | "OldProjectAuditWorkbench";

export type ComponentLayer = "Primitive" | "Pattern" | "Composition";

export type ProductHeaderVariant = "default" | "compact";
export type SegmentedSwitchVariant = "two-options" | "multi-options";
export type MetaPanelVariant = "default" | "compact" | "inline" | "status-card";
export type SectionHeadingVariant = "numbered" | "numbered-with-description" | "plain";
export type OptionCardVariant = "choice" | "strategy" | "source";
export type AddItemCardVariant = "document" | "upload" | "generic";
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
export type AddItemCardState = "idle" | "planned" | "hover" | "focus-visible" | "disabled";
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
    slots: ["brand", "title", "description"],
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
    variants: ["two-options", "multi-options"],
    states: ["default", "selected", "hover", "focus-visible", "disabled"],
    slots: ["option", "icon", "label"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
      "必须表达当前选中项",
      "选中滑块不能改变按钮尺寸",
      "每个选项必须可键盘聚焦",
    ],
  },
  {
    name: "MetaPanel",
    layer: "Pattern",
    rootClassName: "kit-meta",
    dataComponent: "MetaPanel",
    variants: ["default", "compact", "inline", "status-card"],
    states: ["default", "truncated", "empty"],
    slots: ["title", "generatedAt", "score"],
    dataSource: "docs/design/ai-project-assistant/data.ts",
    accessibility: [
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
    states: ["idle", "planned", "hover", "focus-visible", "disabled"],
    slots: ["icon", "label", "status"],
    aliases: ["AddDocumentButton", "UploadDropZone"],
    accessibility: [
      "卡片式添加入口必须有明确 aria-label",
      "disabled 状态必须阻止点击并弱化 hover",
      "不能只用加号表达用途",
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
    uses: ["ProductHeader", "SegmentedSwitch", "SectionHeading", "OptionCard", "ChecklistItem", "AddItemCard"],
  },
  {
    name: "OldProjectAuditWorkbench",
    layer: "Composition",
    purpose: "老项目体检工作台",
    uses: ["ProductHeader", "SegmentedSwitch", "SectionHeading", "OptionCard", "TextField", "ChecklistItem", "AddItemCard", "Button"],
  },
];

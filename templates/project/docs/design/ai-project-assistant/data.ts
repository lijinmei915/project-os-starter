export type ProjectKind = "new" | "old";
export type CollaborationMode = "solo" | "team";
export type StartStrategyId = "prototype" | "serious" | "handover";
export type SectionHeadingVariant = "numbered" | "numbered-with-description" | "plain";
export type OptionCardTone = "light" | "dark";
export type OptionCardState = "default" | "selected" | "disabled";
export type ChecklistItemType = "material" | "audit" | "gap";
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
export type TextFieldState = "default" | "readonly" | "selected" | "focus" | "invalid" | "disabled";
export type ButtonState = "default" | "copy" | "hover" | "focus-visible" | "loading" | "disabled";
export type IconName = "sparkle" | "plus" | "refresh" | "user" | "users" | "rocket" | "layers" | "shield" | "folder-search" | "check" | "warning" | "pulse";

export interface ProductHeaderData {
  eyebrow: string;
  title: string;
  description: string;
  icon: IconName;
}

export interface SegmentedSwitchOption {
  id: ProjectKind;
  label: string;
  icon: IconName;
}

export interface MetaPanelItem {
  label: string;
  value: string;
  truncate?: boolean;
}

export interface SectionHeading {
  id: string;
  title: string;
  variant: SectionHeadingVariant;
  step?: number;
  description?: string;
}

export interface OptionCard {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  variant: "choice" | "strategy" | "source";
  tone: OptionCardTone;
  state: OptionCardState;
  trailing?: "check" | "none";
}

export interface ChecklistItem {
  id: string;
  type: ChecklistItemType;
  title: string;
  description: string;
  file?: string;
  icon: IconName;
  state: ChecklistItemState;
  trailing?: "check" | "warning" | "none";
}

export interface TextFieldData {
  id: string;
  variant: "text" | "path" | "code";
  value: string;
  state: TextFieldState;
  trailingAction?: "directoryPicker" | "none";
}

export interface ButtonData {
  id: string;
  label: string;
  icon?: IconName;
  variant: "primary" | "secondary" | "ghost";
  state: ButtonState;
}

export const productHeader: ProductHeaderData = {
  eyebrow: "AI ENGINEERING KIT",
  title: "AI 项目工程助手",
  description: "选择新项目走初始化向导，老项目看体检报告。",
  icon: "sparkle",
};

export const projectModeOptions: SegmentedSwitchOption[] = [
  {
    id: "new",
    label: "创建新项目",
    icon: "plus",
  },
  {
    id: "old",
    label: "接手老项目",
    icon: "refresh",
  },
];

export const reportMetaItems: MetaPanelItem[] = [
  {
    label: "生成时间",
    value: "2026-05-20T08:00:08Z",
  },
  {
    label: "上下文完整度",
    value: "100/100",
  },
  {
    label: "工程成熟度",
    value: "100/100",
  },
];

export const sectionHeadings: SectionHeading[] = [
  {
    id: "new-collaboration",
    title: "协作模式",
    variant: "numbered",
    step: 1,
  },
  {
    id: "new-start-strategy",
    title: "启动策略",
    variant: "numbered",
    step: 2,
  },
  {
    id: "new-required-materials",
    title: "基础上下文资料",
    variant: "numbered-with-description",
    step: 3,
    description: "已自动勾选 AI 接手所需的最小数据集",
  },
  {
    id: "new-custom-enhancement",
    title: "自定义增强",
    variant: "plain",
    description: "按需补充其他项目文档",
  },
  {
    id: "old-code-source",
    title: "代码来源",
    variant: "numbered-with-description",
    step: 1,
    description: "输入老项目代码，生成 AI 可读的接手报告。",
  },
  {
    id: "old-source-config",
    title: "当前工作目录",
    variant: "numbered-with-description",
    step: 2,
    description: "将在下方路径执行代码体检",
  },
  {
    id: "old-checkup-items",
    title: "体检将包含以下内容",
    variant: "numbered-with-description",
    step: 3,
    description: "完成后自动生成《AI 接手指南》",
  },
];

export const collaborationOptions: OptionCard[] = [
  {
    id: "solo",
    title: "个人开发",
    description: "AI 提供敏捷上下文，重视开发速度与灵活性。",
    icon: "user",
    variant: "choice",
    tone: "light",
    state: "selected",
    trailing: "check",
  },
  {
    id: "team",
    title: "团队协作",
    description: "补齐协作规则、决策记录和交接资料，避免项目越做越散。",
    icon: "users",
    variant: "choice",
    tone: "light",
    state: "default",
    trailing: "check",
  },
];

export const startStrategies: OptionCard[] = [
  {
    id: "prototype",
    title: "快速做个原型",
    description: "先让 AI 做出能看的页面或功能，再慢慢补规范。",
    icon: "rocket",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "serious",
    title: "认真建一个项目",
    description: "适合产品、工具、长期维护项目，先把项目基础搭稳。",
    icon: "layers",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "handover",
    title: "只想让 AI 更好接手",
    description: "适合先整理规则、状态和交接，不急着写业务代码。",
    icon: "shield",
    variant: "strategy",
    tone: "dark",
    state: "selected",
    trailing: "check",
  },
];

export const requiredMaterialsByCollaborationMode: Record<CollaborationMode, ChecklistItem[]> = {
  solo: [
    {
      id: "project-brief",
      type: "material",
      title: "项目说明",
      description: "这个项目是什么，给谁用，目标是什么",
      file: "PROJECT.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
    {
      id: "agent-rules",
      type: "material",
      title: "AI 工作规则",
      description: "AI 该怎么做，哪些事不要乱改",
      file: "AGENTS.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
    {
      id: "project-status",
      type: "material",
      title: "当前状态",
      description: "现在做到哪一步，还缺什么",
      file: "HANDOFF.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
  ],
  team: [
    {
      id: "project-brief",
      type: "material",
      title: "项目说明",
      description: "这个项目是什么，给谁用，目标是什么",
      file: "PROJECT.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
    {
      id: "team-rules",
      type: "material",
      title: "团队工作规则",
      description: "组件规范、禁止魔数、样式统一",
      file: "AGENTS.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
    {
      id: "architecture-rules",
      type: "material",
      title: "架构与约定",
      description: "目录结构、状态管理和路由规则",
      file: "docs/ARCHITECTURE.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
    {
      id: "project-status",
      type: "material",
      title: "当前状态",
      description: "现在做到哪一步，还缺什么",
      file: "PROJECT.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
    {
      id: "handoff-record",
      type: "material",
      title: "交接记录",
      description: "下一个队友或 AI 接手时需要的信息",
      file: "HANDOFF.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
  ],
};

export const auditChecklistItems: ChecklistItem[] = [
  {
    id: "structure-audit",
    type: "audit",
    title: "工程结构梳理",
    description: "发现隐式约定，找出缺失的架构图和文档",
    icon: "folder-search",
    state: "pending",
    trailing: "check",
  },
  {
    id: "ai-context-audit",
    type: "audit",
    title: "AI 上下文检查",
    description: "检查规则、状态、测试和交接是否足够清楚",
    icon: "shield",
    state: "pending",
    trailing: "check",
  },
];

export const currentProjectPathField: TextFieldData = {
  id: "current-project-path",
  variant: "path",
  value: "/Users/heqiao/Desktop/Claude练习/project-starter-pack",
  state: "readonly",
  trailingAction: "directoryPicker",
};

export const startAuditButton: ButtonData = {
  id: "start-audit",
  label: "复制体检命令",
  icon: "pulse",
  variant: "primary",
  state: "copy",
};

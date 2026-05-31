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

export const sectionHeadings: SectionHeading[] = [
  {
    id: "new-template-wizard",
    title: "模板选择向导",
    variant: "numbered-with-description",
    step: 1,
    description: "先回答 3 个问题，帮你自动勾选需要的项目文档和 AI 规则文件。",
  },
  {
    id: "new-template-preview",
    title: "将生成这些项目文档",
    variant: "numbered-with-description",
    step: 2,
    description: "先看预览；选择目录后生成写入前安全方案，确认后再生成骨架或下载 zip。",
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
    title: "我一个人",
    description: "先保持轻量，别被文档拖慢。",
    icon: "user",
    variant: "choice",
    tone: "light",
    state: "selected",
    trailing: "check",
  },
  {
    id: "team",
    title: "有团队一起做",
    description: "需要规则、决策记录和交接资料。",
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
    title: "快速做出原型",
    description: "先跑通核心功能，少放长期治理文档。",
    icon: "rocket",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "serious",
    title: "搭长期项目基础",
    description: "先把结构、规范和交接打稳。",
    icon: "layers",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "handover",
    title: "先让 AI 更好接手",
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

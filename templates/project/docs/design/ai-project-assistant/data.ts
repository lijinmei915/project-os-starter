export type ProjectKind = "new" | "old";
export type CollaborationMode = "solo" | "team";
export type OutcomeId = "product" | "page" | "run" | "handoff" | "ai" | "rag";
export type ContractLayerId = "entry" | "run" | "structure" | "quality" | "runtime";
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

export interface ContractRecommendationData {
  title: string;
  description: string;
}

export interface ContractLayerData {
  id: ContractLayerId;
  title: string;
  description: string;
  meter: string;
}

export interface NextCommandData {
  title: string;
  description: string;
  command: string;
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
    description: "先回答 2 个问题，帮你生成一套可理解、可运行、可检查的工程契约。",
  },
  {
    id: "new-template-preview",
    title: "生成工程契约",
    variant: "numbered-with-description",
    step: 2,
    description: "结果会按 5 层组织，让项目从说明文档升级成可落地的工程契约。",
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
    icon: "layers",
    variant: "choice",
    tone: "light",
    state: "default",
    trailing: "check",
  },
];

export const outcomeOptions: OptionCard[] = [
  {
    id: "product",
    title: "看清方向",
    description: "定位、用户、MVP 和路线图。",
    icon: "rocket",
    variant: "strategy",
    tone: "light",
    state: "selected",
    trailing: "none",
  },
  {
    id: "page",
    title: "先有页面",
    description: "页面原型、设计规范和视觉边界。",
    icon: "layers",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "run",
    title: "能运行起来",
    description: "环境、启动方式、目录和模块边界。",
    icon: "shield",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "handoff",
    title: "方便测试和交接",
    description: "验收方式、运行手册和经验教训。",
    icon: "users",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "ai",
    title: "AI 工程支持",
    description: "agents、tools、prompts、evals 和 guardrails。",
    icon: "shield",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
  {
    id: "rag",
    title: "知识库 / RAG",
    description: "data、ingestion、retrieval、evals 和 observability。",
    icon: "layers",
    variant: "strategy",
    tone: "light",
    state: "default",
    trailing: "none",
  },
];

export const requiredMaterialsByCollaborationMode: Record<CollaborationMode, ChecklistItem[]> = {
  solo: [
    {
      id: "readme",
      type: "material",
      title: "使用入口",
      description: "项目是什么、怎么开始、先看哪里",
      file: "README.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
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
      id: "readme",
      type: "material",
      title: "使用入口",
      description: "项目是什么、怎么开始、先看哪里",
      file: "README.md",
      icon: "check",
      state: "locked",
      trailing: "none",
    },
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

export const contractRecommendationSample: ContractRecommendationData = {
  title: "推荐：轻量工程契约",
  description: "当前会按「页面原型 / 快速原型」准备页面原型骨架，并优先补齐项目入口和产品方向。",
};

export const contractLayers: ContractLayerData[] = [
  {
    id: "entry",
    title: "项目入口",
    description: "让人和 AI 先知道这是什么、怎么开始；这些文件会作为项目入口生成，可在下方调整推荐项。",
    meter: "4/6",
  },
  {
    id: "run",
    title: "工程运行",
    description: "让项目能安装、启动、配置和复现；这里放技术栈、环境变量、命名和文档更新规则。",
    meter: "0/5",
  },
  {
    id: "structure",
    title: "代码结构",
    description: "本次先准备当前项目类型的位置；具体会生成的目录在底部文件树里确认。",
    meter: "1/3",
  },
  {
    id: "quality",
    title: "质量保障层",
    description: "让项目能测试、回归、交接；命中后端或 AI 风险时补安全边界。",
    meter: "0/5",
  },
  {
    id: "runtime",
    title: "AI 支持文件",
    description: "让提示词、评测和安全边界有固定位置；轻量项目只放提示词示例。",
    meter: "自动包含",
  },
];

export const contractPreviewSample = {
  tree: [
    "README.md",
    "PROJECT.md",
    "AGENTS.md",
    "HANDOFF.md",
    "docs/",
    "  ENVIRONMENT.md",
    "  SECURITY.md",
    "  AI_SAFETY.md",
    "  TECH_STACK.md",
    "  TESTING.md",
    "prompts/",
    "evals/",
  ],
  nextCommand: {
    title: "生成后第一步",
    description: "先检查 Project OS 入口、规则、环境、安全边界和 AI 支持文件是否完整。",
    command: "bash scripts/check-runtime.sh .\nbash scripts/check-secrets.sh .",
  } satisfies NextCommandData,
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

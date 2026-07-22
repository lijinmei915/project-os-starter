import { requireWorkspaceRoute } from "./workspace-route-registry.js";

const governanceMeta = {
  "工作台": {
    files: ["PROJECT.md", "HANDOFF.md", "docs/RUNBOOK.md", ".omnidesk/data/state.json"],
    governanceRole: "工作台总览入口，回答当前项目状态、进度、启动方式、风险和本地接入状态。",
    maturity: "状态化",
    nextAction: "把工作台总览继续接到真实扫描、运行命令和风险任务生成。",
    statusSource: ".omnidesk/data/state.json",
    updatesWhen: "项目接入、当前进度、启动方式、风险或本地状态变化时更新。",
  },
  "认识项目": {
    files: ["PROJECT.md", ".omnidesk/data/state.json", "README.md", "HANDOFF.md"],
    governanceRole: "项目事实入口，回答这个项目是什么、到哪一步、当前风险是什么。",
    maturity: "状态化",
    nextAction: "继续把工作区事实自动生成接到真实项目扫描。",
    statusSource: ".omnidesk/data/state.json",
    updatesWhen: "接入项目、项目阶段变化、启动方式变化或风险变化时更新。",
  },
  "定义目标": {
    files: ["docs/PRODUCT_PLAN.md", "PROJECT.md", "HANDOFF.md"],
    governanceRole: "目标治理入口，负责范围、验收标准和目标历史。",
    maturity: "状态化",
    nextAction: "把目标拆解草案和确认拆解接到任务队列。",
    statusSource: "PROJECT.md",
    updatesWhen: "目标、用户、场景、范围或成功标准变化时更新。",
  },
  "工作规则": {
    files: ["AGENTS.md", "docs/DOCUMENTATION.md", "docs/NAMING.md"],
    governanceRole: "协作治理入口，约束 AI 行为、权限、文档归属和路由。",
    maturity: "闭环",
    nextAction: "规则变化时同步模板并跑对应治理检查。",
    statusSource: "AGENTS.md",
    updatesWhen: "AI 行为边界、路由、权限或文档归属规则变化时更新。",
  },
  "设计实现": {
    files: ["docs/ARCHITECTURE.md", "docs/DESIGN_STANDARDS.md", "desktop/src/*"],
    governanceRole: "方案治理入口，把架构、契约、界面规范和实现结构连接到代码。",
    maturity: "只读",
    nextAction: "补设计实现健康状态，并能从架构/契约/规范缺口生成治理任务。",
    statusSource: "docs/ARCHITECTURE.md",
    updatesWhen: "架构、数据模型、界面规范或代码结构变化时更新。",
  },
  "验证交付": {
    files: ["docs/TESTING.md", "docs/RUNBOOK.md", "scripts/*", ".omnidesk/evidence/runs/*"],
    governanceRole: "质量治理入口，负责检查项、验收证据和运行记录。",
    maturity: "状态化",
    nextAction: "把失败验收直接转成修复任务，并沉淀验证证据。",
    statusSource: ".omnidesk/evidence/runs/*",
    updatesWhen: "检查命令、验收标准、交付产物或质量记录变化时更新。",
  },
  "复盘沉淀": {
    files: ["HANDOFF.md", "docs/LESSONS.md", "docs/DECISIONS.md", "docs/CHANGELOG.md"],
    governanceRole: "经验治理入口，把交接、决策、教训和变更历史沉淀下来。",
    maturity: "状态化",
    nextAction: "把复盘内容结构化，区分当前交接和长期记忆。",
    statusSource: "HANDOFF.md",
    updatesWhen: "交接、经验、决策或长期记忆变化时更新。",
  },
};

const itemMeta = {
  "项目概览": { statusSource: ".omnidesk/data/state.json" },
  "当前进度": { statusSource: "HANDOFF.md" },
  "启动方式": {
    statusSource: "docs/RUNBOOK.md",
    maturity: "可验证",
    governanceRole: "本地运行入口，回答怎么启动、怎么构建、怎么检查和从哪里看运行说明。",
    nextAction: "把启动命令、构建命令和检查命令做成可读命令面板，避免停留在文档说明。",
  },
  "风险边界": { statusSource: "HANDOFF.md" },
  "项目接入": { statusSource: ".omnidesk/data/state.json" },
  "当前阶段目标": { statusSource: ".omnidesk/data/goals.json" },
  "验收标准": { statusSource: ".omnidesk/data/goal-validation.json" },
  "目标历史": { statusSource: ".omnidesk/data/goals.json" },
  "协作边界": { statusSource: "AGENTS.md" },
  "执行权限": { statusSource: "AGENTS.md" },
  "文档规则": { statusSource: "docs/DOCUMENTATION.md" },
  "系统架构": { statusSource: "docs/ARCHITECTURE.md" },
  "数据契约": { statusSource: "schemas/*" },
  "界面规范": { statusSource: "docs/DESIGN_STANDARDS.md" },
  "Token": { statusSource: "docs/design/tokens.md" },
  "组件": { statusSource: "docs/design/component-index.md" },
  "实现结构": { statusSource: "docs/ARCHITECTURE.md" },
  "检查项": { statusSource: "docs/TESTING.md" },
  "验收报告": {
    statusSource: ".omnidesk/evidence/goal-validation-report.json",
    maturity: "状态化",
    governanceRole: "目标验收结果入口，回答最近一次验收是否通过、哪些检查失败、下一步怎么处理。",
    nextAction: "把验收结果、检查项和失败修复入口展示成证据工作面。",
  },
  "运行记录": { statusSource: ".omnidesk/evidence/runs/*" },
  "交接记录": { statusSource: "HANDOFF.md" },
  "决策记录": { statusSource: "docs/DECISIONS.md" },
  "经验教训": { statusSource: "docs/LESSONS.md" },
  "项目事实": { statusSource: ".omnidesk/cache/workspace-facts.json" },
  "用户偏好": { statusSource: "OmniDesk global: user-profile.json" },
  "长期记忆": { statusSource: ".omnidesk/data/memory/*" },
  "会话摘要": { statusSource: ".omnidesk/data/conversations/*" },
  "当前任务": { statusSource: ".omnidesk/data/tasks/*" },
  "任务队列": { statusSource: ".omnidesk/data/tasks/*" },
  "执行终端": { statusSource: ".omnidesk/evidence/runs/*" },
  "执行结果": { statusSource: ".omnidesk/evidence/desktop-summary.md" },
  "工程文件": { statusSource: "project tree" },
  "治理文件": { statusSource: ".omnidesk/cache/workspace-facts.json" },
  "执行证据": {
    statusSource: ".omnidesk/evidence/runs/*",
    maturity: "状态化",
    governanceRole: "任务执行与验收证据入口，展示已审批的写入、检查、修复与最终结果。",
    nextAction: "让每份执行证据都能回到所属任务和下一步动作，避免脱离上下文的报告页面。",
  },
  "Schema": { statusSource: "schemas/*" },
  "脚本模板": { statusSource: "scripts/*" },
  "模型连接": { statusSource: ".omnidesk/data/desktop-provider.json" },
  "工具白名单": { statusSource: "desktop/src-tauri/src/main.rs" },
  "安全边界": { statusSource: "docs/AI_SAFETY.md" },
};

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function enrichItem(item, parentId) {
  const meta = itemMeta[item.title] || {};
  const id = item.id || meta.id || `${parentId}-${slug(item.title)}`;
  const route = requireWorkspaceRoute(id);
  return {
    ...item,
    ...meta,
    id,
    route,
    routeId: route.id,
    routePath: route.path,
    surface: route.surface,
    files: item.relatedFiles || item.files || [],
    governanceRole: item.governanceRole || meta.governanceRole || `${item.title} 的专属治理工作面，承载对应状态、证据和后续动作。`,
    maturity: item.maturity || meta.maturity || "只读",
    nextAction: item.nextAction || meta.nextAction || "后续接入状态判断和任务生成，避免停留在静态查看。",
    updatesWhen: item.updatesWhen || meta.updatesWhen || "用户提到相关事实变化，或关联文件内容变化时更新。",
  };
}

function enrichNode(node, parentId = "") {
  const meta = governanceMeta[node.title] || {};
  const id = node.id || meta.id || [parentId, slug(node.title)].filter(Boolean).join("-");
  const route = requireWorkspaceRoute(id);
  return {
    ...node,
    ...meta,
    id,
    route,
    routeId: route.id,
    routePath: route.path,
    surface: route.surface,
    children: (node.children || []).map((child) => enrichNode(child, id)),
    items: (node.items || []).map((item) => item.items?.length ? enrichNode(item, id) : enrichItem(item, id)),
    governanceRole: node.governanceRole || meta.governanceRole || `${node.title} 的治理域。`,
    maturity: node.maturity || meta.maturity || "只读",
    nextAction: node.nextAction || meta.nextAction || "补齐状态源、操作入口和闭环验证。",
    mapKind: node.mapKind || "project-governance",
  };
}

const capabilityByTitle = {
  "项目": "project-overview",
  "目标": "goals",
  "工作规则": "rules",
  "设计实现": "design-implementation",
  "验证交付": "validation-delivery",
  "复盘沉淀": "knowledge-memory",
};

const visibleCapabilityStatuses = new Set(["enabled"]);

export function workspaceOutlineForCapabilities(outline, projectCapabilities) {
  const capabilities = projectCapabilities?.workspaceCapabilities || projectCapabilities?.capabilities || [];
  if (!capabilities.length) return outline;

  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]));
  const isVisible = (capabilityId) => !capabilityId || visibleCapabilityStatuses.has(capabilityById.get(capabilityId)?.status);
  const filterModules = (node) => {
    const capability = capabilityById.get(node.capabilityId);
    if (!Array.isArray(capability?.modules) || !capability.modules.length) return node;
    const enabledModules = new Set(capability.modules.filter((module) => module.status === "enabled").map((module) => module.id));
    const filterItem = (item) => {
      if (!enabledModules.has(item.id)) return null;
      if (!item.items?.length) return item;
      return { ...item, items: item.items };
    };
    return { ...node, items: (node.items || []).map(filterItem).filter(Boolean) };
  };

  return outline.flatMap((node) => {
    if (!isVisible(node.capabilityId)) return [];
    const children = (node.children || []).filter((child) => isVisible(child.capabilityId)).map(filterModules).filter((child) => !Array.isArray(child.items) || child.items.length > 0);
    if (node.children?.length && !children.length) return [];
    return [{ ...node, children }];
  });
}

export const projectGovernanceFlow = [
  {
    id: "understand-project",
    title: "项目",
    meta: "当前",
    icon: "book",
    description: "项目基本状态。",
    items: [
      { id: "project-identity", title: "项目概览", description: "名称、用途和阶段。", relatedFiles: ["PROJECT.md", ".omnidesk/data/state.json"] },
      { id: "project-progress", title: "项目进展", description: "项目到哪一步，以及唯一下一步。", relatedFiles: ["PROJECT.md", "HANDOFF.md"] },
      { id: "project-runbook", title: "启动方式", description: "启动入口与运行环境。", relatedFiles: ["README.md", "desktop/package.json", "docs/RUNBOOK.md", "docs/ARCHITECTURE.md"] },
      { id: "project-risks", title: "风险边界", description: "已知风险和边界。", relatedFiles: ["HANDOFF.md", "docs/LESSONS.md"] },
      { id: "local-project-state", title: "项目接入", description: "接入登记和治理准备。", relatedFiles: [".omnidesk/data/state.json", ".omnidesk/data/desktop-registry.json"] },
    ],
  },
  {
    id: "define-goal",
    title: "目标",
    meta: "路线",
    icon: "clipboard",
    description: "当前目标、验收标准和目标历史。",
    items: [
      { id: "current-goal", title: "当前阶段目标", description: "项目目标下正在推进的阶段目标和范围。", relatedFiles: [".omnidesk/data/goals.json", "PROJECT.md", "HANDOFF.md"] },
      { id: "acceptance-criteria", title: "验收标准", description: "完成判断和检查条件。", relatedFiles: [".omnidesk/data/goal-validation.json", "docs/TESTING.md"] },
      { id: "goal-history", title: "目标历史", description: "已完成、待确认和历史目标。", relatedFiles: [".omnidesk/data/goals.json", ".omnidesk/data/goal-signoff-history.json"] },
    ],
  },
  {
    id: "work-rules",
    title: "工作规则",
    meta: "规则",
    icon: "shield",
    description: "协作方式和权限。",
    items: [
      { id: "collaboration-boundary", title: "协作边界", description: "AI 和用户如何分工。", relatedFiles: ["AGENTS.md"] },
      { id: "execution-permissions", title: "执行权限", description: "自动和确认边界。", relatedFiles: ["AGENTS.md"] },
      { id: "documentation-rules", title: "文档规则", description: "信息归属位置。", relatedFiles: ["docs/DOCUMENTATION.md", "docs/NAMING.md"] },
    ],
  },
  {
    id: "design-implementation",
    title: "设计实现",
    meta: "方案",
    icon: "wrench",
    description: "方案、架构和实现结构。",
    items: [
      { id: "system-architecture", title: "系统架构", description: "模块和依赖关系。", relatedFiles: ["docs/ARCHITECTURE.md"] },
      { id: "data-contracts", title: "数据契约", description: "对象、状态和结构化契约。", relatedFiles: ["schemas/*", "docs/data/*"] },
      {
        id: "ui-standards",
        title: "界面规范",
        meta: "规范",
        icon: "package",
        description: "可视化管理设计 Token 和组件。",
        items: [
          { id: "design-tokens", title: "Token", description: "颜色、字体、间距、圆角和语义状态。", relatedFiles: ["docs/design/tokens.md", "desktop/src/styles.css"] },
          { id: "component-library", title: "组件", description: "真实组件、组合模式、状态和源码位置。", relatedFiles: ["docs/design/component-index.md", "desktop/src/components/*"] },
        ],
      },
      { id: "code-structure", title: "实现结构", description: "目录和模块职责。", relatedFiles: ["docs/ARCHITECTURE.md", "desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"] },
    ],
  },
  {
    id: "validate-delivery",
    title: "验证交付",
    meta: "检查",
    icon: "check",
    description: "验收、测试和交付结果。",
    items: [
      { id: "validation-checks", title: "检查项", description: "当前项目可运行的检查。", relatedFiles: ["docs/TESTING.md", "desktop/package.json", "desktop/src-tauri/Cargo.toml"] },
      { id: "validation-report", title: "验收报告", description: "目标验收和检查结果。", relatedFiles: [".omnidesk/evidence/goal-validation-report.json"] },
      { id: "run-records", title: "运行记录", description: "检查、扫描和执行历史。", relatedFiles: [".omnidesk/evidence/runs/*", ".omnidesk/evidence/desktop-summary.md"] },
    ],
  },
  {
    id: "retrospective-memory",
    title: "复盘沉淀",
    meta: "记忆",
    icon: "brain",
    description: "经验和下一步。",
    items: [
      { id: "handoff-records", title: "交接记录", description: "继续工作上下文。", relatedFiles: ["HANDOFF.md"] },
      { id: "decision-records", title: "决策记录", description: "重要取舍记录。", relatedFiles: ["docs/DECISIONS.md", "docs/CHANGELOG.md"] },
      { id: "lessons-learned", title: "经验教训", description: "踩坑、修正和新增约束。", relatedFiles: ["docs/LESSONS.md"] },
    ],
  },
];

export const projectGovernanceOutline = [
  {
    id: "workbench-overview",
    title: "工作台",
    meta: "总览",
    icon: "book",
    description: "项目工作台的总览入口。",
  },
  {
    id: "project-governance",
    title: "项目流程",
    meta: "流程",
    icon: "clipboard",
    description: "从理解到复盘的项目阶段。",
    children: projectGovernanceFlow.map((node) => ({
      ...enrichNode(node, "project-governance"),
      capabilityId: capabilityByTitle[node.title],
    })),
  },
  {
    id: "task-execution",
    capabilityId: "tasks",
    title: "目标与任务",
    meta: "执行",
    icon: "terminal",
    description: "当前目标、验收标准、目标历史和关联任务。",
    children: [
      {
        id: "task-list-menu",
        title: "目标与任务",
        meta: "执行",
        icon: "clipboard",
        description: "在同一页面查看目标信息并推进关联任务。",
        items: [
          { id: "task-list", title: "目标与任务", description: "查看目标、验收、历史和关联任务。", relatedFiles: [".omnidesk/data/goals.json", ".omnidesk/data/goal-validation.json", ".omnidesk/data/tasks/*", ".omnidesk/data/task-backlog.json"] },
        ],
      },
      {
        id: "task-terminal-menu",
        title: "执行终端",
        meta: "终端",
        icon: "terminal",
        description: "命令执行入口。",
        items: [
          { id: "execution-terminal", title: "执行终端", description: "本地命令、检查和输出。", relatedFiles: [".omnidesk/evidence/runs/*"] },
        ],
      },
      {
        id: "task-results-menu",
        title: "执行结果",
        meta: "结果",
        icon: "check",
        description: "任务结果和验证摘要。",
        items: [
          { id: "execution-results", title: "执行结果", description: "执行摘要、变更和验证结果。", relatedFiles: [".omnidesk/evidence/desktop-summary.md", "HANDOFF.md"] },
        ],
      },
    ],
  },
  {
    id: "memory",
    capabilityId: "knowledge-memory",
    title: "知识记忆",
    meta: "上下文",
    icon: "brain",
    description: "项目事实、用户偏好、长期记忆和会话摘要。",
    children: [
      {
        id: "memory-facts-menu",
        title: "项目事实",
        meta: "事实",
        icon: "book",
        description: "项目长期事实。",
        items: [
          { id: "project-facts", title: "项目事实", description: "项目身份、阶段、事实来源和可信度。", relatedFiles: [".omnidesk/cache/workspace-facts.json", ".omnidesk/data/state.json", "PROJECT.md"] },
        ],
      },
      {
        id: "memory-preferences-menu",
        title: "用户偏好",
        meta: "偏好",
        icon: "brain",
        description: "长期工作偏好。",
        items: [
          { id: "user-preferences", title: "用户偏好", description: "用户画像、沟通方式和全局偏好。", relatedFiles: ["OmniDesk global: user-profile.json", "OmniDesk global: global-preferences.json"] },
        ],
      },
      {
        id: "memory-long-term-menu",
        title: "长期记忆",
        meta: "记忆",
        icon: "brain",
        description: "可跨会话复用的记忆。",
        items: [
          { id: "long-term-memory", title: "长期记忆", description: "沉淀后的长期上下文。", relatedFiles: [".omnidesk/data/memory/*", "docs/data/knowledge-registry.json"] },
        ],
      },
      {
        id: "memory-conversations-menu",
        title: "会话摘要",
        meta: "会话",
        icon: "book",
        description: "对话摘要和可沉淀内容。",
        items: [
          { id: "conversation-summary", title: "会话摘要", description: "历史对话和摘要。", relatedFiles: [".omnidesk/data/conversations/*"] },
        ],
      },
    ],
  },
  {
    id: "engineering-assets",
    capabilityId: "files",
    title: "项目资源",
    meta: "按需",
    icon: "files",
    defaultOpen: false,
    description: "代码、项目规则和执行证据等由任务或对话按需引用的项目来源。",
    children: [
      {
        id: "assets-files-menu",
        title: "代码与配置",
        meta: "代码",
        icon: "files",
        description: "源码、配置和工程入口。",
        items: [
          { id: "engineering-files", title: "代码与配置", description: "源码、配置和工程入口。", relatedFiles: ["desktop/*", "package.json"] },
        ],
      },
      {
        id: "assets-governance-menu",
        title: "项目规则",
        meta: "规则",
        icon: "book",
        description: "项目状态、协作规则和交接。",
        items: [
          { id: "governance-files", title: "项目规则", description: "项目规则、状态、交接和运行说明。", relatedFiles: ["PROJECT.md", "HANDOFF.md", "AGENTS.md", "docs/*"] },
        ],
      },
      {
        id: "assets-reports-menu",
        title: "执行证据",
        meta: "证据",
        icon: "clipboard",
        description: "检查、验收和任务执行形成的可追溯证据。",
        items: [
          { id: "report-artifacts", title: "执行证据", description: "验收和任务执行产生的可追溯证据。", relatedFiles: [".omnidesk/evidence/goal-validation-report.json", ".omnidesk/evidence/runs/*"] },
        ],
      },
      {
        id: "assets-schema-menu",
        title: "数据契约",
        meta: "契约",
        icon: "settings",
        description: "Schema、manifest 和结构化数据契约。",
        items: [
          { id: "schema-assets", title: "数据契约", meta: "契约", description: "Schema、manifest 和结构化数据契约。", relatedFiles: ["schemas/*", "docs/data/*"] },
        ],
      },
    ],
  },
  {
    id: "agent-config",
    capabilityId: "agent-configuration",
    title: "Agent 配置",
    meta: "配置",
    icon: "bot",
    description: "模型、受控工具和安全边界。",
    children: [
      {
        id: "agent-models-menu",
        title: "模型连接",
        meta: "模型",
        icon: "settings",
        description: "Provider 和模型。",
        items: [
          { id: "model-connections", title: "模型连接", description: "Provider、API Base、Key 和模型列表。", relatedFiles: [".omnidesk/data/desktop-provider.json", ".omnidesk/data/model-catalog.json", ".omnidesk/cache/model-health.json"] },
        ],
      },
      {
        id: "agent-tools-menu",
        title: "工具白名单",
        meta: "工具",
        icon: "shield",
        description: "允许执行的工具和命令。",
        items: [
          { id: "tool-allowlist", title: "工具白名单", description: "受控读取、工程写入、检查和终端限制。", relatedFiles: ["desktop/src/agent-runtime/tool-registry.js", "desktop/src-tauri/src/runtime/app.rs", "desktop/src-tauri/src/runtime/patch.rs"] },
        ],
      },
      {
        id: "agent-security-menu",
        title: "安全边界",
        meta: "边界",
        icon: "shield",
        description: "确认和禁止规则。",
        items: [
          { id: "security-boundary", title: "安全边界", description: "敏感信息、确认动作和禁止操作。", relatedFiles: ["docs/AI_SAFETY.md", "docs/SECURITY.md", "AGENTS.md"] },
        ],
      },
    ],
  },
].map((node) => enrichNode(node));

export function outlineLeafKeys(outline) {
  return outline.flatMap((node) => {
    const children = node.children || [];
    const childKeys = children.flatMap((child) => (child.items || []).map((item) => item.id || `${node.title}/${child.title}/${item.title}`));
    const ownKeys = (node.items || []).map((item) => item.id || `${node.title}/${item.title}`);
    return [...childKeys, ...ownKeys];
  });
}

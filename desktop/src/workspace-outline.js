const governanceMeta = {
  "认识项目": {
    id: "understand-project",
    files: ["PROJECT.md", ".project-os/state.json", "README.md", "HANDOFF.md"],
    statusSource: ".project-os/state.json",
    updatesWhen: "接入项目、项目阶段变化、启动方式变化或风险变化时更新。",
  },
  "定义目标": {
    id: "define-goal",
    files: ["docs/PRODUCT_PLAN.md", "PROJECT.md", "HANDOFF.md"],
    statusSource: "PROJECT.md",
    updatesWhen: "目标、用户、场景、范围或成功标准变化时更新。",
  },
  "工作规则": {
    id: "work-rules",
    files: ["AGENTS.md", "docs/ROUTING.md", "docs/DOCUMENTATION.md", "docs/NAMING.md"],
    statusSource: "AGENTS.md",
    updatesWhen: "AI 行为边界、路由、权限或文档归属规则变化时更新。",
  },
  "设计实现": {
    id: "design-implementation",
    files: ["docs/ARCHITECTURE.md", "docs/CODE_STRUCTURE.md", "docs/DESIGN_STANDARDS.md", "desktop/src/*"],
    statusSource: "docs/ARCHITECTURE.md",
    updatesWhen: "架构、数据模型、界面规范或代码结构变化时更新。",
  },
  "验证交付": {
    id: "validate-delivery",
    files: ["docs/TESTING.md", "docs/RUNBOOK.md", "scripts/*", ".project-os/runs/*"],
    statusSource: ".project-os/runs/*",
    updatesWhen: "检查命令、验收标准、交付产物或质量记录变化时更新。",
  },
  "复盘沉淀": {
    id: "retrospective-memory",
    files: ["HANDOFF.md", "docs/LESSONS.md", "docs/DECISIONS.md", "docs/CHANGELOG.md"],
    statusSource: "HANDOFF.md",
    updatesWhen: "交接、经验、决策或长期记忆变化时更新。",
  },
};

const itemMeta = {
  "项目概览": { id: "project-identity", statusSource: ".project-os/state.json" },
  "当前进度": { id: "project-progress", statusSource: "HANDOFF.md" },
  "启动方式": { id: "project-runbook", statusSource: "docs/RUNBOOK.md" },
  "风险边界": { id: "project-risks", statusSource: "HANDOFF.md" },
  "本地状态": { id: "local-project-state", statusSource: ".project-os/state.json" },
  "当前目标": { id: "current-goal", statusSource: ".project-os/goals.json" },
  "验收标准": { id: "acceptance-criteria", statusSource: ".project-os/goal-validation.json" },
  "目标历史": { id: "goal-history", statusSource: ".project-os/goals.json" },
  "协作边界": { id: "collaboration-boundary", statusSource: "AGENTS.md" },
  "执行权限": { id: "execution-permissions", statusSource: "AGENTS.md" },
  "文档规则": { id: "documentation-rules", statusSource: "docs/DOCUMENTATION.md" },
  "系统架构": { id: "system-architecture", statusSource: "docs/ARCHITECTURE.md" },
  "数据契约": { id: "data-contracts", statusSource: "schemas/*" },
  "界面规范": { id: "ui-standards", statusSource: "docs/DESIGN_STANDARDS.md" },
  "实现结构": { id: "code-structure", statusSource: "docs/CODE_STRUCTURE.md" },
  "检查项": { id: "validation-checks", statusSource: "docs/TESTING.md" },
  "验收报告": { id: "validation-report", statusSource: ".project-os/goal-validation-report.json" },
  "运行记录": { id: "run-records", statusSource: ".project-os/runs/*" },
  "交接记录": { id: "handoff-records", statusSource: "HANDOFF.md" },
  "决策记录": { id: "decision-records", statusSource: "docs/DECISIONS.md" },
  "经验教训": { id: "lessons-learned", statusSource: "docs/LESSONS.md" },
  "项目事实": { id: "project-facts", statusSource: ".project-os/workspace-facts.json" },
  "用户偏好": { id: "user-preferences", statusSource: "OmniDesk global: user-profile.json" },
  "长期记忆": { id: "long-term-memory", statusSource: ".project-os/memory/*" },
  "会话摘要": { id: "conversation-summary", statusSource: ".project-os/conversations/*" },
  "当前任务": { id: "active-task", statusSource: ".project-os/runs/desktop-tasks/*" },
  "任务队列": { id: "task-queue", statusSource: ".project-os/runs/desktop-tasks/*" },
  "Patch 草案": { id: "patch-drafts", statusSource: ".project-os/runs/desktop-tasks/*" },
  "执行终端": { id: "execution-terminal", statusSource: ".project-os/runs/*" },
  "执行结果": { id: "execution-results", statusSource: ".project-os/runs/desktop-summary.md" },
  "工程文件": { id: "engineering-files", statusSource: "project tree" },
  "治理文件": { id: "governance-files", statusSource: ".project-os/workspace-facts.json" },
  "报告产物": { id: "report-artifacts", statusSource: ".project-os/reports/*" },
  "Schema": { id: "schema-assets", statusSource: "schemas/*" },
  "脚本模板": { id: "script-templates", statusSource: "scripts/*" },
  "模型连接": { id: "model-connections", statusSource: ".project-os/desktop-provider.json" },
  "工具白名单": { id: "tool-allowlist", statusSource: "desktop/src-tauri/src/main.rs" },
  "Skill 能力": { id: "skill-capabilities", statusSource: ".agents/skills/*" },
  "适配器": { id: "adapters", statusSource: "adapters/*" },
  "安全边界": { id: "security-boundary", statusSource: "docs/AI_SAFETY.md" },
};

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function enrichItem(item, parentId) {
  const meta = itemMeta[item.title] || {};
  const id = meta.id || `${parentId}-${slug(item.title)}`;
  return {
    ...item,
    ...meta,
    id,
    files: item.relatedFiles || item.files || [],
    updatesWhen: item.updatesWhen || meta.updatesWhen || "用户提到相关事实变化，或关联文件内容变化时更新。",
  };
}

function enrichNode(node, parentId = "") {
  const meta = governanceMeta[node.title] || {};
  const id = node.id || meta.id || [parentId, slug(node.title)].filter(Boolean).join("-");
  return {
    ...node,
    ...meta,
    id,
    children: (node.children || []).map((child) => enrichNode(child, id)),
    items: (node.items || []).map((item) => enrichItem(item, id)),
    mapKind: node.mapKind || "project-governance",
  };
}

export const projectGovernanceFlow = [
  {
    title: "认识项目",
    meta: "当前",
    icon: "book",
    description: "项目基本状态。",
    items: [
      { title: "项目概览", description: "名称、用途和阶段。", relatedFiles: ["PROJECT.md", ".project-os/state.json"] },
      { title: "当前进度", description: "当前进度和下一步。", relatedFiles: ["PROJECT.md", "HANDOFF.md"] },
      { title: "启动方式", description: "本地启动方式。", relatedFiles: ["README.md", "docs/RUNBOOK.md", "docs/DESKTOP_APP.md"] },
      { title: "风险边界", description: "已知风险和边界。", relatedFiles: ["HANDOFF.md", "docs/LESSONS.md"] },
      { title: "本地状态", description: "接入和文件状态。", relatedFiles: [".project-os/state.json", ".project-os/desktop-registry.json"] },
    ],
  },
  {
    title: "定义目标",
    meta: "路线",
    icon: "clipboard",
    description: "当前目标、验收标准和目标历史。",
    items: [
      { title: "当前目标", description: "正在推进的目标和范围。", relatedFiles: [".project-os/goals.json", "PROJECT.md", "HANDOFF.md"] },
      { title: "验收标准", description: "完成判断和检查条件。", relatedFiles: [".project-os/goal-validation.json", "docs/TESTING.md"] },
      { title: "目标历史", description: "已完成、待确认和历史目标。", relatedFiles: [".project-os/goals.json", ".project-os/goal-signoff-history.json"] },
    ],
  },
  {
    title: "工作规则",
    meta: "规则",
    icon: "shield",
    description: "协作方式和权限。",
    items: [
      { title: "协作边界", description: "AI 和用户如何分工。", relatedFiles: ["AGENTS.md", "docs/ROUTING.md"] },
      { title: "执行权限", description: "自动和确认边界。", relatedFiles: ["AGENTS.md", "docs/ROUTING.md"] },
      { title: "文档规则", description: "信息归属位置。", relatedFiles: ["docs/DOCUMENTATION.md", "docs/NAMING.md"] },
    ],
  },
  {
    title: "设计实现",
    meta: "方案",
    icon: "wrench",
    description: "方案、架构和实现结构。",
    items: [
      { title: "系统架构", description: "模块和依赖关系。", relatedFiles: ["docs/ARCHITECTURE.md"] },
      { title: "数据契约", description: "对象、状态和结构化契约。", relatedFiles: ["schemas/*", "docs/data/*"] },
      { title: "界面规范", description: "组件和设计 token。", relatedFiles: ["docs/DESIGN_STANDARDS.md", "docs/design/tokens.md", "desktop/src/styles.css"] },
      { title: "实现结构", description: "目录和模块职责。", relatedFiles: ["docs/CODE_STRUCTURE.md", "desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"] },
    ],
  },
  {
    title: "验证交付",
    meta: "检查",
    icon: "check",
    description: "验收、测试和交付结果。",
    items: [
      { title: "检查项", description: "当前项目可运行的检查。", relatedFiles: ["docs/TESTING.md", "scripts/check-runtime.sh", "scripts/check-ai-project.sh"] },
      { title: "验收报告", description: "目标验收和检查结果。", relatedFiles: [".project-os/goal-validation-report.json", ".project-os/reports/ai-project-report.json"] },
      { title: "运行记录", description: "检查、扫描和执行历史。", relatedFiles: [".project-os/runs/*", ".project-os/runs/desktop-summary.md"] },
    ],
  },
  {
    title: "复盘沉淀",
    meta: "记忆",
    icon: "brain",
    description: "经验和下一步。",
    items: [
      { title: "交接记录", description: "继续工作上下文。", relatedFiles: ["HANDOFF.md"] },
      { title: "决策记录", description: "重要取舍记录。", relatedFiles: ["docs/DECISIONS.md", "docs/CHANGELOG.md"] },
      { title: "经验教训", description: "踩坑、修正和新增约束。", relatedFiles: ["docs/LESSONS.md"] },
    ],
  },
];

export const projectGovernanceOutline = [
  {
    id: "project-governance",
    title: "项目流程",
    meta: "流程",
    icon: "clipboard",
    description: "从理解到复盘的项目阶段。",
    children: projectGovernanceFlow.map((node) => enrichNode(node, "project-governance")),
  },
  {
    id: "task-execution",
    title: "任务执行",
    meta: "执行",
    icon: "terminal",
    description: "当前任务、队列、草案、终端和执行结果。",
    children: [
      {
        title: "当前任务",
        meta: "当前",
        icon: "clipboard",
        description: "正在处理的任务。",
        items: [
          { title: "当前任务", description: "当前任务、计划和上下文。", relatedFiles: [".project-os/runs/desktop-tasks/*"] },
        ],
      },
      {
        title: "任务队列",
        meta: "队列",
        icon: "clipboard",
        description: "已创建和待确认任务。",
        items: [
          { title: "任务队列", description: "计划中、进行中和已完成任务。", relatedFiles: [".project-os/runs/desktop-tasks/*", ".project-os/task-backlog.json"] },
        ],
      },
      {
        title: "Patch 草案",
        meta: "草案",
        icon: "files",
        description: "待确认代码草案。",
        items: [
          { title: "Patch 草案", description: "Diff 草案、应用结果和验证摘要。", relatedFiles: [".project-os/runs/desktop-tasks/*"] },
        ],
      },
      {
        title: "执行终端",
        meta: "终端",
        icon: "terminal",
        description: "命令执行入口。",
        items: [
          { title: "执行终端", description: "本地命令、检查和输出。", relatedFiles: [".project-os/runs/*"] },
        ],
      },
      {
        title: "执行结果",
        meta: "结果",
        icon: "check",
        description: "任务结果和验证摘要。",
        items: [
          { title: "执行结果", description: "执行摘要、变更和验证结果。", relatedFiles: [".project-os/runs/desktop-summary.md", "HANDOFF.md"] },
        ],
      },
    ],
  },
  {
    id: "memory",
    title: "知识记忆",
    meta: "上下文",
    icon: "brain",
    description: "项目事实、用户偏好、长期记忆和会话摘要。",
    children: [
      {
        title: "项目事实",
        meta: "事实",
        icon: "book",
        description: "项目长期事实。",
        items: [
          { title: "项目事实", description: "项目身份、阶段、事实来源和可信度。", relatedFiles: [".project-os/workspace-facts.json", ".project-os/state.json", "PROJECT.md"] },
        ],
      },
      {
        title: "用户偏好",
        meta: "偏好",
        icon: "brain",
        description: "长期工作偏好。",
        items: [
          { title: "用户偏好", description: "用户画像、沟通方式和全局偏好。", relatedFiles: ["OmniDesk global: user-profile.json", "OmniDesk global: global-preferences.json"] },
        ],
      },
      {
        title: "长期记忆",
        meta: "记忆",
        icon: "brain",
        description: "可跨会话复用的记忆。",
        items: [
          { title: "长期记忆", description: "沉淀后的长期上下文。", relatedFiles: [".project-os/memory/*", "docs/data/knowledge-registry.json"] },
        ],
      },
      {
        title: "会话摘要",
        meta: "会话",
        icon: "book",
        description: "对话摘要和可沉淀内容。",
        items: [
          { title: "会话摘要", description: "历史对话和摘要。", relatedFiles: [".project-os/conversations/*"] },
        ],
      },
    ],
  },
  {
    id: "engineering-assets",
    title: "工程资产",
    meta: "资产",
    icon: "files",
    description: "文档、代码、数据契约和模板。",
    children: [
      {
        title: "工程文件",
        meta: "代码",
        icon: "files",
        description: "源码和工程目录。",
        items: [
          { title: "工程文件", description: "源码、配置和工程目录。", relatedFiles: ["desktop/*", "cli/*", "package.json"] },
        ],
      },
      {
        title: "治理文件",
        meta: "治理",
        icon: "book",
        description: "Project OS 治理文档。",
        items: [
          { title: "治理文件", description: "项目规则、状态、交接和运行说明。", relatedFiles: ["PROJECT.md", "HANDOFF.md", "AGENTS.md", "docs/*"] },
        ],
      },
      {
        title: "报告产物",
        meta: "报告",
        icon: "clipboard",
        description: "扫描、评分和推荐产物。",
        items: [
          { title: "报告产物", description: "报告、推荐和验证产物。", relatedFiles: [".project-os/reports/*", ".project-os/recommendations/*", ".project-os/goal-validation-report.json"] },
        ],
      },
      {
        title: "Schema",
        meta: "契约",
        icon: "terminal",
        description: "Schema 和 manifest。",
        items: [
          { title: "Schema", description: "结构化数据契约。", relatedFiles: ["schemas/*", "docs/data/*"] },
        ],
      },
      {
        title: "脚本模板",
        meta: "模板",
        icon: "package",
        description: "脚本、模板和可分发资源。",
        items: [
          { title: "脚本模板", description: "运行脚本和项目模板。", relatedFiles: ["scripts/*", "templates/*", "adapters/*"] },
        ],
      },
    ],
  },
  {
    id: "agent-config",
    title: "Agent 配置",
    meta: "配置",
    icon: "bot",
    description: "模型、技能、工具和适配器。",
    children: [
      {
        title: "模型连接",
        meta: "模型",
        icon: "settings",
        description: "Provider 和模型。",
        items: [
          { title: "模型连接", description: "Provider、API Base、Key 和模型列表。", relatedFiles: [".project-os/desktop-provider.json", ".project-os/model-catalog.json", ".project-os/model-health.json"] },
        ],
      },
      {
        title: "工具白名单",
        meta: "工具",
        icon: "shield",
        description: "允许执行的工具和命令。",
        items: [
          { title: "工具白名单", description: "受控检查、治理动作和终端限制。", relatedFiles: ["desktop/src-tauri/src/main.rs", "scripts/check-runtime.sh"] },
        ],
      },
      {
        title: "Skill 能力",
        meta: "技能",
        icon: "bot",
        description: "Agent 能力扩展。",
        items: [
          { title: "Skill 能力", description: "Agent 技能定义和工程规范。", relatedFiles: [".agents/skills/*", "docs/SKILL_ENGINEERING.md"] },
        ],
      },
      {
        title: "适配器",
        meta: "适配",
        icon: "files",
        description: "工具入口适配。",
        items: [
          { title: "适配器", description: "Codex、Claude、Cursor 等工具入口。", relatedFiles: ["adapters/*", "CODEX.md", "CLAUDE.md"] },
        ],
      },
      {
        title: "安全边界",
        meta: "边界",
        icon: "shield",
        description: "确认和禁止规则。",
        items: [
          { title: "安全边界", description: "敏感信息、确认动作和禁止操作。", relatedFiles: ["docs/AI_SAFETY.md", "docs/SECURITY.md", "AGENTS.md"] },
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

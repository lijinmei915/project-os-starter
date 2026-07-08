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
  "项目目标": { id: "product-goal", statusSource: "docs/PRODUCT_PLAN.md" },
  "目标用户": { id: "target-users", statusSource: "docs/PRODUCT_PLAN.md" },
  "使用场景": { id: "use-cases", statusSource: "docs/PRODUCT_PLAN.md" },
  "当前范围": { id: "scope-boundary", statusSource: "PROJECT.md" },
  "成功标准": { id: "success-criteria", statusSource: "docs/TESTING.md" },
  "角色边界": { id: "role-boundary", statusSource: "AGENTS.md" },
  "请求路由": { id: "request-routing", statusSource: "docs/ROUTING.md" },
  "执行权限": { id: "execution-permissions", statusSource: "AGENTS.md" },
  "文档规则": { id: "documentation-rules", statusSource: "docs/DOCUMENTATION.md" },
  "风险约束": { id: "risk-constraints", statusSource: "docs/LESSONS.md" },
  "方案设计": { id: "solution-design", statusSource: "docs/PRODUCT_PLAN.md" },
  "系统架构": { id: "system-architecture", statusSource: "docs/ARCHITECTURE.md" },
  "数据模型": { id: "data-model", statusSource: "schemas/*" },
  "界面规范": { id: "ui-standards", statusSource: "docs/DESIGN_STANDARDS.md" },
  "实现结构": { id: "code-structure", statusSource: "docs/CODE_STRUCTURE.md" },
  "验收标准": { id: "acceptance-criteria", statusSource: "docs/TESTING.md" },
  "检查清单": { id: "checklist", statusSource: "docs/TESTING.md" },
  "测试验证": { id: "test-validation", statusSource: "desktop/package.json" },
  "交付产物": { id: "deliverables", statusSource: "docs/RUNBOOK.md" },
  "质量记录": { id: "quality-records", statusSource: ".project-os/runs/*" },
  "当前交接": { id: "handoff", statusSource: "HANDOFF.md" },
  "经验复盘": { id: "lessons", statusSource: "docs/LESSONS.md" },
  "关键决策": { id: "decisions", statusSource: "docs/DECISIONS.md" },
  "运行记录": { id: "run-records", statusSource: ".project-os/runs/*" },
  "目标历史": { id: "goal-history", statusSource: ".project-os/goals.json" },
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
    description: "目标、对象和边界。",
    items: [
      { title: "项目目标", description: "问题和结果。", relatedFiles: ["docs/PRODUCT_PLAN.md", "PROJECT.md"] },
      { title: "目标用户", description: "核心使用者。", relatedFiles: ["docs/PRODUCT_PLAN.md", "PROJECT.md"] },
      { title: "使用场景", description: "主要工作流。", relatedFiles: ["docs/PRODUCT_PLAN.md", "docs/DESKTOP_APP.md"] },
      { title: "当前范围", description: "做什么和不做什么。", relatedFiles: ["PROJECT.md", "HANDOFF.md"] },
      { title: "成功标准", description: "完成判断标准。", relatedFiles: ["docs/PRODUCT_PLAN.md", "docs/TESTING.md", "HANDOFF.md"] },
    ],
  },
  {
    title: "工作规则",
    meta: "规则",
    icon: "shield",
    description: "协作方式和权限。",
    items: [
      { title: "角色边界", description: "谁能做什么。", relatedFiles: ["AGENTS.md"] },
      { title: "请求路由", description: "需求处理流程。", relatedFiles: ["docs/ROUTING.md"] },
      { title: "执行权限", description: "自动和确认边界。", relatedFiles: ["AGENTS.md", "docs/ROUTING.md"] },
      { title: "文档规则", description: "信息归属位置。", relatedFiles: ["docs/DOCUMENTATION.md", "docs/NAMING.md"] },
      { title: "风险约束", description: "禁止和复盘规则。", relatedFiles: ["AGENTS.md", "docs/LESSONS.md"] },
    ],
  },
  {
    title: "设计实现",
    meta: "方案",
    icon: "wrench",
    description: "方案、架构和实现结构。",
    items: [
      { title: "方案设计", description: "整体解决方案。", relatedFiles: ["docs/PRODUCT_PLAN.md", "docs/DESKTOP_APP.md"] },
      { title: "系统架构", description: "模块和依赖关系。", relatedFiles: ["docs/ARCHITECTURE.md"] },
      { title: "数据模型", description: "对象、状态和关系。", relatedFiles: ["schemas/*", "docs/data/*"] },
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
      { title: "验收标准", description: "完成判断标准。", relatedFiles: ["docs/PRODUCT_PLAN.md", "docs/TESTING.md"] },
      { title: "检查清单", description: "必须检查事项。", relatedFiles: ["docs/TESTING.md", "scripts/check-runtime.sh", "scripts/check-ai-project.sh"] },
      { title: "测试验证", description: "功能和回归验证。", relatedFiles: ["docs/TESTING.md", "desktop/package.json"] },
      { title: "交付产物", description: "最终交付内容。", relatedFiles: ["docs/RUNBOOK.md", "templates/*", "dist/*"] },
      { title: "质量记录", description: "结果和遗留问题。", relatedFiles: [".project-os/runs/*", ".project-os/recommendations/recommend-next.json", "HANDOFF.md"] },
    ],
  },
  {
    title: "复盘沉淀",
    meta: "记忆",
    icon: "brain",
    description: "经验和下一步。",
    items: [
      { title: "当前交接", description: "继续工作上下文。", relatedFiles: ["HANDOFF.md"] },
      { title: "经验复盘", description: "踩坑和修正。", relatedFiles: ["docs/LESSONS.md"] },
      { title: "关键决策", description: "重要取舍记录。", relatedFiles: ["docs/DECISIONS.md", "docs/CHANGELOG.md"] },
      { title: "运行记录", description: "任务和检查记录。", relatedFiles: [".project-os/runs/*", "docs/data/knowledge-registry.json"] },
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
    id: "memory",
    title: "知识记忆",
    meta: "上下文",
    icon: "brain",
    description: "项目、用户、规则和会话记忆。",
    children: [
      {
        title: "项目上下文",
        meta: "项目",
        icon: "book",
        description: "项目目标和状态。",
        items: [
          { title: "项目状态", description: "目标、阶段和交接。", relatedFiles: ["PROJECT.md", "HANDOFF.md", ".project-os/state.json", "docs/PRODUCT_PLAN.md"] },
        ],
      },
      {
        title: "用户偏好",
        meta: "全局",
        icon: "brain",
        description: "长期工作偏好。",
        items: [
          { title: "偏好摘要", description: "偏好和工作方式。", relatedFiles: ["OmniDesk global: user-profile.json", "OmniDesk global: global-preferences.json"] },
        ],
      },
      {
        title: "团队规则",
        meta: "规则",
        icon: "settings",
        description: "长期协作规则。",
        items: [
          { title: "协作规则", description: "规则和边界。", relatedFiles: ["AGENTS.md", "docs/ROUTING.md", "docs/DOCUMENTATION.md"] },
        ],
      },
      {
        title: "决策记录",
        meta: "项目",
        icon: "clipboard",
        description: "关键取舍记录。",
        items: [
          { title: "决策和复盘", description: "决策、经验和变化。", relatedFiles: ["docs/DECISIONS.md", "docs/LESSONS.md", "docs/CHANGELOG.md"] },
        ],
      },
      {
        title: "会话摘要",
        meta: "当前",
        icon: "brain",
        description: "对话沉淀内容。",
        items: [
          { title: "会话上下文", description: "历史和可沉淀内容。", relatedFiles: [".project-os/conversations/*", ".project-os/memory/*"] },
        ],
      },
    ],
  },
  {
    id: "task-execution",
    title: "任务执行",
    meta: "执行",
    icon: "terminal",
    description: "对话、计划、待办、运行和结果。",
    children: [
      {
        title: "对话",
        meta: "当前",
        icon: "book",
        description: "任务对话入口。",
        items: [
          { title: "对话记录", description: "当前任务对话。", relatedFiles: [".project-os/conversations/*"] },
        ],
      },
      {
        title: "计划",
        meta: "步骤",
        icon: "clipboard",
        description: "执行步骤和范围。",
        items: [
          { title: "执行计划", description: "步骤、范围和检查。", relatedFiles: [".project-os/runs/*", ".project-os/recommendations/recommend-next.json"] },
        ],
      },
      {
        title: "待办",
        meta: "队列",
        icon: "clipboard",
        description: "已确认任务队列。",
        items: [
          { title: "任务队列", description: "待执行任务。", relatedFiles: [".project-os/runs/desktop-tasks/*"] },
          { title: "目标历史", description: "目标列表、验收报告和签收记录。", relatedFiles: [".project-os/goals.json", ".project-os/goal-validation-report.json", ".project-os/goal-signoff-history.json"] },
        ],
      },
      {
        title: "运行记录",
        meta: "日志",
        icon: "terminal",
        description: "命令和工具日志。",
        items: [
          { title: "运行日志", description: "命令和工具输出。", relatedFiles: [".project-os/runs/*", ".project-os/runs/desktop-summary.md"] },
        ],
      },
      {
        title: "执行结果",
        meta: "结果",
        icon: "check",
        description: "Diff、产物和检查结果。",
        items: [
          { title: "结果摘要", description: "变更和验证结果。", relatedFiles: [".project-os/runs/*", "HANDOFF.md"] },
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
        title: "核心文档",
        meta: "入口",
        icon: "book",
        description: "项目入口文档。",
        items: [
          { title: "入口文档", description: "核心上下文入口。", relatedFiles: ["README.md", "PROJECT.md", "HANDOFF.md", "AGENTS.md"] },
        ],
      },
      {
        title: "产品文档",
        meta: "产品",
        icon: "clipboard",
        description: "计划和决策文档。",
        items: [
          { title: "产品记录", description: "计划、方向和决策。", relatedFiles: ["docs/PRODUCT_PLAN.md", "docs/DESKTOP_APP.md", "docs/DECISIONS.md", "docs/CHANGELOG.md"] },
        ],
      },
      {
        title: "设计资产",
        meta: "设计",
        icon: "wrench",
        description: "设计规范和 tokens。",
        items: [
          { title: "设计资料", description: "规范、布局和 tokens。", relatedFiles: ["docs/DESIGN_STANDARDS.md", "docs/design/*"] },
        ],
      },
      {
        title: "代码结构",
        meta: "代码",
        icon: "files",
        description: "源码和脚本结构。",
        items: [
          { title: "代码资产", description: "源码、脚本和适配器。", relatedFiles: ["desktop/*", "scripts/*", "adapters/*"] },
        ],
      },
      {
        title: "数据契约",
        meta: "数据",
        icon: "terminal",
        description: "Schema 和 manifest。",
        items: [
          { title: "数据定义", description: "结构化契约文件。", relatedFiles: ["schemas/*", "docs/data/*"] },
        ],
      },
      {
        title: "模板资源",
        meta: "模板",
        icon: "package",
        description: "可分发模板。",
        items: [
          { title: "模板资产", description: "项目和报告模板。", relatedFiles: ["templates/*", "templates/project-docs/*", "templates/report/*"] },
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
        title: "模型配置",
        meta: "模型",
        icon: "settings",
        description: "Provider 和模型。",
        items: [
          { title: "模型设置", description: "Provider 和 catalog。", relatedFiles: [".project-os/desktop-provider.json", ".project-os/model-catalog.json"] },
        ],
      },
      {
        title: "工具权限",
        meta: "权限",
        icon: "shield",
        description: "工具调用边界。",
        items: [
          { title: "权限规则", description: "工具和安全边界。", relatedFiles: ["AGENTS.md", "docs/DESKTOP_APP.md", "docs/AI_SAFETY.md"] },
        ],
      },
      {
        title: "Skills",
        meta: "技能",
        icon: "bot",
        description: "Agent 能力扩展。",
        items: [
          { title: "Skill 资源", description: "Agent 技能定义。", relatedFiles: [".agents/skills/*", "docs/SKILL_ENGINEERING.md"] },
        ],
      },
      {
        title: "适配器",
        meta: "适配",
        icon: "files",
        description: "工具入口适配。",
        items: [
          { title: "适配文件", description: "工具读取入口。", relatedFiles: ["adapters/*", "CODEX.md", "CLAUDE.md"] },
        ],
      },
      {
        title: "执行边界",
        meta: "边界",
        icon: "shield",
        description: "确认和禁止规则。",
        items: [
          { title: "执行规则", description: "确认和禁止操作。", relatedFiles: ["AGENTS.md", "docs/ROUTING.md", "docs/SECURITY.md"] },
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

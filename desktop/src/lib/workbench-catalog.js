export const capabilityLabels = Object.freeze({
  goals: "目标管理",
  rules: "工作规则",
  "design-implementation": "设计实现",
  "validation-delivery": "验证交付",
  "knowledge-memory": "知识记忆",
  "agent-configuration": "Agent 配置",
});

export const capabilityDescriptions = Object.freeze({
  goals: "管理项目目标、验收标准和历史记录。",
  rules: "维护 AI 协作、权限和文档规则。",
  "design-implementation": "组织架构、数据契约、界面规范和实现结构。",
  "validation-delivery": "管理检查项、验收报告和运行记录。",
  "knowledge-memory": "沉淀项目事实、偏好、决策和会话摘要。",
  "agent-configuration": "配置模型连接、工具白名单和技能。",
});

export const workspaceModuleLabels = Object.freeze({
  "system-architecture": "系统架构",
  "data-contracts": "数据契约",
  "ui-standards": "界面规范",
  "code-structure": "实现结构",
  "validation-checks": "检查项",
  "validation-report": "验收报告",
  "run-records": "运行记录",
  "model-connections": "模型连接",
  "tool-allowlist": "工具白名单",
  "security-boundary": "安全边界",
  "project-runbook": "启动方式",
});

export const dedicatedSurfaceByTopic = Object.freeze({
  "acceptance-criteria": "acceptance-criteria",
  "collaboration-boundary": "collaboration-boundary",
  "current-goal": "current-goal",
  "documentation-rules": "documentation-rules",
  "execution-permissions": "execution-permissions",
  "goal-history": "goal-history",
  "system-architecture": "system-architecture",
  "data-contracts": "data-contracts",
  "code-structure": "code-structure",
  "validation-checks": "validation-checks",
  "validation-report": "validation-report",
  "run-records": "run-records",
  "handoff-records": "handoff-records",
  "decision-records": "decision-records",
  "lessons-learned": "lessons-learned",
  "task-list": "task-execution",
  "execution-terminal": "task-execution",
  "execution-results": "task-execution",
  "project-facts": "memory-surface",
  "user-preferences": "memory-surface",
  "long-term-memory": "memory-surface",
  "conversation-summary": "memory-surface",
  "engineering-files": "asset-surface",
  "governance-files": "asset-surface",
  "report-artifacts": "asset-surface",
  "schema-assets": "asset-surface",
  "model-connections": "agent-config-surface",
  "tool-allowlist": "agent-config-surface",
  "security-boundary": "agent-config-surface",
  "project-progress": "current-progress",
  "project-risks": "risk-boundary",
  "project-runbook": "runbook",
  "local-project-state": "local-project-state",
});

export const chatStarterPrompts = Object.freeze([
  "检查当前项目还有哪些风险",
  "整理下一步任务并生成计划",
  "查看最近改动并准备审查",
  "运行一轮基础检查",
]);

export const fallbackSnapshot = {
  projectName: "omnidesk-starter",
  projectCapabilities: { capabilities: [] },
  currentProjectId: "current",
  currentProjectPath: "/Users/heqiao/Desktop/Claude练习/project-starter-pack",
  phase: "stabilizing",
  stage: "OmniDesk Desktop Runtime 收口期 / Desktop v0.1 方向确认期",
  fileCount: 0,
  docsCount: 0,
  recommendationCount: 0,
  runCount: 0,
  projects: [{ id: "current", name: "omnidesk-starter", path: "/Users/heqiao/Desktop/Claude练习/project-starter-pack", phase: "stabilizing", isCurrent: true }],
  tree: [
    { label: "omnidesk-starter", depth: 0, kind: "folder" },
    { label: "docs", depth: 1, kind: "folder" },
    { label: "ARCHITECTURE.md", depth: 2, kind: "file" },
    { label: "desktop", depth: 1, kind: "folder" },
    { label: "main.jsx", depth: 2, kind: "file" },
    { label: "PROJECT.md", depth: 1, kind: "file" },
    { label: "HANDOFF.md", depth: 1, kind: "file" },
  ],
  queue: [
    { title: "打磨输入区和生成状态体验", status: "planned", body: "发送、停止、继续补充、语音和附件状态统一。", tone: "accent" },
    { title: "优化执行反馈和阶段状态", status: "planned", body: "把正在思考拆成理解、计划、改动、检查、整理结果。", tone: "accent" },
    { title: "梳理右侧目标任务项目档案结构", status: "planned", body: "目标、任务、对话、项目档案分清楚，减少重复。", tone: "accent" },
    { title: "优化多 API 配置和新建状态", status: "planned", body: "区分新建、编辑、已保存和启用，必填项更清楚。", tone: "neutral" },
    { title: "提升桌面应用完整感", status: "planned", body: "统一名称、图标、启动、版本和服务状态。", tone: "neutral" },
    { title: "打通治理文件和项目体验", status: "planned", body: "从文档和对话动态维护项目档案、目标、任务和上下文。", tone: "neutral" },
  ],
  memory: [
    { marker: "Δ", title: "已学习方向", body: "用户希望 OmniDesk 成为长期使用的本地 AI 工作台。", muted: false },
    { marker: "Σ", title: "知识扩展", body: "桌面端采用 Tauri + Local Agent Core，不复制完整 IDE。", muted: true },
  ],
  projectProfile: {
    intro: "",
    longTermGoal: "",
    targetUsers: "",
    useCases: "",
    userPreferences: "",
    missingFields: ["项目简介", "长期目标", "目标用户", "使用场景", "用户偏好"],
  },
  workspaceFacts: null,
  trace: ["BOOT: browser preview fallback.", "INDEX: waiting for Tauri Local Agent Core.", "GUARD: write actions require diff review."],
  goalValidation: { criteria: [] },
  goalValidationReport: { status: "missing", checks: [] },
  goalSignoffHistory: { entries: [] },
  goals: {
    schemaVersion: "omnidesk.goals.v0.1",
    activeGoalId: "desktop-v0.1-direction-confirmation",
    goals: [{
      id: "desktop-v0.1-direction-confirmation",
      title: "OmniDesk Desktop Runtime 收口期 / Desktop v0.1 方向确认期",
      projectName: "omnidesk-starter",
      status: "done",
      validationStatus: "passed",
      summary: "Desktop v0.1 目标验收已通过并确认完成。",
      decompositionTaskIds: [],
      taskIds: [],
    }],
  },
};

export const taskStatuses = {
  planned: "planned",
  waitingApproval: "waiting approval",
  repairPending: "repair pending",
  waitingRepairApproval: "waiting repair approval",
  repairFailed: "repair failed",
  running: "running",
  done: "done",
  failed: "failed",
};

export const fallbackProvider = {
  provider: "openai-compatible",
  model: "gpt-5.4-mini",
  apiBase: "https://api.openai.com/v1",
  apiKeyEnv: "OPENAI_API_KEY",
  enabled: false,
  hasApiKey: false,
  activeProfileId: "",
  profiles: [],
};

export const planCards = [
  { title: "优化界面", body: "把某个页面、按钮或配置流程改得更小白。" },
  { title: "新增功能", body: "描述你想加的能力，我会先给计划和改动预览。" },
  { title: "修复问题", body: "贴现象或截图，我会帮你定位并生成修改建议。" },
];

export const fallbackModelCatalog = {
  schemaVersion: "omnidesk.model-catalog.v0.1",
  providers: [
    { id: "openai", label: "OpenAI", note: "OpenAI 官方账号", website: "https://platform.openai.com", provider: "openai-compatible", models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1-mini"], apiBase: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_API_KEY" },
    { id: "deepseek", label: "DeepSeek", note: "DeepSeek 官方账号", website: "https://platform.deepseek.com", provider: "openai-compatible", models: ["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"], apiBase: "https://api.deepseek.com/v1", apiKeyEnv: "DEEPSEEK_API_KEY" },
    { id: "qwen", label: "Qwen", note: "阿里百炼 / DashScope", website: "https://dashscope.aliyun.com", provider: "openai-compatible", models: ["qwen3.7-max", "qwen3.7-plus", "qwen3.6-flash", "qwen-plus"], apiBase: "https://dashscope.aliyun.com/compatible-mode/v1", apiKeyEnv: "DASHSCOPE_API_KEY" },
    { id: "gateway", label: "Gateway", note: "公司或团队统一中转", website: "https://your-gateway.example", provider: "openai-compatible", models: ["your-model"], apiBase: "https://your-gateway.example/v1", apiKeyEnv: "LLM_GATEWAY_API_KEY" },
  ],
};

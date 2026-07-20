export function agentConfigCapabilitySpec(topicId, provider) {
  const specs = {
    "model-connections": {
      title: "模型连接",
      status: provider?.enabled && provider?.model ? "已接入" : "待配置",
      tone: provider?.enabled && provider?.model ? "success" : "warning",
      value: "让接入项目知道当前 Agent 用哪个模型、Key 存在哪里、模型是否可用。",
      next: provider?.enabled ? "测试当前模型可用性，并补充项目级默认模型策略。" : "配置 Provider、API Base、Key 环境变量和默认模型。",
      files: [".project-os/desktop-provider.json", ".project-os/model-catalog.json", ".project-os/model-health.json"],
    },
    "tool-allowlist": {
      title: "工具白名单", status: "待产品化", tone: "warning",
      value: "让新项目明确哪些检查、治理动作和终端命令可以被 Agent 调用。",
      next: "把 Tauri command、检查脚本、治理动作汇总成项目级允许列表。",
      files: ["desktop/src-tauri/src/main.rs", "scripts/check-runtime.sh", "scripts/check-ai-project.sh"],
    },
    "skill-capabilities": {
      title: "Skill 能力", status: "已发现", tone: "success",
      value: "让接入项目按意图启用项目初始化、设计规范、前端实现等能力。",
      next: "显示每个 Skill 的职责、触发条件、来源目录和启用状态。",
      files: [".agents/skills/project-setup/SKILL.md", ".agents/skills/design-system/SKILL.md", ".agents/skills/frontend/SKILL.md", ".claude/skills/REGISTRY.md"],
    },
    adapters: {
      title: "适配器", status: "有基础", tone: "info",
      value: "让同一个项目规则可以被 Codex、Claude、Cursor、Gemini 等工具复用。",
      next: "检测 adapters 目录、根入口文件和工具专属规则是否同步。",
      files: ["adapters/CODEX.md", "adapters/CLAUDE.md", "adapters/CURSOR.md", "adapters/GEMINI.md"],
    },
    "security-boundary": {
      title: "安全边界", status: "规则已接入", tone: "success",
      value: "让接入项目明确哪些动作必须确认、哪些文件不能动、哪些信息不能外传。",
      next: "把 AGENTS.md 的禁止行为、确认动作和密钥规则整理成可视化边界。",
      files: ["AGENTS.md", "docs/ROUTING.md", "docs/DOCUMENTATION.md", "docs/LESSONS.md"],
    },
  };
  return specs[topicId] || null;
}

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
      files: ["desktop/src/agent-runtime/tool-registry.js", "desktop/src-tauri/src/runtime/app.rs", "desktop/src-tauri/src/runtime/patch.rs"],
    },
    "security-boundary": {
      title: "安全边界", status: "规则已接入", tone: "success",
      value: "让接入项目明确哪些动作必须确认、哪些文件不能动、哪些信息不能外传。",
      next: "把 AGENTS.md 的禁止行为、确认动作和密钥规则整理成可视化边界。",
      files: ["AGENTS.md", "docs/DOCUMENTATION.md", "docs/LESSONS.md"],
    },
  };
  return specs[topicId] || null;
}

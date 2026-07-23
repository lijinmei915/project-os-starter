export function agentConfigCapabilitySpec(topicId, provider) {
  const specs = {
    "model-connections": {
      title: "模型连接",
      status: provider?.enabled && provider?.model ? "已接入" : "待配置",
      tone: provider?.enabled && provider?.model ? "success" : "warning",
      value: "让接入项目知道当前 Agent 用哪个模型、Key 存在哪里、模型是否可用。",
      next: provider?.enabled ? "测试当前模型可用性，并补充项目级默认模型策略。" : "配置 Provider、API Base、Key 环境变量和默认模型。",
      files: [".omnidesk/data/desktop-provider.json", ".omnidesk/data/model-catalog.json", ".omnidesk/cache/model-health.json"],
    },
    "tool-allowlist": {
      title: "受控工具", status: "规则已接入", tone: "success",
      value: "让用户知道 Agent 只能请求固定的 Runtime 检查，工程写入和检查各自需要确认。",
      next: "查看任务证据，按当前任务范围审批 Patch 或受控检查。",
      files: ["desktop/src-tauri/src/runtime/execution.rs", "desktop/src-tauri/src/runtime/patch.rs", "desktop/src-tauri/src/runtime/agent_runs.rs"],
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

const commands = [
  ["Runtime 检查", "bash scripts/check-runtime.sh .", "验证 Project OS 运行规则和核心文档。"],
  ["AI 项目报告", "bash scripts/check-ai-project.sh . --write-report", "生成工程治理报告和建议。"],
  ["Web 构建", "npm --prefix desktop run web:build", "验证桌面前端是否可构建。"],
];

export function ControlledCommandsPanel() {
  return <div className="agentControlledCommands">{commands.map(([label, command, description]) => <div className="agentControlledCommand" key={command}><div><strong>{label}</strong><p>{description}</p></div><code>{command}</code></div>)}</div>;
}

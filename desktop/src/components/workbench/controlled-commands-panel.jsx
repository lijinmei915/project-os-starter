const commands = [
  ["Desktop 测试", "npm --prefix desktop test", "验证对话、任务、权限和执行契约。"],
  ["Web 构建", "npm --prefix desktop run web:build", "验证桌面前端是否可构建。"],
  ["Runtime 检查", "cargo check --manifest-path desktop/src-tauri/Cargo.toml", "验证 Tauri Local Agent Runtime 是否可编译。"],
];

export function ControlledCommandsPanel() {
  return <div className="agentControlledCommands">{commands.map(([label, command, description]) => <div className="agentControlledCommand" key={command}><div><strong>{label}</strong><p>{description}</p></div><code>{command}</code></div>)}</div>;
}

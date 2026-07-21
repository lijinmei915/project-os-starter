import { Badge } from "../ui/badge";
import { OverviewPageHeader, OverviewSection } from "./overview-section";

export function AgentConfigSurfacePanel({ onOpenSource, renderSourceButtons, type }) {
  const specs = {
    "model-connections": ["模型连接", "配置当前 Provider、可用性与默认模型。", [".omnidesk/data/desktop-provider.json"], ["当前连接", "可用性", "默认模型"]],
    "tool-allowlist": ["工具白名单", "明确 Agent 可以调用的受控能力与限制。", ["desktop/src-tauri/src/main.rs"], ["允许工具", "确认边界", "禁止范围"]],
    "security-boundary": ["安全边界", "明确数据、命令和写入操作的安全限制。", ["AGENTS.md"], ["数据边界", "执行边界", "确认动作"]],
  };
  const [title, description, sources, sections] = specs[type];
  return <section className="overviewSurface agentConfigSurface"><OverviewPageHeader title={title} description={description} meta={<span>配置或安全规则变化时更新</span>} sources={renderSourceButtons(onOpenSource, sources)} status={<Badge>已登记</Badge>} />{sections.map((name, index) => <OverviewSection key={name} title={name} subtitle={index === 0 ? "当前配置" : index === 1 ? "规则边界" : "后续维护"} items={[{ id: `${type}-${index}`, content: index === 0 ? "查看当前已登记的本地配置与来源。" : index === 1 ? "该能力通过受控规则使用，不在页面中绕过既有安全边界。" : "配置变更后通过对应检查验证，并保留可追溯来源。" }]} />)}</section>;
}

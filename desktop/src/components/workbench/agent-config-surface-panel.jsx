import React from "react";
import { Badge } from "../ui/badge";
import { Notice } from "../ui/notice";
import { OverviewPageHeader, OverviewSection } from "./overview-section";

const McpManagementPanel = React.lazy(() => import("./mcp-management-panel").then((module) => ({ default: module.McpManagementPanel })));

export function AgentConfigSurfacePanel({ agentRuns, mcpClient, mcpNative, onApproveAgentRun, onCancelAgentRun, onExportAgentRun, onOpenSource, onRefreshAgentRuns, projectId, projectPath, renderSourceButtons, type }) {
  const specs = {
    "model-connections": ["模型连接", "配置当前 Provider、可用性与默认模型。", [".omnidesk/data/desktop-provider.json"], ["当前连接", "可用性", "默认模型"]],
    "tool-allowlist": ["受控工具", "管理内置工具与 MCP 扩展；发现和调用都经过独立审批。", ["desktop/src-tauri/src/runtime/mcp_runtime.rs", "desktop/src-tauri/src/runtime/execution.rs"], ["允许工具", "确认边界", "禁止范围"]],
    "security-boundary": ["安全边界", "明确数据、命令和写入操作的安全限制。", ["AGENTS.md"], ["数据边界", "执行边界", "确认动作"]],
  };
  const [title, description, sources, sections] = specs[type];
  if (type === "tool-allowlist") {
    return <section className="overviewSurface agentConfigSurface"><OverviewPageHeader title={title} description={description} meta={<span>配置变化后需重新发现</span>} sources={renderSourceButtons(onOpenSource, sources)} status={<Badge>逐次审批</Badge>} /><OverviewSection title="固定边界" subtitle="所有 MCP 扩展都遵守相同规则" items={[{ id: "mcp-secret-boundary", label: "密钥", content: "只登记环境变量名，不保存密钥值。" }, { id: "mcp-discovery-boundary", label: "发现", content: "启动 Server 前创建独立审批。" }, { id: "mcp-call-boundary", label: "调用", content: "每次工具调用再次独立审批。" }]} /><React.Suspense fallback={<Notice variant="muted">正在载入 MCP 管理…</Notice>}><McpManagementPanel agentRuns={agentRuns} client={mcpClient} native={mcpNative} onApproveAgentRun={onApproveAgentRun} onCancelAgentRun={onCancelAgentRun} onExportAgentRun={onExportAgentRun} onRefreshAgentRuns={onRefreshAgentRuns} projectId={projectId} projectPath={projectPath} /></React.Suspense></section>;
  }
  return <section className="overviewSurface agentConfigSurface"><OverviewPageHeader title={title} description={description} meta={<span>配置或安全规则变化时更新</span>} sources={renderSourceButtons(onOpenSource, sources)} status={<Badge>已登记</Badge>} />{sections.map((name, index) => <OverviewSection key={name} title={name} subtitle={index === 0 ? "当前配置" : index === 1 ? "规则边界" : "后续维护"} items={[{ id: `${type}-${index}`, content: index === 0 ? "查看当前已登记的本地配置与来源。" : index === 1 ? "该能力通过受控规则使用，不在页面中绕过既有安全边界。" : "配置变更后通过对应检查验证，并保留可追溯来源。" }]} />)}</section>;
}

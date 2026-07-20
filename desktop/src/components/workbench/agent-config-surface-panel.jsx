import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { OverviewPageHeader, OverviewSection } from "./overview-section";

export function AgentConfigSurfacePanel({ onGetHermesExecutorStatus, onOpenSource, renderSourceButtons, type }) {
  const [hermesStatus, setHermesStatus] = useState({ status: "checking", message: "正在检测本地执行器。" });
  const refreshHermesStatus = async () => {
    try {
      setHermesStatus({ status: "checking", message: "正在检测本地执行器。" });
      setHermesStatus(await onGetHermesExecutorStatus());
    } catch (error) {
      setHermesStatus({ status: "unavailable", message: error instanceof Error ? error.message : "读取 Hermes 状态失败。" });
    }
  };
  useEffect(() => { if (type === "adapters") refreshHermesStatus(); }, [type]);
  const specs = {
    "model-connections": ["模型连接", "配置当前 Provider、可用性与默认模型。", [".project-os/desktop-provider.json"], ["当前连接", "可用性", "默认模型"]],
    "tool-allowlist": ["工具白名单", "明确 Agent 可以调用的受控能力与限制。", ["desktop/src-tauri/src/main.rs"], ["允许工具", "确认边界", "禁止范围"]],
    "skill-capabilities": ["Skill 能力", "登记可用 Skill、触发条件与职责边界。", [".agents/skills/", ".claude/skills/"], ["能力目录", "触发方式", "使用边界"]],
    adapters: ["适配器", "让同一规则以各工具可读取的方式复用。", ["adapters/", "adapters/HERMES.md", "AGENTS.md"], ["适配目录", "规则源头", "Hermes 执行器"]],
    "security-boundary": ["安全边界", "明确数据、命令和写入操作的安全限制。", ["AGENTS.md", "docs/ROUTING.md"], ["数据边界", "执行边界", "确认动作"]],
  };
  const [title, description, sources, sections] = specs[type];
  const presentation = {
    "cli-only": { label: "仅 CLI", tone: "waiting" }, checking: { label: "检测中", tone: "planned" },
    "not-installed": { label: "未接入", tone: "waiting" }, ready: { label: "可用", tone: "done" }, unavailable: { label: "需修复", tone: "failed" },
  }[hermesStatus.status] || { label: "未知", tone: "waiting" };
  return <section className="overviewSurface agentConfigSurface"><OverviewPageHeader title={title} description={description} meta={<span>配置或安全规则变化时更新</span>} sources={renderSourceButtons(onOpenSource, sources)} status={<Badge>已登记</Badge>} />{sections.map((name, index) => <OverviewSection key={name} title={name} subtitle={index === 0 ? "当前配置" : index === 1 ? "规则边界" : "后续维护"} items={[{ id: `${type}-${index}`, content: type === "adapters" && index === 2 ? <div className="inlineActionRow"><div><Badge status={presentation.tone}>{presentation.label}</Badge><p>{hermesStatus.message}</p>{hermesStatus.version ? <p>{hermesStatus.protocol.toUpperCase()} · {hermesStatus.version}</p> : null}</div><Button size="sm" type="button" variant="ghost" onClick={refreshHermesStatus}>重新检测</Button></div> : index === 0 ? "查看当前已登记的本地配置与来源。" : index === 1 ? "该能力通过受控规则使用，不在页面中绕过既有安全边界。" : "配置变更后通过对应检查验证，并保留可追溯来源。" }]} />)}</section>;
}

import { Check, Copy, FileText, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { buildProjectFactStore } from "../../fact-store";
import { compileRunbookSlots } from "../../runbook-slot-runtime";
import projectRunbookContract from "../../../../schemas/project-runbook-contract.v0.1.json";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { Tooltip } from "../ui/tooltip";
import { OverviewPageHeader, OverviewSection, OverviewTagList } from "./overview-section";

function RunbookCommandList({ commands, copiedCommandId, copyErrorId, onCopy, onSendToTerminal }) {
  if (!commands.length) return <Notice variant="info">尚未识别到命令，请先在 package scripts 或运行文档登记。</Notice>;
  return (
    <div className="runbookCommandList">
      {commands.map((item) => {
        const copied = copiedCommandId === item.id;
        const failed = copyErrorId === item.id;
        return (
          <div className="runbookCommandRow" key={item.id || item.label}>
            <div className="runbookCommandIdentity"><strong>{item.label}</strong><span>{item.source}</span></div>
            <code>{item.command}</code>
            <div className="runbookCommandAction">
              <div className="runbookCommandButtons">
                <Tooltip content="发送到终端"><Button aria-label={`发送${item.label}命令到终端`} onClick={() => onSendToTerminal?.(item.command)} size="icon" type="button" variant="ghost"><TerminalSquare aria-hidden="true" /></Button></Tooltip>
                <Tooltip content={failed ? "复制失败" : copied ? "已复制" : "复制命令"}><Button aria-label={`复制${item.label}命令`} onClick={() => onCopy(item)} size="icon" type="button" variant="ghost">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button></Tooltip>
              </div>
              {copied || failed ? <span className={failed ? "error" : "success"} role="status">{failed ? "复制失败" : "已复制"}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RunbookSlot({ model, onCopyCommand, onOpenSource, onSendToTerminal }) {
  const [copiedCommandId, setCopiedCommandId] = useState("");
  const [copyErrorId, setCopyErrorId] = useState("");
  const copyCommand = async (item) => {
    setCopyErrorId("");
    try {
      await onCopyCommand(item.command);
      setCopiedCommandId(item.id);
    } catch {
      setCopiedCommandId("");
      setCopyErrorId(item.id);
    }
  };
  return (
    <section className="workspaceFacts projectOverviewSurface runbookSurface">
      <OverviewPageHeader
        title="启动方式"
        description={model.description}
        sources={<div className="overviewSourceButtons">{model.sources.slice(0, 5).map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
        status={<Badge>{model.status}</Badge>}
      />
      <OverviewSection title="运行环境" subtitle="工作目录与依赖" items={[
        { id: "directory", label: "工作目录", className: "overviewSectionItem-mono", content: model.context.workingDirectory },
        { id: "requirements", label: "环境要求", content: model.context.requirements.length ? <OverviewTagList items={model.context.requirements} /> : <span className="runbookEmptyValue">尚未识别</span> },
      ]} />
      <OverviewSection title="启动入口" subtitle={`${model.readiness.startCount} 个已确认入口`} items={[{
        id: "start-commands",
        content: <RunbookCommandList commands={model.startCommands} copiedCommandId={copiedCommandId} copyErrorId={copyErrorId} onCopy={copyCommand} onSendToTerminal={onSendToTerminal} />,
      }]} />
    </section>
  );
}

export function RunbookPanel({ onCopyCommand, onOpenSource, onSendToTerminal, report, snapshot }) {
  const store = buildProjectFactStore({ report, snapshot });
  const descriptors = compileRunbookSlots({
    capabilityManifest: snapshot?.projectCapabilities,
    components: { RunbookSlot },
    contract: projectRunbookContract,
    store,
  });
  return descriptors.map((descriptor) => <descriptor.component key={descriptor.id} model={descriptor.props} onCopyCommand={onCopyCommand} onOpenSource={onOpenSource} onSendToTerminal={onSendToTerminal} />);
}

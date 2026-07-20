import { Badge } from "../ui/badge";

export function AgentTopicCapabilitySummary({ cards, capabilityKind, capabilitySpec, canPreviewFile, compact, onOpenFile }) {
  if (compact) return null;
  return (
    <>
      <div className="agentTopicPanel">
        {cards.map(([label, value]) => <div className="agentTopicCard" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {capabilitySpec ? (
        <div className="agentConfigCapability">
          <div className="agentConfigCapabilityHeader"><div><span>{capabilityKind}</span><strong>{capabilitySpec.title}</strong><p>{capabilitySpec.value}</p></div><Badge status={capabilitySpec.tone}>{capabilitySpec.status}</Badge></div>
          <div className="agentConfigCapabilityGrid"><section><span>对新项目的作用</span><p>{capabilitySpec.value}</p></section><section><span>下一步动作</span><p>{capabilitySpec.next}</p></section></div>
          <div className="agentConfigFiles"><span>来源文件</span><div>{capabilitySpec.files.slice(0, 8).map((file) => canPreviewFile(file) ? <button key={file} type="button" onClick={() => onOpenFile?.(file)}>{file}</button> : <code key={file}>{file}</code>)}</div></div>
        </div>
      ) : null}
    </>
  );
}

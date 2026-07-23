import { useState } from "react";
import { designImplementationTopics, governanceFileHealthLabel, governanceFileHealthSummary, governanceStatusSummaryText } from "../../lib/governance-presentation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { ReadonlyFilePreview } from "./readonly-file-preview";

export function GovernanceFilesHealthSection({ onCreateGovernanceTask, onReadEngineeringFile, report }) {
  const [openDomainId, setOpenDomainId] = useState("");
  const [governanceFile, setGovernanceFile] = useState(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState("");
  const governanceDomains = Array.isArray(report?.governanceDomains) ? report.governanceDomains : [];
  const health = governanceFileHealthSummary(governanceDomains);
  const fileStatusesForDomain = (domain) => {
    const files = Array.isArray(domain.files) ? domain.files : [];
    return Array.isArray(domain.fileStatuses)
      ? domain.fileStatuses
      : files.map((file) => ({
        path: file,
        previewable: !file.includes("*") && !file.endsWith("/"),
        status: file.includes("*") || file.endsWith("/") ? "ignored" : "found",
      }));
  };
  const selectStatusFilter = (status) => {
    const nextStatus = activeStatusFilter === status ? "" : status;
    setActiveStatusFilter(nextStatus);
    setGovernanceFile(null);
    if (!nextStatus) return;
    const firstDomain = governanceDomains.find((domain) =>
      fileStatusesForDomain(domain).some((file) => (file.status || "found") === nextStatus)
    );
    if (firstDomain) setOpenDomainId(firstDomain.id);
  };
  const actionHints = [
    health.missing ? `先补 ${health.missing} 个缺失文件` : "",
    health.changed ? `再审阅 ${health.changed} 个本地变更` : "",
    health.stale ? `复查 ${health.stale} 个可能过期文件` : "",
    health.ignored ? `${health.ignored} 个规则/目录通常只需确认边界` : "",
  ].filter(Boolean);
  const selectedFileStatuses = governanceDomains.flatMap((domain) =>
    fileStatusesForDomain(domain)
      .filter((file) => !activeStatusFilter || (file.status || "found") === activeStatusFilter)
      .map((file) => ({
        domainId: domain.id,
        domainTitle: domain.title,
        path: file.path || file,
        previewable: file.previewable,
        status: file.status || "found",
      }))
  );
  const canCreateTask = ["missing", "changed", "stale"].includes(activeStatusFilter) && selectedFileStatuses.length > 0;
  const createTaskLabel = {
    changed: "生成审阅任务",
    missing: "生成补齐任务",
    stale: "生成同步任务",
  }[activeStatusFilter] || "生成处理任务";
  const previewGovernanceFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) {
      setGovernanceFile({ error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。", path });
      return;
    }
    setGovernanceFile({ loading: true, path });
    try {
      const preview = await onReadEngineeringFile(path);
      setGovernanceFile({ path, preview });
    } catch (err) {
      setGovernanceFile({ error: err instanceof Error ? err.message : String(err), path });
    }
  };

  return (
    <section className="workspaceGovernanceFiles">
      <header><div><strong>治理文件健康状态</strong><p>按治理域查看真实文件状态，优先处理缺失、过期和本地变更。</p></div><Badge>{health.label}</Badge></header>
      <div className="workspaceGovernanceHealthGrid">
        {[["found", "正常"], ["changed", "有本地变更"], ["missing", "缺失"], ["stale", "可能过期"], ["generated", "生成产物"], ["ignored", "规则/目录"]].map(([status, label]) => (
          <button className={`workspaceGovernanceHealthCard status-${status}${activeStatusFilter === status ? " active" : ""}`} disabled={!health[status]} key={status} type="button" onClick={() => selectStatusFilter(status)}><span>{label}</span><strong>{health[status] || 0}</strong></button>
        ))}
      </div>
      <div className="workspaceGovernanceActions"><div><strong>建议处理顺序</strong><p>{actionHints.length ? actionHints.join("，") : "当前治理文件状态稳定，保持同步即可。"}</p></div>{activeStatusFilter ? <div className="workspaceGovernanceActionButtons">{canCreateTask ? <Button size="sm" variant="primary" type="button" onClick={() => onCreateGovernanceTask?.({ files: selectedFileStatuses, status: activeStatusFilter })}>{createTaskLabel}</Button> : null}<Button size="sm" variant="subtle" type="button" onClick={() => setActiveStatusFilter("")}>查看全部</Button></div> : null}</div>
      <div className="workspaceGovernanceDomainRows">
        {governanceDomains.map((domain) => {
          const fileStatuses = fileStatusesForDomain(domain);
          const visibleFileStatuses = activeStatusFilter ? fileStatuses.filter((file) => (file.status || "found") === activeStatusFilter) : fileStatuses;
          if (activeStatusFilter && !visibleFileStatuses.length) return null;
          const isOpen = openDomainId === domain.id;
          return <div className="workspaceGovernanceDomain" key={domain.id || domain.title}><button className="workspaceGovernanceDomainButton" type="button" onClick={() => setOpenDomainId(isOpen ? "" : domain.id)}><span>{domain.title}</span><small>{governanceStatusSummaryText(domain.statusSummary, fileStatuses.length)}</small></button>{isOpen ? <div className="workspaceGovernanceFileList">{visibleFileStatuses.map((file) => { const path = file.path || file; const isPreviewable = file.previewable ?? (!path.includes("*") && !path.endsWith("/")); return <button className={`workspaceGovernanceFile status-${file.status || "found"}${governanceFile?.path === path ? " active" : ""}`} disabled={!isPreviewable} key={path} type="button" onClick={() => previewGovernanceFile(path)}><span>{path}</span><small>{governanceFileHealthLabel(file.status)}</small></button>; })}</div> : null}</div>;
        })}
      </div>
      <ReadonlyFilePreview file={governanceFile} />
    </section>
  );
}

export function DesignImplementationHealthSection({ onCreateDesignGovernanceTask, onReadEngineeringFile, report, topic }) {
  const [activeStatusFilter, setActiveStatusFilter] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const designDomain = (Array.isArray(report?.governanceDomains) ? report.governanceDomains : []).find((domain) => domain.id === "design-implementation" || domain.title === "设计实现");
  const allFiles = Array.isArray(designDomain?.fileStatuses) ? designDomain.fileStatuses : [];
  const topicConfig = designImplementationTopics[topic?.id] || null;
  const topicFiles = topicConfig ? allFiles.filter((file) => topicConfig.files.some((pattern) => { const path = file.path || ""; return pattern.endsWith("/") ? path.startsWith(pattern) : path === pattern; })) : allFiles;
  const visibleFiles = activeStatusFilter ? topicFiles.filter((file) => (file.status || "found") === activeStatusFilter) : topicFiles;
  const health = governanceFileHealthSummary([{ fileStatuses: topicFiles }]);
  const riskFiles = topicFiles.filter((file) => ["missing", "changed", "stale"].includes(file.status || "found"));
  const actionableFiles = activeStatusFilter ? visibleFiles.filter((file) => ["missing", "changed", "stale"].includes(file.status || "found")) : riskFiles;
  const actionHint = riskFiles.length ? `发现 ${riskFiles.length} 个需要确认的设计实现资产，建议生成治理任务进入 Patch / 验证闭环。` : "当前设计实现资产状态稳定，后续可继续接入一致性检查。";
  const previewDesignFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) { setPreviewFile({ error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。", path }); return; }
    setPreviewFile({ loading: true, path });
    try { const preview = await onReadEngineeringFile(path); setPreviewFile({ path, preview }); } catch (err) { setPreviewFile({ error: err instanceof Error ? err.message : String(err), path }); }
  };
  return (
    <section className="workspaceGovernanceFiles">
      <header><div><strong>设计实现健康状态</strong><p>把架构、契约、界面规范和实现结构接到同一套治理任务闭环。</p></div><Badge>{health.riskCount ? `${health.riskCount} 项需确认` : "设计实现稳定"}</Badge></header>
      <div className="workspaceGovernanceHealthGrid">{[["found", "正常"], ["changed", "有本地变更"], ["missing", "缺失"], ["stale", "可能过期"]].map(([status, label]) => <button className={`workspaceGovernanceHealthCard status-${status}${activeStatusFilter === status ? " active" : ""}`} disabled={!health[status]} key={status} type="button" onClick={() => setActiveStatusFilter(activeStatusFilter === status ? "" : status)}><span>{label}</span><strong>{health[status] || 0}</strong></button>)}</div>
      <div className="workspaceGovernanceActions"><div><strong>建议动作</strong><p>{actionHint}</p></div><div className="workspaceGovernanceActionButtons"><Button disabled={!actionableFiles.length} size="sm" variant="primary" type="button" onClick={() => onCreateDesignGovernanceTask?.({ files: actionableFiles.map((file) => ({ ...file, domainTitle: designDomain?.title || "设计实现" })), topic })}>生成治理任务</Button>{activeStatusFilter ? <Button size="sm" variant="subtle" type="button" onClick={() => setActiveStatusFilter("")}>查看全部</Button> : null}</div></div>
      <div className="workspaceGovernanceFileList">{visibleFiles.length ? visibleFiles.map((file) => { const path = file.path || file; const isPreviewable = file.previewable ?? (!path.includes("*") && !path.endsWith("/")); return <button className={`workspaceGovernanceFile status-${file.status || "found"}${previewFile?.path === path ? " active" : ""}`} disabled={!isPreviewable} key={path} type="button" onClick={() => previewDesignFile(path)}><span>{path}</span><small>{governanceFileHealthLabel(file.status)}</small></button>; }) : <Notice variant="info">当前入口还没有匹配到设计实现资产。</Notice>}</div>
      <ReadonlyFilePreview file={previewFile} />
    </section>
  );
}

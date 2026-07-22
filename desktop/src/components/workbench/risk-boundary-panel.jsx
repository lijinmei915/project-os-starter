import { FileText } from "lucide-react";
import { Badge } from "../ui/badge";
import { Notice } from "../ui/notice";
import { OverviewPageHeader, OverviewSection } from "./overview-section";

export function RiskBoundaryPanel({ onOpenSource, report, snapshot }) {
  const boundary = report?.summary?.riskBoundary || report?.project?.riskBoundary || {};
  const summaryRisks = Array.isArray(report?.findings?.risks) ? report.findings.risks : [];
  const profileRisks = Array.isArray(snapshot?.projectProfile?.fields?.["memory.risks"]?.value)
    ? snapshot.projectProfile.fields["memory.risks"].value.map((body) => ({ body, severity: "medium", title: "项目约束" }))
    : [];
  const risks = (summaryRisks.length ? summaryRisks : profileRisks).slice(0, 3);
  const sources = [...new Set([...(boundary.sources || []), ...risks.flatMap((risk) => risk.sources || [])])].slice(0, 5);
  const status = risks.length ? "需关注" : "暂无项目风险";

  return (
    <section className="overviewSurface riskBoundarySurface">
      <OverviewPageHeader
        description={boundary.body || "集中查看会影响项目推进的已知风险，以及当前阶段明确不覆盖的范围。"}
        meta={<span>{boundary.status === "confirmed" ? "已确认" : "基于项目事实"}</span>}
        sources={sources.length ? <div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div> : null}
        status={<Badge status={risks.length ? "waiting" : "done"}>{status}</Badge>}
        title="风险边界"
      />
      <OverviewSection
        subtitle={risks.length ? `${risks.length} 项需要持续关注` : "当前未发现需要处理的项目级风险"}
        title="已知风险"
        items={[{
          id: "known-risks",
          content: risks.length ? <div className="riskBoundaryList">{risks.map((risk) => <article key={`${risk.title}-${risk.body}`}><div><strong>{risk.title || "未命名风险"}</strong><Badge status={risk.severity === "high" ? "failed" : risk.severity === "low" ? "planned" : "waiting"}>{risk.severity === "high" ? "高" : risk.severity === "low" ? "低" : "中"}</Badge></div><p>{risk.body}</p></article>)}</div> : <Notice variant="success">当前项目没有记录需要处理的风险。</Notice>,
        }]}
      />
      <OverviewSection
        subtitle="不在这里执行或重复展示，由对应页面承接"
        title="当前边界"
        items={[
          { id: "execution-boundary", label: "任务与验证", content: "失败任务、运行日志和修复动作进入执行结果。" },
          { id: "asset-boundary", label: "文件健康", content: "缺失、变更和过期文件进入治理文件。" },
          { id: "security-boundary", label: "安全与权限", content: "确认动作、密钥和命令限制进入安全边界。" },
        ]}
      />
    </section>
  );
}

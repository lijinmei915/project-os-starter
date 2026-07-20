import { Badge } from "../ui/badge";
import { Panel } from "../ui/panel";

export function PatchDraft({ className, draft }) {
  const files = Array.isArray(draft?.files) ? draft.files : [];
  const notApplicable = draft?.notApplicable === true;
  return <Panel className={`patchDraft${className ? ` ${className}` : ""}`} variant="default" padding="none">
    <div className="patchSummary"><strong>{notApplicable ? "当前不生成文件改动" : "AI 建议的改动"}</strong><span>{draft?.summary || "已生成改动建议，尚未写入文件。"}</span>{files.length ? <div className="patchFiles" aria-label="涉及文件"><b>涉及文件</b>{files.map((file) => <code key={file}>{file}</code>)}</div> : null}{draft?.guardrails?.length ? <span>{draft.guardrails.join(" · ")}</span> : null}</div>
    {!notApplicable ? <details className="patchDiff" open><summary>改前改后</summary><pre>{draft?.diff || "尚未生成可查看的改动内容。"}</pre></details> : null}
  </Panel>;
}

export function ReadonlyPlan({ className, plan = {}, statusLabel = "计划待确认" }) {
  const confirmed = statusLabel === "已确认";
  return <Panel as="article" className={`readonlyPlan${confirmed ? " readonlyPlan-confirmed" : ""}${className ? ` ${className}` : ""}`} variant="soft"><div className="planHeader"><div><strong>{confirmed ? "本轮结论" : "执行计划"}</strong><span>{plan.projectName || "当前项目"}</span></div><Badge variant={confirmed ? "success" : "warning"}>{statusLabel}</Badge></div><p>{plan.summary || "已整理为可执行任务，等待确认后开始。"}</p><details className="readonlyPlanEvidence" open={!confirmed}><summary>{confirmed ? "查看计划与执行边界" : "计划与执行边界"}</summary><div className="planColumns"><PlanList title="执行步骤" items={plan.steps} /><PlanList title="读取范围" items={plan.filesToRead} /><PlanList title="可能改动" items={plan.candidateChanges} /><PlanList title="验收标准" items={plan.checks} mono /><PlanList title="边界与风险" items={plan.guardrails} /></div></details></Panel>;
}

function PlanList({ title, items, mono }) {
  const safeItems = Array.isArray(items) ? items : [];
  return <div className="planList"><strong>{title}</strong><ul className={mono ? "monoList" : undefined}>{safeItems.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

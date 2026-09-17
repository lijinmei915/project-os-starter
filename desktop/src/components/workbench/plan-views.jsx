import { CheckCircle2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Panel } from "../ui/panel";
import { SectionTitle } from "../ui/section-title";
import { taskExecutionBoundaries } from "../../lib/task-execution-mode";

export function PatchDraft({ className, draft }) {
  const files = Array.isArray(draft?.files) ? draft.files : [];
  const notApplicable = draft?.notApplicable === true;
  return <Panel className={`patchDraft${className ? ` ${className}` : ""}`} variant="default" padding="none">
    <div className="patchSummary"><strong>{notApplicable ? "当前不生成文件改动" : "AI 建议的改动"}</strong><span>{draft?.summary || "已生成改动建议，尚未写入文件。"}</span>{files.length ? <div className="patchFiles" aria-label="涉及文件"><b>涉及文件</b>{files.map((file) => <code key={file}>{file}</code>)}</div> : null}{draft?.guardrails?.length ? <span>{draft.guardrails.join(" · ")}</span> : null}</div>
    {!notApplicable ? <details className="patchDiff" open><summary>改前改后</summary><pre>{draft?.diff || "尚未生成可查看的改动内容。"}</pre></details> : null}
  </Panel>;
}

export function ReadonlyPlan({ className, decisionActions = [], onDecisionAction, onSelectRecommendation, plan = {}, statusLabel = "计划待确认", variant = "full" }) {
  const confirmed = statusLabel === "已确认";
  const recommendations = Array.isArray(plan.recommendedNextSteps) ? plan.recommendedNextSteps : [];
  const nextAction = decisionActions[0]?.nextAction;
  const decisionTitle = nextAction?.label ? `是否${nextAction.label}？` : "是否继续下一步？";
  const decisionBoundary = nextAction?.id === "run-check"
    ? "确认后会运行已允许的基础检查，不会修改项目文件。"
    : nextAction?.id === "open-topic"
      ? "确认后只打开任务详情，不会修改文件或运行命令。"
      : "确认后只生成可审查的改动草稿；真正写入文件和运行检查时，仍会再询问你。";
  const actualReads = (Array.isArray(plan.agentEvents) ? plan.agentEvents : [])
    .filter((event) => (event?.kind === "tool-call" && ["read_file", "search_project", "list_files", "git_status"].includes(event?.details?.name)) || (event?.kind === "model" && event?.phase === "vision-context" && event?.status === "succeeded"))
    .map((event) => {
      if (event.phase === "vision-context") return `理解 ${event.details?.attachmentCount || 1} 张图片（未保存原图和摘要正文）`;
      if (event.details.name === "read_file") return `读取 ${event.details.path || "相关文件"}`;
      if (event.details.name === "search_project") return "查找相关实现";
      if (event.details.name === "git_status") return "确认项目改动状态";
      return "查看项目文件";
    });
  const evidence = <div className="planColumns">{actualReads.length ? <PlanList title="实际查看记录" items={actualReads} mono /> : null}<PlanList title="执行步骤" items={plan.steps} /><PlanList title="读取范围" items={plan.filesToRead} />{Array.isArray(plan.requiredFiles) && plan.requiredFiles.length ? <PlanList title="必须改动" items={plan.requiredFiles} mono /> : null}<PlanList title="可能改动" items={plan.candidateChanges} /><PlanList title="验收标准" items={plan.checks} mono /><PlanList title="边界与风险" items={plan.guardrails} /></div>;

  if (variant === "conversation") {
    if (confirmed) {
      return <div className={`conversationPlanResult${className ? ` ${className}` : ""}`}>
        <div className="conversationPlanComplete">
          <CheckCircle2 aria-hidden="true" />
          <span>计划已确认，后续写入文件和运行检查仍会分别询问你。</span>
        </div>
        <details className="conversationPlanEvidence"><summary>查看原计划</summary>{evidence}</details>
      </div>;
    }

    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    return <div className={`conversationPlanResult${className ? ` ${className}` : ""}`}>
      <div className="conversationPlanNarrative">
        <p>{plan.summary || "我会先整理这项工作的处理方案，再等你决定是否开始。"}</p>
        {steps.length ? <div className="conversationPlanSteps"><strong>具体准备：</strong><ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol></div> : null}
        <details className="conversationPlanEvidence"><summary>查看涉及文件和验收方式</summary>{evidence}</details>
      </div>
      <Panel aria-label="下一步确认" as="section" className="conversationPlanDecision" variant="soft" padding="none">
        <div className="conversationPlanDecisionHeader">
          <div><strong>{recommendations.length ? "选择下一步" : decisionTitle}</strong><span>{plan.projectName || "当前项目"}</span></div>
          <Badge variant="info">当前未改文件</Badge>
        </div>
        {recommendations.length
          ? <NextStepRecommendations items={recommendations} onSelect={onSelectRecommendation} />
          : <p>{decisionBoundary}</p>}
        {decisionActions.length ? <div className="conversationPlanDecisionActions">
          {decisionActions.map((action, index) => <Button key={action.id} size="sm" type="button" variant={index === 0 ? "primary" : "secondary"} onClick={() => onDecisionAction?.(action)}>{action.label}</Button>)}
        </div> : null}
      </Panel>
    </div>;
  }

  if (confirmed) {
    return <Panel as="article" className={`readonlyPlan readonlyPlan-confirmed${className ? ` ${className}` : ""}`} variant="soft">
      <div className="confirmedPlanHeader">
        <CheckCircle2 aria-hidden="true" />
        <div><strong>计划已确认</strong><span>{plan.projectName || "当前项目"}</span></div>
      </div>
      <p>{plan.summary || "计划已经确认，执行过程仍会遵守独立审批和检查边界。"}</p>
      <details className="readonlyPlanEvidence"><summary>查看原计划</summary>{evidence}</details>
    </Panel>;
  }

  return <Panel as="article" className={`readonlyPlan${className ? ` ${className}` : ""}`} variant="soft">
    <div className="planHeader">
      <div><strong>只读计划已准备好</strong><span>{plan.projectName || "当前项目"}</span></div>
      <Badge variant="info">当前未改文件</Badge>
    </div>
    <ol className="planBoundaryFlow" aria-label="后续操作与确认边界">
      {taskExecutionBoundaries.map((step, index) => <li className={index === 0 ? "current" : "pending"} key={step.id}>
        <span aria-hidden="true">{index + 1}</span>
        <div><strong>{step.label}</strong><p>{step.detail}</p></div>
      </li>)}
    </ol>
    <div className="planDecisionSummary">
      <div>
        <SectionTitle className="planDecisionTitle" title="准备怎么做" />
        <p>{plan.summary || "我会先整理这项工作的处理方案，再等你决定是否开始。"}</p>
      </div>
      {recommendations.length ? <NextStepRecommendations items={recommendations} onSelect={onSelectRecommendation} /> : <div>
        <SectionTitle className="planDecisionTitle" title="确认后会发生什么" />
        <p>下一步只生成可审查的改动草稿；写入文件和运行检查仍会分别询问你。</p>
      </div>
      }
    </div>
    <details className="readonlyPlanEvidence"><summary>查看技术细节（步骤、文件和检查方式）</summary>{evidence}</details>
  </Panel>;
}

function NextStepRecommendations({ items, onSelect }) {
  return <div className="planRecommendations">
    <SectionTitle className="planDecisionTitle" title="建议先做哪一项" />
    <p>选择一项后，我会再为它整理具体计划。</p>
    <ol>
      {items.map((item) => <li key={item.id || item.title}>
        <div>
          <strong>{item.title || "未命名建议"}</strong>
          <p>{item.reason || "这是当前项目中尚未完成的工作。"}</p>
          <span>完成后：{item.expectedOutcome || "会得到可查看的结果和下一步。"}</span>
        </div>
        {onSelect ? <Button size="sm" type="button" variant="secondary" onClick={() => onSelect(item)}>选这项</Button> : null}
      </li>)}
    </ol>
  </div>;
}

function PlanList({ title, items, mono }) {
  const safeItems = Array.isArray(items) ? items : [];
  return <div className="planList"><SectionTitle title={title} /><ul className={mono ? "monoList" : undefined}>{safeItems.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

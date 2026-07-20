import { PatchDraft } from "./plan-views";
import { TaskCommandBar } from "./task-command-bar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { taskExecutionFlow, taskNextAction } from "../../lib/task-next-action";

function previewItems(items = [], limit = 3) {
  return items.filter(Boolean).slice(0, limit);
}

function TaskEvidenceTimeline({ items = [] }) {
  if (!items.length) return null;
  return <details className="taskDetailReference" open><summary>执行证据</summary><ol className="taskEvidenceTimeline">{items.slice(-12).map((item, index) => <li key={`${item.at || item.recordedAt || index}-${item.kind || item.phase || "event"}`}><strong>{item.kind || item.phase || "记录"}</strong><span>{item.summary || "已记录执行状态。"}</span>{item.details && Object.keys(item.details).length ? <details><summary>查看详情</summary><pre>{JSON.stringify(item.details, null, 2)}</pre></details> : null}</li>)}</ol></details>;
}

export function AgentTopicCurrentTaskDetail({ currentTask, currentChecks, currentPlan, failureSummaryForTask, goalTitleForTask, onApplyPatchDraft, onGeneratePatchDraft, onMergeHandoff, onOpenTask, onRunChecks, recentResultTasks, runnerLoadingId, taskStatusLabel }) {
  if (!currentTask) return null;
  const next = taskNextAction(currentTask);
  const executeNextAction = () => {
    if (next.action === "generate-draft") onGeneratePatchDraft?.(currentTask.id);
    if (next.action === "apply-draft") onApplyPatchDraft?.(currentTask.id);
    if (next.action === "open-task") onOpenTask?.(currentTask.id);
    if (next.action === "run-check") onRunChecks?.(currentTask);
    if (next.action === "merge-handoff") onMergeHandoff?.(currentTask.id);
  };

  return <div className="agentTopicDetail">
    <div className="agentTopicDetailHeader"><div><strong>{currentTask.title || "暂无选中的任务"}</strong><span>目标：{goalTitleForTask(currentTask)}</span></div><Badge status={taskStatusLabel(currentTask.status)}>{taskStatusLabel(currentTask.status)}</Badge></div>
    <section className="taskNextAction" aria-label="当前该做什么"><span>当前该做什么</span><strong>{next.label}</strong><p>{next.detail}</p>{next.action !== "none" ? <Button type="button" variant="primary" onClick={executeNextAction}>{next.label}</Button> : null}</section>
    {currentTask.patchDraft ? <section className="taskDraftReview" aria-label="AI 建议的改动"><div className="runnerHeader"><strong>AI 建议的改动</strong><span>尚未写入文件</span></div><PatchDraft draft={currentTask.patchDraft} /></section> : null}
    <ol className="taskExecutionFlow" aria-label="任务执行步骤">{taskExecutionFlow(currentTask).map((step) => <li className={step.status} key={step.id}><span aria-hidden="true" /><strong>{step.label}</strong></li>)}</ol>
    <TaskEvidenceTimeline items={currentTask.executionEvidence} />
    <details className="taskDetailReference"><summary>查看任务内容与验证项</summary><div className="agentExecutionGrid"><div><span>计划步骤</span><ul>{previewItems(currentPlan.steps).map((step) => <li key={step}>{step}</li>)}{!previewItems(currentPlan.steps).length ? <li>暂无步骤</li> : null}</ul></div><div><span>候选改动</span><ul>{previewItems(currentPlan.candidateChanges).map((item) => <li key={item}>{item}</li>)}{!previewItems(currentPlan.candidateChanges).length ? <li>暂无候选改动</li> : null}</ul></div><div><span>验证检查</span><ul>{currentChecks.slice(0, 3).map((check) => <li key={check.id}>{check.label}</li>)}{!currentChecks.length ? <li>暂无可运行检查</li> : null}</ul></div></div></details>
  </div>;
}

export function AgentTopicExecutionResults({ agentRuns = [], failedRunsForTask, failureSummaryForTask, onApproveAgentRun, onCreateRepairTask, onOpenTask, onResumeAgentRun, onRerunFailedChecks, recentResultTasks, runnerLoadingId, taskStatuses, taskStatusLabel }) {
  return <div className="agentTopicList">
    {agentRuns.length ? <section className="agentPatchItem agentRunHistory"><div className="agentPatchItemHeader"><div><strong>Agent 运行记录</strong><span>Hermes / 本地执行器</span></div><Badge>只读</Badge></div>{agentRuns.slice(0, 8).map((run) => <div className="agentTopicStatusLine" key={run.id}><span>{run.executorId || "Agent"} · {run.status}</span><span>第 {run.step || 0}/{run.maxSteps || 20} 步 · {run.summary || "暂无摘要"}</span>{run.status === "interrupted" ? <Button size="sm" type="button" variant="outline" onClick={() => onResumeAgentRun?.(run)}>恢复执行</Button> : null}{run.status === "awaiting-approval" ? <Button size="sm" type="button" variant="primary" onClick={() => onApproveAgentRun?.(run)}>批准并继续</Button> : null}{run.evidence?.length ? <details><summary>查看证据</summary><pre>{JSON.stringify(run.evidence, null, 2)}</pre></details> : null}</div>)}</section> : null}
    {recentResultTasks.length ? recentResultTasks.map((task) => <div className="agentPatchItem" key={task.id}>
      <div className="agentPatchItemHeader"><div><strong>{task.title}</strong><span>{task.runSummary?.path || task.createdAt || "暂无 run summary"}</span></div><Badge status={taskStatusLabel(task.status)}>{taskStatusLabel(task.status)}</Badge></div>
      <div className="agentTopicStatusLine"><span>{task.verificationSummary || "未记录验证摘要"}</span><span>{task.handoffMerge ? "交接已更新" : "交接未更新"}</span></div>
      {[taskStatuses.failed, taskStatuses.repairPending, taskStatuses.repairFailed].includes(task.status) ? <div className="agentFailureBox"><strong>失败摘要</strong><p>{failureSummaryForTask(task)}</p><div className="agentTopicStatusLine">{failedRunsForTask(task).length ? failedRunsForTask(task).slice(0, 3).map((run) => <span key={`${task.id}-${run.id}-${run.finishedAt || run.command}`}>{run.label || run.id || run.command || "失败检查"}</span>) : <span>暂无失败检查明细</span>}</div><TaskEvidenceTimeline items={task.executionEvidence} /></div> : null}
      <TaskCommandBar actions={[{ key: `result-open-${task.id}`, label: "查看任务", onClick: () => onOpenTask?.(task.id) }, { disabled: ![taskStatuses.failed, taskStatuses.repairPending].includes(task.status) || Boolean(runnerLoadingId), key: `result-rerun-${task.id}`, label: runnerLoadingId ? "重跑中" : "重跑失败检查", onClick: () => onRerunFailedChecks?.(task) }, { disabled: ![taskStatuses.failed, taskStatuses.repairPending].includes(task.status), key: `result-repair-${task.id}`, label: task.status === taskStatuses.repairPending ? "生成修复草稿" : "准备修复", variant: "primary", onClick: () => onCreateRepairTask?.(task.id) }]} meta={[taskStatuses.failed, taskStatuses.repairPending].includes(task.status) ? "修复保留在当前任务中；草稿、写入和检查仍各自等待确认。" : "已完成任务保留结果追溯。"} />
    </div>) : <Notice variant="info">暂无已完成或失败的执行结果。</Notice>}
  </div>;
}

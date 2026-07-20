import { Badge } from "../ui/badge";
import { Notice } from "../ui/notice";
import { Panel } from "../ui/panel";
import { PatchDraft, ReadonlyPlan } from "./plan-views";
import { TaskCommandBar } from "./task-command-bar";

// This surface receives task actions and status lookups from the Task domain.
// It intentionally has no knowledge of the workbench container or runtime clients.
export function ActiveTask({
  task,
  runnerLoadingId,
  runnerError,
  patchLoading,
  patchError,
  applyLoading,
  applyError,
  handoffLoading,
  handoffError,
  failedStatus,
  getRunnableChecks,
  getStatusLabel,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunGuardedCheck,
  onSelectConversation,
  onBackToProgress,
}) {
  const runnableChecks = getRunnableChecks(task.plan);
  const statusLabel = getStatusLabel(task.status);
  const draftActions = [
    {
      disabled: patchLoading,
      key: "generate-patch",
      label: patchLoading ? "生成中" : task.patchDraft ? "重新生成改动" : "生成改动",
      onClick: () => onGeneratePatchDraft(task.id),
      variant: task.patchDraft ? "default" : "primary",
    },
    {
      disabled: applyLoading || !task.patchDraft,
      key: "apply-patch",
      label: applyLoading ? "应用中" : "确认应用改动",
      onClick: () => onApplyPatchDraft(task.id),
      variant: task.patchDraft ? "primary" : "default",
    },
    {
      disabled: handoffLoading || !task.runSummary || Boolean(task.handoffMerge),
      key: "merge-handoff",
      label: handoffLoading ? "合并中" : task.handoffMerge ? "已更新交接" : "更新交接",
      onClick: () => onMergeHandoff(task.id),
    },
  ];
  const checkActions = runnableChecks.slice(0, 2).map((check) => ({
    disabled: Boolean(runnerLoadingId),
    key: check.id,
    label: runnerLoadingId === check.id ? "运行中" : check.label,
    onClick: () => onRunGuardedCheck(task.id, check.id),
  }));

  return (
    <Panel as="article" className="activeTask" variant="soft">
      <div className="activeTaskBreadcrumb">
        <button type="button" onClick={onBackToProgress}>返回当前进度</button>
        <span>任务详情</span>
      </div>
      <div className="activeTaskHeader">
        <div>
          <strong>{task.title}</strong>
          <span>{task.projectName} · {task.createdAt}</span>
          {task.goalTitle || task.conversationId ? (
            <span className="activeTaskSource">
              {task.goalTitle ? `来自目标：${task.goalTitle}` : null}
              {task.goalTitle && task.conversationId ? " · " : null}
              {task.conversationId ? "来自对话" : null}
            </span>
          ) : null}
        </div>
        <Badge status={statusLabel}>{statusLabel}</Badge>
      </div>
      {task.conversationId ? (
        <div className="activeTaskInlineActions">
          <button type="button" onClick={() => onSelectConversation?.(task.conversationId)}>
            回到对话
          </button>
        </div>
      ) : null}
      <div className="activeTaskPrimaryActions">
        <TaskCommandBar
          actions={task.patchDraft ? checkActions : [draftActions[0]]}
          meta={task.patchDraft?.files?.length
            ? `已生成 ${task.patchDraft.files.length} 个文件的 AI 建议。`
            : "先生成改动，再应用和验证。"}
        />
      </div>
      {patchError ? <Notice className="planError" variant="danger">{patchError}</Notice> : null}
      {applyError ? <Notice className="planError" variant="danger">{applyError}</Notice> : null}
      {handoffError ? <Notice className="planError" variant="danger">{handoffError}</Notice> : null}
      {runnerError ? <Notice className="planError" variant="danger">{runnerError}</Notice> : null}
      {task.applyResult ? <Notice className="providerSuccess" variant="success">{task.applyResult.message}</Notice> : null}
      {task.verificationSummary ? (
        <Notice className={task.status === failedStatus ? "providerError" : "providerSuccess"} variant={task.status === failedStatus ? "danger" : "success"}>
          {task.verificationSummary}
        </Notice>
      ) : null}
      <ReadonlyPlan plan={task.plan} />
      {task.patchDraft ? (
        <Panel className="diffPanel" variant="info">
          <div className="runnerHeader">
            <strong>AI 建议的改动</strong>
            <span>尚未写入文件</span>
          </div>
          <PatchDraft draft={task.patchDraft} />
          <TaskCommandBar actions={[draftActions[1]]} meta="看完改前改后，确认无误后才会应用并自动验证。" />
        </Panel>
      ) : null}
      <details className="executionTools">
        <summary>高级详情</summary>
        {task.runSummary ? <Notice className="providerHint" variant="info">{task.runSummary.message}：{task.runSummary.path}</Notice> : null}
        {task.handoffMerge ? <Notice className="providerSuccess" variant="success">{task.handoffMerge.message}：{task.handoffMerge.path}</Notice> : null}
        <TaskCommandBar actions={[draftActions[2]]} meta="验证完成后可更新交接记录。" />
        <Panel className="runnerPanel" variant="code">
          <div className="runnerHeader">
            <strong>检查</strong>
            <span>只运行已允许的命令</span>
          </div>
          <TaskCommandBar
            actions={runnableChecks.map((check) => ({
              disabled: Boolean(runnerLoadingId),
              key: check.id,
              label: runnerLoadingId === check.id ? "运行中" : check.label,
              onClick: () => onRunGuardedCheck(task.id, check.id),
            }))}
          >
            {runnableChecks.length ? null : <span>当前没有可运行的检查。</span>}
          </TaskCommandBar>
          {runnerError ? <Notice className="planError" variant="danger">{runnerError}</Notice> : null}
          {task.runs?.length ? (
            <div className="runnerResults">
              {task.runs.map((run) => (
                <div className={`runnerResult ${run.success ? "success" : "failed"}`} key={`${run.id}-${run.finishedAt}`}>
                  <div>
                    <strong>{run.label}</strong>
                    <span>{run.command}</span>
                  </div>
                  <em>{run.success ? "通过" : `失败 ${run.code ?? ""}`}</em>
                  <pre>{run.output || "No output."}</pre>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      </details>
    </Panel>
  );
}

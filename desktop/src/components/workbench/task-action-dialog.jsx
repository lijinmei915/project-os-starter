import React from "react";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent } from "../ui/dialog";
import { Notice } from "../ui/notice";
import { taskNextAction } from "../../lib/task-next-action";

function previewItems(items = [], limit = 3) {
  return items.filter(Boolean).slice(0, limit);
}

export function TaskActionDialog({
  action,
  failureSummary,
  goalTitle,
  modelAvailable,
  modelChecking,
  mutationError,
  onAdjust,
  onClose,
  onConfirmStart,
  onExecuteDetail,
  onOpenTask,
  onRepair,
  onRerunFailed,
  renderPatchDraft,
  runnerLoading,
}) {
  const task = action?.task;
  const mode = action?.mode;
  const next = task ? taskNextAction(task) : null;
  const title = { review: "确认任务", start: "开始执行", result: "任务结果", failure: "处理失败" }[mode] || "任务详情";
  const checks = task?.plan?.checks || [];

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="taskActionDialogContent" description={task?.title || "未命名任务"} title={title}>
        {mode === "review" ? <div className="taskReviewLayout"><section className="taskReviewSummary"><span>任务说明</span><p>{task.plan?.summary || task.description || "暂无说明"}</p></section><div className="taskReviewDetails"><section><span>计划步骤</span><ol>{previewItems(task.plan?.steps).map((step, index) => <li key={step}><em>{index + 1}</em><p>{step}</p></li>)}{!previewItems(task.plan?.steps).length ? <li><em>1</em><p>确认后由模型生成执行建议</p></li> : null}</ol></section><section><span>验证项</span><ul>{checks.slice(0, 3).map((check) => <li key={check.id}>{check.label}</li>)}{!checks.length ? <li>暂无已登记验证项</li> : null}</ul></section></div></div> : null}
        {mode === "start" ? <Notice variant="info">确认后任务进入进行中。工程文件仍需在改动草稿阶段再次确认后才会写入。</Notice> : null}
        {mode === "result" ? <div className="agentFailureBox"><strong>{task.verificationSummary || "任务已完成"}</strong><p>{task.handoffMerge ? "验证结果已更新到交接记录。" : "验证已结束，交接记录尚未更新。"}</p></div> : null}
        {mode === "failure" ? <div className="agentFailureBox"><strong>失败摘要</strong><p>{failureSummary?.(task)}</p>{(task.runs || []).filter((run) => run?.success === false).slice(0, 3).map((run) => <span key={`${task.id}-${run.id}`}>{run.label || run.id || "失败检查"}</span>)}</div> : null}
        {mode === "detail" && task ? <><div className="taskActionDetail"><section><span>任务说明</span><p>{task.plan?.summary || task.description || "暂无说明"}</p></section><section><span>当前下一步</span><p>{next?.detail}</p></section><section><span>关联目标</span><p>{goalTitle?.(task)}</p></section></div>{task.patchDraft ? renderPatchDraft?.(task.patchDraft) : null}</> : null}
        {mutationError ? <Notice variant="danger">{mutationError}</Notice> : null}
        <div className="taskCreateActions">
          <DialogClose asChild><Button type="button" variant="outline">关闭</Button></DialogClose>
          {mode === "review" ? <Button type="button" variant="secondary" onClick={() => onAdjust?.(task)}>在对话中调整</Button> : null}
          {["review", "start"].includes(mode) ? <Button disabled={!modelAvailable || modelChecking} title={modelAvailable ? "确认并开始执行" : "请先测试当前模型可用性"} type="button" variant="primary" onClick={onConfirmStart}>{modelChecking ? "正在检测模型" : "确认并开始"}</Button> : null}
          {mode === "result" ? <Button type="button" variant="secondary" onClick={() => onOpenTask?.(task)}>查看完整详情</Button> : null}
          {mode === "failure" ? <><Button disabled={Boolean(runnerLoading)} type="button" variant="outline" onClick={() => onRerunFailed?.(task)}>{runnerLoading ? "重跑中" : "重跑失败检查"}</Button><Button type="button" variant="primary" onClick={() => onRepair?.(task)}>生成修复任务</Button></> : null}
          {mode === "detail" && next?.action !== "none" ? <Button type="button" variant="primary" onClick={() => onExecuteDetail?.(task)}>{next.label}</Button> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

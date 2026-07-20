import { useRef } from "react";
import { isApplicablePatchDraft } from "../../conversation-runtime";
import { executePatchApplyWorkflow } from "../../lib/patch-apply-executor";
import { executePatchDraftWorkflow } from "../../lib/patch-draft-executor";

/** React lifecycle wrapper for Patch Draft, Apply/verify, and handoff actions. */
export function usePatchActions({
  tasks,
  chatTurns,
  updateChatTurns,
  projectExecutionEvent,
  checksForPlan,
  executionClient,
  persistTask,
  beginActionFeedback,
  finishActionFeedback,
  setPatchError,
  setPatchLoading,
  setApplyError,
  setApplyLoading,
  setRunnerError,
  setRunnerLoadingId,
  setHandoffError,
  setHandoffLoading,
}) {
  const activePatchRequestRef = useRef(null);
  const executePatchDraft = async (task, feedbackKey = `patch-${task?.id || Date.now()}`, { isActive } = {}) => {
    if (!task) return { error: "找不到需要生成改动的任务。", success: false };
    activePatchRequestRef.current = feedbackKey;
    beginActionFeedback(feedbackKey, "正在生成改动草稿...");
    setPatchError("");
    setPatchLoading(true);
    try {
      const result = await executePatchDraftWorkflow({
        generatePatch: (nextTask) => executionClient.generatePatchDraft(nextTask, nextTask?.requestId),
        isActive,
        persistTask,
        task,
      });
      if (result.error) setPatchError(result.error);
      finishActionFeedback(feedbackKey, result.success ? "success" : "failed", result.feedback);
      return result;
    } finally {
      if (activePatchRequestRef.current === feedbackKey) {
        activePatchRequestRef.current = null;
        setPatchLoading(false);
      }
    }
  };

  const generatePatchDraft = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;
    if (task.requestId) updateChatTurns(projectExecutionEvent(chatTurns, { events: [{ id: "patch-draft", label: "生成改动草稿", status: "current" }], outcome: "running", requestId: task.requestId, text: "正在生成改动草稿。" }));
    const result = await executePatchDraft(task, `patch-${taskId}`);
    if (task.requestId) {
      const applicable = result.success && isApplicablePatchDraft(result.patchDraft);
      const pendingAction = applicable
        ? { id: `apply-task-${task.id}`, requestId: task.requestId, taskId: task.id, type: "apply-patch" }
        : null;
      updateChatTurns(projectExecutionEvent(chatTurns, {
        actions: applicable
          ? [{ id: "apply-patch", label: "审阅并应用", taskId: task.id }, { id: "open-topic", label: "查看改动详情", target: "execution", taskId: task.id }]
          : [{ id: "open-topic", label: "查看任务详情", target: "execution", taskId: task.id }],
        events: [{ detail: result.error || "", id: "patch-draft", label: "生成改动草稿", status: result.success ? "done" : "failed" }],
        outcome: applicable ? "awaiting-confirmation" : result.success ? "succeeded" : "failed",
        pendingAction,
        requestId: task.requestId,
        taskId: task.id,
        text: applicable ? "改动草稿已生成。请先查看改动，确认无误后再应用。" : result.success ? "已生成改动草稿，但当前没有可应用的 diff。" : "改动草稿生成失败。",
      }));
    }
    return result.success;
  };

  const executePatchApply = async (task, { feedbackKey = `apply-${task?.id || Date.now()}`, onProgress } = {}) => {
    if (!task) return { error: "找不到需要应用改动的任务。", success: false };
    beginActionFeedback(feedbackKey, "正在应用改动并验证...");
    setApplyError("");
    setRunnerError("");
    setApplyLoading(true);
    try {
      const result = await executePatchApplyWorkflow({
        applyPatch: executionClient.applyPatchDraft,
        checks: checksForPlan(task.plan),
        onCheckStart: (check) => setRunnerLoadingId(check.id),
        onProgress,
        persistTask,
        runCheck: (check) => executionClient.runGuardedCheck(check.id),
        task,
        writeRunSummary: executionClient.writeRunSummary,
      });
      if (result.error) {
        setApplyError(result.error);
        setRunnerError(result.error);
      }
      finishActionFeedback(feedbackKey, result.success ? "success" : "failed", result.feedback);
      return result;
    } finally {
      setApplyLoading(false);
      setRunnerLoadingId("");
    }
  };

  const applyPatchDraft = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;
    let projectedTurns = chatTurns;
    const result = await executePatchApply(task, {
      feedbackKey: `apply-${taskId}`,
      onProgress: task.requestId ? (progress) => {
        projectedTurns = projectExecutionEvent(projectedTurns, { ...progress, requestId: task.requestId });
        updateChatTurns(projectedTurns);
      } : undefined,
    });
    return result.success;
  };

  const mergeHandoff = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;
    const feedbackKey = `handoff-${taskId}`;
    beginActionFeedback(feedbackKey, "正在更新交接...");
    setHandoffError("");
    setHandoffLoading(true);
    try {
      const handoffMerge = await executionClient.mergeRunSummaryToHandoff(task);
      await persistTask({ ...task, handoffMerge });
      finishActionFeedback(feedbackKey, "success", "交接已更新。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHandoffError(message);
      finishActionFeedback(feedbackKey, "failed", `更新交接失败：${message}`);
      return false;
    } finally {
      setHandoffLoading(false);
    }
  };

  return { applyPatchDraft, executePatchApply, executePatchDraft, generatePatchDraft, mergeHandoff };
}

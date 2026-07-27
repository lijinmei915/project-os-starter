import { useRef } from "react";
import { executeReadonlyPlanWorkflow } from "../../lib/plan-executor";
import { taskTitleForPlan } from "../../lib/task-record-factory";

/** React lifecycle wrapper for the shared read-only plan workflow. */
export function usePlanAction({
  activeConversationId,
  beginActionFeedback,
  buildLocalPlan,
  cancelRuntimeRequest,
  createTaskFromPlan,
  generateRemotePlan,
  isTauri,
  onProgress,
  persistTask,
  setPlanError,
  setPlanLoading,
  finishActionFeedback,
}) {
  const activeRequestRef = useRef(null);
  const generatePlan = async (request) => {
    const input = typeof request === "string" ? { task: request, attachments: [] } : request;
    const { autoContinue = false, onProgress: requestProgress, ...commandInput } = input;
    const requestId = input.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const feedbackKey = `generate-plan-${requestId}`;
    activeRequestRef.current = requestId;
    beginActionFeedback(feedbackKey, "正在生成计划...");
    setPlanError("");
    setPlanLoading(true);
    try {
      const result = await executeReadonlyPlanWorkflow({
        autoContinue,
        buildLocalPlan,
        commandInput,
        createTask: (plan) => createTaskFromPlan(plan, taskTitleForPlan(commandInput.displayTask, commandInput.task, plan), {
          conversationId: commandInput.conversationId || activeConversationId,
          origin: "conversation",
          requestId,
          startedAt: commandInput.startedAt,
        }),
        generateRemotePlan,
        isActive: () => activeRequestRef.current === requestId,
        onProgress: requestProgress || onProgress,
        persistTask,
        remote: isTauri,
        requestId,
      });
      if (result.error) setPlanError(result.error);
      if (result.feedback) finishActionFeedback(feedbackKey, result.status === "succeeded" ? "success" : "failed", result.feedback);
      return result;
    } finally {
      if (activeRequestRef.current === requestId) {
        activeRequestRef.current = null;
        setPlanLoading(false);
      }
    }
  };
  const stopPlanGeneration = () => {
    const requestId = activeRequestRef.current;
    if (requestId) finishActionFeedback(`generate-plan-${requestId}`, "success", "已停止当前处理。");
    activeRequestRef.current = null;
    setPlanLoading(false);
    void cancelRuntimeRequest?.(requestId);
  };
  return { generatePlan, stopPlanGeneration };
}

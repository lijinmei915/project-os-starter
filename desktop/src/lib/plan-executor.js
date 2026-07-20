import { requestOutcome } from "./request-lifecycle.js";

export const planGenerationTimeoutMs = 15000;

function isLegacyPlanArgumentsError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("generate_readonly_plan")
    && message.includes("missing required key")
    && message.includes("task");
}

function legacyPlanTask(commandInput) {
  const attachmentNote = commandInput.attachments?.length
    ? `\n\n附带截图：${commandInput.attachments.map((attachment) => attachment.name).join("、")}\n提示：当前桌面端后端还未重启到多模态版本，本次先按文字和附件名称生成计划。`
    : "";
  return `${commandInput.task}${attachmentNote}`;
}

export async function executeReadonlyPlanWorkflow({
  autoContinue = false,
  buildLocalPlan,
  commandInput,
  createTask,
  generateRemotePlan,
  isActive,
  onProgress,
  persistTask,
  remote = false,
  requestId,
  runWithTimeout,
} = {}) {
  try {
    onProgress?.({ label: "读取项目上下文", stage: "context" });
    let plan = buildLocalPlan(commandInput);
    onProgress?.({ label: "生成执行计划", stage: "generate" });
    if (remote) {
      try {
        plan = await runWithTimeout(
          generateRemotePlan({ input: commandInput }),
          planGenerationTimeoutMs,
          "计划生成等待超时",
        );
      } catch (error) {
        if (error?.code === "REQUEST_TIMEOUT") {
          onProgress?.({
            detail: "远程生成响应较慢，已切换到本地确定性计划。",
            label: "使用本地计划",
            stage: "generate",
          });
          plan = {
            ...buildLocalPlan(commandInput),
            trace: ["LOCAL_FALLBACK: provider plan timed out"],
          };
        } else if (isLegacyPlanArgumentsError(error)) {
          plan = await runWithTimeout(
            generateRemotePlan({ task: legacyPlanTask(commandInput) }),
            planGenerationTimeoutMs,
            "计划生成等待超时",
          );
        } else {
          throw error;
        }
      }
    }
    if (isActive && !isActive()) return requestOutcome("cancelled", "", { requestId });
    onProgress?.({ label: "保存任务", stage: "persist" });
    const nextTask = createTask(plan);
    const persistedTask = await persistTask(nextTask, { durable: true });
    const task = persistedTask || nextTask;
    return requestOutcome("succeeded", "", {
      feedback: autoContinue ? "计划已保存，正在生成改动草稿。" : "已生成计划，等待确认执行。",
      persistedAt: task?.requestTrace?.persistedAt || task?.updatedAt || "",
      requestId,
      task,
      taskId: task.id,
    });
  } catch (error) {
    if (isActive && !isActive()) return requestOutcome("cancelled", "", { requestId });
    const message = error instanceof Error ? error.message : String(error);
    const status = error?.code === "REQUEST_TIMEOUT" ? "timed-out" : "failed";
    return requestOutcome(status, message, {
      error: message,
      feedback: `生成计划失败：${message}`,
      requestId,
    });
  }
}

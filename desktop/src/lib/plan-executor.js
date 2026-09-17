import { requestOutcome } from "./request-lifecycle.js";
import { publicErrorMessage } from "./public-error-message.js";

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
} = {}) {
  try {
    onProgress?.({ label: "正在查看项目（只读）", stage: "context" });
    let plan = buildLocalPlan(commandInput);
    onProgress?.({ label: "正在整理只读计划", stage: "generate" });
    if (remote) {
      try {
        plan = await generateRemotePlan({ input: commandInput });
      } catch (error) {
        if (isLegacyPlanArgumentsError(error)) {
          plan = await generateRemotePlan({ task: legacyPlanTask(commandInput) });
        } else {
          throw error;
        }
      }
    }
    if (isActive && !isActive()) return requestOutcome("cancelled", "", { requestId });
    onProgress?.({ label: "正在保存只读计划", stage: "persist" });
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
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = publicErrorMessage(rawMessage, "计划生成未完成，可以重试。");
    const status = error?.code === "REQUEST_TIMEOUT" ? "timed-out" : "failed";
    return requestOutcome(status, message, {
      error: message,
      feedback: `生成计划失败：${message}`,
      requestId,
    });
  }
}

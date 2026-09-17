import { requestOutcome } from "./request-lifecycle.js";
import { publicErrorMessage } from "./public-error-message.js";

export function buildDirectAgentTaskPlan(input = {}, snapshot = {}) {
  const task = String(input.task || "").trim() || "未命名任务";
  return {
    task,
    projectName: snapshot.projectName || "",
    mode: "agent-task",
    summary: task,
    steps: [
      "Agent 读取完成任务所需的最小项目上下文。",
      "Agent 根据目标分析问题并持续回报处理过程。",
      "需要修改文件或运行检查时，分别请求用户批准。",
      "保存结果、检查结论和最终证据。",
    ],
    filesToRead: [],
    candidateChanges: [],
    checks: [],
    guardrails: [
      "创建任务不会修改项目文件。",
      "文件写入和受控检查必须分别获得批准。",
      "只有改动、检查和证据闭环后才能标记完成。",
    ],
    trace: ["DIRECT_AGENT_ENTRY: local deterministic task."],
  };
}

export async function prepareDirectAgentTask({
  commandInput,
  createTask,
  isActive,
  persistTask,
  requestId,
} = {}) {
  try {
    const taskRecord = createTask(commandInput);
    if (isActive && !isActive()) return requestOutcome("cancelled", "", { requestId });
    const persistedTask = await persistTask(taskRecord, { durable: true });
    const task = persistedTask || taskRecord;
    return requestOutcome("succeeded", "", { requestId, task, taskId: task.id });
  } catch (error) {
    if (isActive && !isActive()) return requestOutcome("cancelled", "", { requestId });
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = publicErrorMessage(rawMessage, "任务登记失败，可以重试。");
    return requestOutcome("failed", message, { error: message, requestId });
  }
}

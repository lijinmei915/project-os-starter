import { invokeRuntimeCommand } from "./runtime-api.js";

export function generateReadonlyPlan(payload) {
  return invokeRuntimeCommand("generate_readonly_plan", payload);
}

export function generatePatchDraft(task, requestId = task?.requestId) {
  return invokeRuntimeCommand("generate_patch_draft", { input: { requestId, task } });
}

export function applyPatchDraft(task) {
  return invokeRuntimeCommand("apply_patch_draft", { input: { task } });
}

export function runGuardedCheck(checkId) {
  return invokeRuntimeCommand("run_guarded_check", { input: { checkId } });
}

export function writeRunSummary(task) {
  return invokeRuntimeCommand("write_run_summary", { input: { task } });
}

export function mergeRunSummaryToHandoff(task) {
  return invokeRuntimeCommand("merge_run_summary_to_handoff", { input: { task } });
}

export function getHermesExecutorStatus() {
  return invokeRuntimeCommand("get_hermes_executor_status", {});
}

export function executeAgentReadTool(name, arguments_ = {}) {
  return invokeRuntimeCommand("execute_agent_read_tool", { input: { name, arguments: arguments_ } });
}

export function runHermesAgent(prompt, requestId = "", maxSteps = 20, approvalToken = "", context = {}) {
  return invokeRuntimeCommand("run_hermes_agent", {
    input: {
      approvalToken,
      conversationId: String(context?.conversationId || ""),
      maxSteps,
      prompt,
      requestId,
      taskId: String(context?.taskId || ""),
    },
  });
}

// Kept for older callers; the live approval flow now continues by run id so it
// cannot replace the persisted evidence timeline.
export function buildApprovedAgentContinuationPrompt(run, toolResult) {
  const original = String(run?.prompt || "").trim();
  if (!original) throw new Error("该 Agent Run 缺少原始任务，不能继续执行。");
  return `${original}\n\n已批准的上一步工具已经执行，结果如下：${JSON.stringify(toolResult ?? null).slice(0, 8000)}\n不要重复该操作。基于这个结果继续完成任务；若需要新的写入或检查，先请求新的审批。`;
}

export function listAgentRuns() {
  return invokeRuntimeCommand("list_agent_runs", {});
}

export async function resumeHermesAgent(run) {
  if (!run?.id) throw new Error("缺少可恢复的 Agent Run。");
  const resumed = await invokeRuntimeCommand("resume_agent_run", { input: { id: run.id } });
  if (resumed.status === "awaiting-approval") return resumed;
  return invokeRuntimeCommand("continue_agent_run", { input: { id: resumed.id } });
}

export async function approveHermesAgent(run) {
  if (!run?.id) throw new Error("缺少待审批的 Agent Run。");
  const approved = await invokeRuntimeCommand("approve_agent_run", { input: { id: run.id } });
  await invokeRuntimeCommand("execute_approved_agent_tool", { input: { id: approved.id, token: approved.approvalToken } });
  const updated = (await listAgentRuns()).find((item) => item.id === approved.id);
  if (!updated) throw new Error("已执行工具的 Agent Run 未找到。");
  if (updated.status === "failed") return updated;
  return invokeRuntimeCommand("continue_agent_run", { input: { id: updated.id } });
}

export async function submitAgentInteraction(run, { action = "submit", answers = {} } = {}) {
  if (!run?.id || !run?.checkpoint?.interaction?.id) throw new Error("缺少待提交的追问表单。");
  const accepted = await invokeRuntimeCommand("submit_agent_interaction", {
    input: { action, answers, formId: run.checkpoint.interaction.id, id: run.id },
  });
  if (accepted.status !== "queued") return accepted;
  try {
    return await invokeRuntimeCommand("continue_agent_run", { input: { id: accepted.id } });
  } catch (error) {
    return { ...accepted, continuationError: error instanceof Error ? error.message : String(error) };
  }
}

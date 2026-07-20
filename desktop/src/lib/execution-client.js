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

export function runHermesAgent(prompt, requestId = "", maxSteps = 20, approvalToken = "") {
  return invokeRuntimeCommand("run_hermes_agent", { input: { approvalToken, maxSteps, prompt, requestId } });
}

export function buildApprovedAgentContinuationPrompt(run, toolResult) {
  const original = String(run?.prompt || "").trim();
  if (!original) throw new Error("该 Agent Run 缺少原始任务，不能继续执行。");
  const observation = JSON.stringify(toolResult ?? null).slice(0, 8000);
  return `${original}\n\n已批准的上一步工具已经执行，结果如下：${observation}\n不要重复该操作。基于这个结果继续完成任务；若需要新的写入或检查，先请求新的审批。`;
}

export function listAgentRuns() {
  return invokeRuntimeCommand("list_agent_runs", {});
}

export async function resumeHermesAgent(run) {
  if (!run?.id) throw new Error("缺少可恢复的 Agent Run。");
  const resumed = await invokeRuntimeCommand("resume_agent_run", { input: { id: run.id } });
  if (resumed.status === "awaiting-approval") return resumed;
  return runHermesAgent(resumed.prompt, resumed.requestId, resumed.maxSteps);
}

export async function approveHermesAgent(run) {
  if (!run?.id) throw new Error("缺少待审批的 Agent Run。");
  const approved = await invokeRuntimeCommand("approve_agent_run", { input: { id: run.id } });
  const toolResult = await invokeRuntimeCommand("execute_approved_agent_tool", { input: { id: approved.id, token: approved.approvalToken } });
  return runHermesAgent(
    buildApprovedAgentContinuationPrompt(approved, toolResult),
    approved.requestId,
    approved.maxSteps,
  );
}

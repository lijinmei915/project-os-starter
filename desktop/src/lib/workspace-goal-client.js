import { invokeWorkspaceOperation, isTauriRuntime } from "./runtime-api.js";

async function withPreviewSnapshot(operation, loadWorkspaceSnapshot) {
  const result = await operation;
  if (isTauriRuntime()) return result;
  return loadWorkspaceSnapshot();
}

function requiredGoalId(goalId, action) {
  const value = String(goalId || "").trim();
  if (!value) throw new Error(`没有可${action}的当前目标。请先建立或切换目标。`);
  return value;
}

export async function runGoalValidation({ goalId, loadWorkspaceSnapshot }) {
  const currentGoalId = requiredGoalId(goalId, "验收");
  return withPreviewSnapshot(invokeWorkspaceOperation({
    input: { goalId: currentGoalId },
    previewCommand: "run_goal_validation",
    tauriCommand: "run_goal_validation",
  }), loadWorkspaceSnapshot);
}

export async function signOffGoalValidation({ goalId, loadWorkspaceSnapshot }) {
  const currentGoalId = requiredGoalId(goalId, "确认完成");
  return withPreviewSnapshot(invokeWorkspaceOperation({
    input: { goalId: currentGoalId },
    previewCommand: "sign_off_goal_validation",
    tauriCommand: "sign_off_goal_validation",
  }), loadWorkspaceSnapshot);
}

export async function createWorkspaceGoal({ input, loadWorkspaceSnapshot }) {
  return withPreviewSnapshot(invokeWorkspaceOperation({
    input,
    previewCommand: "create_goal",
    tauriCommand: "create_goal",
  }), loadWorkspaceSnapshot);
}

function mutateWorkspaceGoal({ input, loadWorkspaceSnapshot, previewCommand, tauriCommand }) {
  return withPreviewSnapshot(invokeWorkspaceOperation({ input, previewCommand, tauriCommand }), loadWorkspaceSnapshot);
}

export const updateWorkspaceGoal = ({ input, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input, loadWorkspaceSnapshot, previewCommand: "update_goal", tauriCommand: "update_goal" });
export const archiveWorkspaceGoal = ({ id, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input: { id }, loadWorkspaceSnapshot, previewCommand: "archive_goal", tauriCommand: "archive_goal" });
export const restoreWorkspaceGoal = ({ id, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input: { id }, loadWorkspaceSnapshot, previewCommand: "restore_goal", tauriCommand: "restore_goal" });
export const mergeWorkspaceGoal = ({ sourceId, targetId, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input: { sourceId, targetId }, loadWorkspaceSnapshot, previewCommand: "merge_goal", tauriCommand: "merge_goal" });
export const switchWorkspaceGoal = ({ input, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input, loadWorkspaceSnapshot, previewCommand: "switch_active_goal", tauriCommand: "switch_active_goal" });
export const confirmWorkspaceGoal = ({ input, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input, loadWorkspaceSnapshot, previewCommand: "confirm_goal", tauriCommand: "confirm_goal" });
export const confirmGoalDecomposition = ({ input, loadWorkspaceSnapshot }) => mutateWorkspaceGoal({ input, loadWorkspaceSnapshot, previewCommand: "confirm_goal_decomposition", tauriCommand: "confirm_goal_decomposition" });

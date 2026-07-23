import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { open as openTauriDialog } from "@tauri-apps/plugin-dialog";

import { isTauriRuntime } from "./runtime-api.js";
import * as workspaceGoalClient from "./workspace-goal-client.js";
import { loadPreviewWorkspaceSnapshot } from "./workspace-preview-client.js";

export async function loadWorkspaceSnapshot({
  fetchImpl = fetch,
  invoke = tauriInvoke,
  isTauri = isTauriRuntime(),
  loadPreview = loadPreviewWorkspaceSnapshot,
} = {}) {
  if (!isTauri) {
    const response = await fetchImpl("/__omnidesk/workspace-snapshot");
    if (response.ok) return response.json();
    return loadPreview(fetchImpl);
  }

  return invoke("get_workspace_snapshot");
}

export async function refreshWorkspaceFactsPreview(options = {}) {
  const {
    invoke = tauriInvoke,
    isTauri = isTauriRuntime(),
    loadSnapshot = loadWorkspaceSnapshot,
    now = () => new Date().toISOString(),
  } = options;
  if (!isTauri) {
    const snapshot = await loadSnapshot();
    const report = snapshot?.workspaceFacts || null;
    return report ? { ...report, generatedAt: now() } : report;
  }

  return invoke("refresh_workspace_facts_preview");
}

export async function createWorkspaceGoal(input) {
  return workspaceGoalClient.createWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

export async function updateWorkspaceGoal(input) {
  return workspaceGoalClient.updateWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

export async function archiveWorkspaceGoal(id) {
  return workspaceGoalClient.archiveWorkspaceGoal({ id, loadWorkspaceSnapshot });
}

export async function restoreWorkspaceGoal(id) {
  return workspaceGoalClient.restoreWorkspaceGoal({ id, loadWorkspaceSnapshot });
}

export async function mergeWorkspaceGoal(sourceId, targetId) {
  return workspaceGoalClient.mergeWorkspaceGoal({ sourceId, targetId, loadWorkspaceSnapshot });
}

export async function switchWorkspaceGoal(input) {
  return workspaceGoalClient.switchWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

export async function confirmWorkspaceGoal(input) {
  return workspaceGoalClient.confirmWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

export async function confirmGoalDecomposition(input) {
  return workspaceGoalClient.confirmGoalDecomposition({ input, loadWorkspaceSnapshot });
}

export async function copyTextToSystemClipboard(text, {
  fetchImpl = fetch,
  invoke = tauriInvoke,
  isTauri = isTauriRuntime(),
  location = window.location,
} = {}) {
  const canUseDevClipboard = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  if (!canUseDevClipboard && isTauri) {
    await invoke("copy_text_to_clipboard", { text });
    return { ok: true };
  }

  const response = await fetchImpl("/__omnidesk/copy-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "复制失败。");
  return payload;
}

export async function pickProjectDirectory({
  isTauri = isTauriRuntime(),
  openDialog = openTauriDialog,
} = {}) {
  if (!isTauri) throw new Error("浏览器预览模式暂不支持系统目录选择器");
  return openDialog({
    directory: true,
    multiple: false,
    title: "新建或选择要加入 OmniDesk 的项目目录",
  });
}

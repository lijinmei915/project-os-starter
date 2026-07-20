import { invokeWorkspaceOperation } from "./runtime-api.js";
import { invokeRuntimeCommand } from "./runtime-api.js";
import { listen } from "@tauri-apps/api/event";

async function mutateRegistry({ input, loadWorkspaceSnapshot, tauriCommand }) {
  const result = await invokeWorkspaceOperation({ input, previewCommand: tauriCommand, tauriCommand });
  if (result?.projects && !result?.projectName) return loadWorkspaceSnapshot();
  return result;
}

export const switchWorkspaceProject = ({ id, loadWorkspaceSnapshot }) => mutateRegistry({ input: { id }, loadWorkspaceSnapshot, tauriCommand: "switch_registry_project" });
export const addWorkspaceProject = ({ accessMode = "browse", path, loadWorkspaceSnapshot }) => mutateRegistry({ input: { accessMode, path }, loadWorkspaceSnapshot, tauriCommand: "add_registry_project" });
export const previewWorkspaceProject = ({ path }) => invokeRuntimeCommand("preview_project_path", { input: { path } });
export const relocateWorkspaceProject = ({ id, path, loadWorkspaceSnapshot }) => mutateRegistry({ input: { id, path }, loadWorkspaceSnapshot, tauriCommand: "relocate_registry_project" });
export const renameWorkspaceProject = ({ id, name, loadWorkspaceSnapshot }) => mutateRegistry({ input: { id, name }, loadWorkspaceSnapshot, tauriCommand: "rename_registry_project" });
export const removeWorkspaceProject = ({ id, loadWorkspaceSnapshot }) => mutateRegistry({ input: { id }, loadWorkspaceSnapshot, tauriCommand: "remove_registry_project" });
export const startWorkspaceFileWatcher = () => invokeRuntimeCommand("start_workspace_file_watcher", {});
export const openWorkspaceProjectFolder = (id) => invokeRuntimeCommand("open_project_folder", { id });

export async function subscribeWorkspaceFileChanges(handler) {
  return listen("workspace://files-changed", handler);
}

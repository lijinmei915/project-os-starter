import { invokeRuntimeCommand, invokeTauriCommand, isTauriRuntime } from "./runtime-api.js";

export async function listDesktopTasks() {
  if (isTauriRuntime()) return invokeTauriCommand("list_desktop_tasks");
  const response = await fetch("/__project-os/desktop-tasks");
  if (!response.ok) return [];
  return response.json();
}

export function saveDesktopTask(task) {
  return invokeRuntimeCommand("save_desktop_task", { input: { task } });
}

export function deleteDesktopTask(id) {
  return invokeRuntimeCommand("delete_desktop_task", { input: { id } });
}

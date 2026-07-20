import { invokeRuntimeCommand, isTauriRuntime } from "./runtime-api.js";

export async function getProjectMemory() {
  if (isTauriRuntime()) return invokeRuntimeCommand("get_project_memory");
  const response = await fetch("/__project-os/project-memory");
  if (!response.ok) throw new Error("读取项目记忆失败。");
  return response.json();
}

export function saveProjectMemory(memory) {
  return invokeRuntimeCommand("save_project_memory", { input: { memory } });
}

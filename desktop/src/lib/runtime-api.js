import { invoke } from "@tauri-apps/api/core";
import { previewOperation } from "./runtime-operation-contract.js";

export function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  const hasTauriBridge = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_METADATA__);
  if (!hasTauriBridge) return false;
  const { hostname, port, protocol } = window.location || {};
  const isLoopbackHttp = ["http:", "https:"].includes(protocol) && ["127.0.0.1", "localhost", "::1"].includes(hostname);
  return !isLoopbackHttp || port === "1420";
}

export async function invokeTauriCommand(command, payload) {
  return invoke(command, payload);
}

export async function invokeRuntimeCommand(command, payload) {
  if (isTauriRuntime()) return invokeTauriCommand(command, payload);
  return invokePreviewCommand(command, payload);
}

export async function invokeWorkspaceOperation({ input, previewCommand, tauriCommand }) {
  if (isTauriRuntime()) return invokeTauriCommand(tauriCommand, input === undefined ? undefined : { input });
  return invokePreviewCommand(previewCommand, input);
}

export async function invokePreviewCommand(command, payload) {
  if (command === "open_native_terminal") {
    throw new Error("浏览器预览不能打开系统终端，请在桌面 App 窗口里使用。");
  }
  if (command === "run_hermes_agent") {
    throw new Error("浏览器预览不能运行 Hermes，请在桌面 App 窗口里使用。");
  }
  if (command === "resume_agent_run") {
    throw new Error("浏览器预览不能恢复 Hermes 运行，请在桌面 App 窗口里使用。");
  }
  if (command === "approve_agent_run") {
    throw new Error("浏览器预览不能批准 Hermes 运行，请在桌面 App 窗口里使用。");
  }
  if (command === "execute_approved_agent_tool") {
    throw new Error("浏览器预览不能执行已批准工具，请在桌面 App 窗口里使用。");
  }
  const spec = previewOperation(command);
  const response = await fetch(spec.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload?.input || payload || {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || spec.error);
  }
  return result;
}

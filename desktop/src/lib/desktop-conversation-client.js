import { invokeRuntimeCommand, invokeTauriCommand, isTauriRuntime } from "./runtime-api.js";
import { listen } from "@tauri-apps/api/event";

export async function listDesktopConversations() {
  if (isTauriRuntime()) return invokeTauriCommand("list_desktop_conversations");
  const response = await fetch("/__project-os/desktop-conversations");
  if (!response.ok) return [];
  return response.json();
}

export function saveDesktopConversation(conversation) {
  return invokeRuntimeCommand("save_desktop_conversation", { input: { conversation } });
}

export function deleteDesktopConversation(id) {
  return invokeRuntimeCommand("delete_desktop_conversation", { input: { id } });
}

export function chatWithModel(input) {
  return invokeRuntimeCommand("chat_with_model", { input });
}

export function cancelRuntimeRequest(requestId) {
  if (!isTauriRuntime() || !requestId) return Promise.resolve(false);
  return invokeTauriCommand("cancel_runtime_request", { requestId });
}

export async function listenRuntimeConversationEvents(handler) {
  if (!isTauriRuntime()) return () => {};
  return listen("runtime://conversation-event", handler);
}

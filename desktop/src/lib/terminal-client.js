import { invokeRuntimeCommand } from "./runtime-api.js";
import { listen } from "@tauri-apps/api/event";

export const writeTerminalSession = (input) => invokeRuntimeCommand("write_terminal_session", { input });
export const resizeTerminalSession = (input) => invokeRuntimeCommand("resize_terminal_session", { input });
export const startTerminalSession = (input) => invokeRuntimeCommand("start_terminal_session", { input });
export const stopTerminalSession = (input) => invokeRuntimeCommand("stop_terminal_session", { input });
export const listTerminalEvidence = () => invokeRuntimeCommand("list_terminal_evidence", {});
export const openNativeTerminal = () => invokeRuntimeCommand("open_native_terminal", {});
export const saveTerminalImage = (input) => invokeRuntimeCommand("save_terminal_image", { input });

export async function subscribeTerminalOutput(handler) {
  return listen("terminal://output", handler);
}

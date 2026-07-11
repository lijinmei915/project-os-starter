export function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(
    window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_METADATA__
  );
}

export async function invokeTauriCommand(command, payload) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(command, payload);
}

const previewCommands = {
  read_engineering_file: {
    endpoint: "/__project-os/read-engineering-file",
    error: "读取文件失败。",
  },
  run_project_os_action: {
    endpoint: "/__project-os/run-project-os-action",
    error: "治理动作执行失败。",
  },
  save_desktop_conversation: {
    endpoint: "/__project-os/save-desktop-conversation",
    error: "保存对话失败。",
  },
  delete_desktop_conversation: {
    endpoint: "/__project-os/delete-desktop-conversation",
    error: "删除对话失败。",
  },
};

export async function invokePreviewCommand(command, payload) {
  if (command === "open_native_terminal") {
    throw new Error("浏览器预览不能打开系统终端，请在桌面 App 窗口里使用。");
  }
  const spec = previewCommands[command];
  if (!spec) {
    throw new Error("当前是浏览器预览，只能查看界面；请在桌面 App 窗口里保存配置。");
  }
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

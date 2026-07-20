const errorDefinitions = Object.freeze({
  timeout: { message: "响应超时，已停止等待。", recoverable: true },
  "provider-unavailable": { message: "模型服务暂时不可用。", recoverable: true },
  "persistence-failed": { message: "本地保存失败。", recoverable: true },
  "execution-failed": { message: "任务执行失败。", recoverable: true },
  cancelled: { message: "操作已取消。", recoverable: false },
  unknown: { message: "处理未完成。", recoverable: true },
});

export function conversationError(type, detail = "") {
  const definition = errorDefinitions[type] || errorDefinitions.unknown;
  return Object.freeze({ detail, message: definition.message, recoverable: definition.recoverable, type: errorDefinitions[type] ? type : "unknown" });
}

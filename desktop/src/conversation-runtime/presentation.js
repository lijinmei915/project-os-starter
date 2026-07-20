const internalTracePatterns = [
  /planning\s+deep\s+dive/i,
  /context\s+auto(?:matic)?\s+compression/i,
  /loaded\s+tool/i,
  /running\s+\d+\s+commands?/i,
];

function toolLabel(event = {}) {
  const detail = String(
    event.payload?.label
    || event.payload?.toolName
    || event.payload?.tool
    || event.payload?.command
    || event.label
    || event.detail
    || "",
  ).toLowerCase();
  if (/read|file|文件/.test(detail)) return "读取项目文件";
  if (/check|test|验证|检查/.test(detail)) return "运行受控检查";
  if (/command|terminal|命令/.test(detail)) return "运行受控命令";
  if (/context|上下文|compress/.test(detail)) return "整理对话上下文";
  return "已使用工具";
}

export function isInternalConversationTrace(text = "") {
  const value = String(text || "").trim();
  return Boolean(value) && internalTracePatterns.some((pattern) => pattern.test(value));
}

export function conversationTextForDisplay(text = "") {
  const value = String(text || "").trim();
  if (!isInternalConversationTrace(value)) return value;
  if (/planning\s+deep\s+dive/i.test(value)) return "正在整理执行方案。";
  if (/compress/i.test(value)) return "正在整理本轮对话上下文。";
  return "正在处理项目上下文。";
}

export function presentConversationActivity({ conversationEvents = [], events = [], label = "正在处理", running = false } = {}) {
  const normalizedEvents = Array.isArray(events) ? events : [];
  const normalizedConversationEvents = Array.isArray(conversationEvents) ? conversationEvents : [];
  const toolEvents = normalizedConversationEvents.filter((event) => event?.actor === "tool" || String(event?.type || "").startsWith("tool."));
  const failed = normalizedEvents.find((event) => event?.status === "failed")
    || toolEvents.find((event) => event?.status === "failed");
  const current = normalizedEvents.find((event) => event?.status === "current")
    || toolEvents.find((event) => event?.status === "running");
  const completed = !running && normalizedEvents.length > 0 && !failed && !current;
  return {
    summary: failed
      ? "处理失败"
      : current?.label || current?.payload?.label || (completed ? "本轮处理完成" : label),
    timeline: normalizedEvents.filter((event) => event?.type !== "tool"),
    tools: [...new Set(toolEvents.map(toolLabel))],
  };
}

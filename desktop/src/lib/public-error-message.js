const internalLogPattern = /\[(?:INFO|DEBUG|TRACE)\]|acp_adapter|No \.env found|\/var\/folders\/|omnidesk-hermes-readonly-/i;

export function publicErrorMessage(value, fallback = "本轮处理未完成，可以重试。") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/没有找到项目路径：/.test(raw)) {
    return "读取的文件路径不存在，Agent 未能自动找到正确文件。可以重试。";
  }
  const publicPart = raw.split(/；(?:Hermes|Gemini):|\r?\n/)[0].trim();
  if (!publicPart || internalLogPattern.test(publicPart)) return fallback;
  return publicPart.slice(0, 240);
}

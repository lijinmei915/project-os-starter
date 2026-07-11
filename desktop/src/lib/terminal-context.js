function normalizedLines(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
}

// Context sent from chat must never become executable terminal input.
export function formatTerminalContext(lines) {
  const values = Array.isArray(lines) ? lines : [lines];
  const comments = values.flatMap((value) => normalizedLines(value));
  return `${comments.map((line) => `# ${line}`).join("\n")}\n`;
}

export function formatTerminalContextForInput(lines) {
  const context = formatTerminalContext(lines).trimEnd();
  return formatTerminalInputForPaste(context);
}

export function formatTerminalInputForPaste(value, { submit = false } = {}) {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n");
  if (!text) return "";
  return `\u001b[200~${text}\u001b[201~${submit ? "\r" : ""}`;
}

function candidateTitle(message) {
  const firstClause = String(message || "")
    .split(/[，。；;\n]/)[0]
    .replace(/^(?:接下来|下一阶段|本阶段)(?:我们)?(?:要|想|准备|先|的目标是)?/, "")
    .replace(/^(?:我|我们)(?:要|想|准备|先)/, "")
    .trim();
  const objectAction = firstClause.match(/^把(.+?)(打磨好|做好|做完|完成|实现)$/);
  if (objectAction) {
    const [, object, action] = objectAction;
    const verb = action === "打磨好" ? "打磨" : action === "实现" ? "实现" : "完成";
    return `${verb}${object}`;
  }
  return firstClause.slice(0, 48);
}

export function stageGoalCandidateFromMessage(message, chatResult = {}) {
  const text = String(message || "").trim();
  if (chatResult.providerStatus !== "available" || !text) return null;
  if (/[?？]$/.test(text) || /(为什么|怎么|如何|是什么|要不要|可以吗|能不能)/.test(text)) return null;
  const explicitGoal = /(阶段目标|下一阶段|本阶段)/.test(text);
  const nextCommitment = /^(?:接下来|下一步)(?:我们)?(?:要|想|准备|先)/.test(text);
  if (!explicitGoal && !nextCommitment) return null;
  const title = candidateTitle(text);
  if (!title) return null;
  return Object.freeze({
    summary: text,
    title,
  });
}

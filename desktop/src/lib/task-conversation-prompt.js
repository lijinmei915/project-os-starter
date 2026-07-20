export function taskContinuationPrompt({ goalName, nextActionLabel, statusLabel, title }) {
  return [
    `继续推进任务「${title || "未命名任务"}」。`,
    `当前状态：${statusLabel || "待确认"}。`,
    `关联目标：${goalName || "未关联目标"}。`,
    `当前建议：${nextActionLabel || "查看任务详情"}。`,
    "请结合这个任务已有对话、执行步骤和验证结果，先说明最新进展，再给出一个明确下一步；在我确认前不要写入文件。",
  ].join("\n");
}

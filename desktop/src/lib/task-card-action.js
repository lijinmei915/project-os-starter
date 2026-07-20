const taskCardActions = {
  planned: { label: "查看并确认", mode: "review" },
  "waiting approval": { label: "开始执行", mode: "start" },
  running: { label: "继续推进", mode: "detail" },
  done: { label: "查看结果", mode: "result" },
  failed: { label: "处理失败", mode: "failure" },
  "repair pending": { label: "生成修复草稿", mode: "failure" },
  "waiting repair approval": { label: "确认应用修复", mode: "start" },
  "repair failed": { label: "查看失败证据", mode: "failure" },
};

export function taskCardPrimaryAction(status) {
  return taskCardActions[status] || { label: "打开任务", mode: "detail" };
}

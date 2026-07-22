export function taskStatusLabel(status, taskStatuses) {
  return {
    [taskStatuses.planned]: "待确认",
    [taskStatuses.waitingApproval]: "已确认",
    [taskStatuses.running]: "进行中",
    [taskStatuses.done]: "已完成",
    [taskStatuses.failed]: "失败",
    [taskStatuses.repairPending]: "待修复",
    [taskStatuses.waitingRepairApproval]: "待确认修复",
    [taskStatuses.repairFailed]: "修复失败",
  }[status] || status || "待确认";
}

export function checksForPlan(plan, guardedCheckCapabilities) {
  const checks = Array.isArray(plan?.checks) ? plan.checks : [];
  return guardedCheckCapabilities.filter((check) =>
    checks.some((item) => item.includes(check.command) || item.includes(check.id) || item.includes(check.label)),
  );
}

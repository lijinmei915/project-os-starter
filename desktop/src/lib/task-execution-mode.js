function planItems(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function hasEngineeringChange(plan = {}) {
  return planItems(plan.candidateChanges || plan.candidate_changes)
    .some((item) => !/(先不写文件|不自动写文件|只形成.*建议|不修改文件)/.test(item));
}

export function taskExecutionNextAction(task = {}) {
  const plan = task.plan || {};
  const checks = planItems(plan.checks);
  if (hasEngineeringChange(plan)) {
    return { id: "generate-patch", label: "生成文件改动", taskId: task.id || "" };
  }
  if (checks.length) {
    if (task.verificationSummary) {
      return { id: "open-topic", label: "查看检查结果", target: "execution", taskId: task.id || "" };
    }
    return { checkId: "runtime", id: "run-check", label: "运行基础检查", taskId: task.id || "" };
  }
  return { id: "open-topic", label: "查看任务详情", target: "execution", taskId: task.id || "" };
}

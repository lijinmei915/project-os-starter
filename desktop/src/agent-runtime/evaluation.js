const requiredBooleanMetrics = ["success", "patchApplicable", "checksPassed", "recovered"];

export function validateAgentEvaluationResults({ cases = [], results = [] } = {}) {
  const allowed = new Set(cases.map((item) => item.id));
  const seen = new Set();
  for (const result of results) {
    if (!result || typeof result !== "object") throw new Error("Agent Eval result 必须是 object");
    const caseId = String(result.caseId || "").trim();
    if (!allowed.has(caseId)) throw new Error(`Agent Eval 包含未知 case：${caseId || "(empty)"}`);
    if (seen.has(caseId)) throw new Error(`Agent Eval case 重复：${caseId}`);
    seen.add(caseId);
    for (const key of requiredBooleanMetrics) if (typeof result[key] !== "boolean") throw new Error(`Agent Eval ${caseId} 缺少布尔指标：${key}`);
    for (const key of ["approvalCount", "durationMs", "costUsd"]) if (!Number.isFinite(Number(result[key])) || Number(result[key]) < 0) throw new Error(`Agent Eval ${caseId} 的 ${key} 必须是非负数字`);
    const execution = result.execution;
    if (!execution || typeof execution !== "object") throw new Error(`Agent Eval ${caseId} 缺少真实执行证据`);
    if (!["hermes-acp", "hermes-cli", "omnidesk-tool-gateway", "omnidesk-runtime"].includes(execution.executor)) throw new Error(`Agent Eval ${caseId} 的 executor 不受支持`);
    for (const key of ["fixture", "executedAt", "tracePath"]) if (!String(execution[key] || "").trim()) throw new Error(`Agent Eval ${caseId} 缺少 execution.${key}`);
  }
  return Object.freeze(results.map((result) => Object.freeze({ ...result, execution: Object.freeze({ ...result.execution }) })));
}

export function summarizeAgentEvaluation({ cases = [], results = [], generatedAt = new Date().toISOString() } = {}) {
  results = validateAgentEvaluationResults({ cases, results });
  const byId = new Map(results.map((result) => [result.caseId, result]));
  const evaluated = cases.map((item) => ({ ...item, result: byId.get(item.id) || null }));
  const completed = evaluated.filter((item) => item.result);
  const booleanRate = (key, expected) => {
    const applicable = expected ? completed.filter((item) => item.expected?.includes(expected)) : completed;
    return applicable.length ? applicable.filter((item) => item.result?.[key] === true).length / applicable.length : 0;
  };
  const durations = completed.map((item) => Number(item.result?.durationMs) || 0).filter(Boolean);
  const costs = completed.map((item) => Number(item.result?.costUsd) || 0);
  const approvals = completed.reduce((total, item) => total + (Number(item.result?.approvalCount) || 0), 0);
  return Object.freeze({
    schemaVersion: "omnidesk.agent-eval-report.v0.1",
    generatedAt,
    status: completed.length === cases.length ? "complete" : "incomplete",
    totals: { cases: cases.length, completed: completed.length, missing: cases.length - completed.length },
    metrics: {
      taskSuccessRate: booleanRate("success"),
      patchApplicableRate: booleanRate("patchApplicable", "patch"),
      checkPassRate: booleanRate("checksPassed", "check"),
      recoverySuccessRate: booleanRate("recovered", "resume"),
      approvalCount: approvals,
      averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      totalCostUsd: Number(costs.reduce((sum, value) => sum + value, 0).toFixed(6))
    },
    cases: evaluated.map(({ result, ...item }) => ({ ...item, result }))
  });
}

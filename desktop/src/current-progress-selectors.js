function valueOf(store, id, fallback) {
  return store.get(id)?.value ?? fallback;
}

const goalLabels = Object.freeze({
  active: "进行中",
  draft: "待确认",
  planned: "待拆解",
  "pending-confirm": "待确认完成",
  done: "已完成",
  failed: "需处理",
  queued: "待开始",
  paused: "已暂停",
});

const stageDefinitions = Object.freeze([
  { id: "defined", label: "目标定义" },
  { id: "decomposed", label: "任务拆解" },
  { id: "executing", label: "执行推进" },
  { id: "validating", label: "目标验收" },
  { id: "complete", label: "完成确认" },
]);

function goalStage(goal) {
  const stageIndex = {
    draft: 0,
    planned: 0,
    queued: 1,
    active: 2,
    paused: 2,
    failed: 2,
    "pending-confirm": 3,
    done: 4,
  }[goal?.status] ?? 0;
  return Object.freeze({
    currentId: stageDefinitions[stageIndex].id,
    label: goal ? goalLabels[goal.status] || goal.status || "待确认" : "待建立",
    steps: Object.freeze(stageDefinitions.map((step, index) => Object.freeze({
      ...step,
      state: index < stageIndex ? "done" : index === stageIndex ? "current" : "upcoming",
    }))),
  });
}

function validationLabel(status) {
  return {
    passed: "已通过",
    failed: "未通过",
    running: "验收中",
  }[status] || "--";
}

function nextProjectAction({ acceptanceReady, goal, reportStatus }) {
  if (!goal) return { id: "create-goal", title: "建立当前项目目标", meta: "项目需要一个可验收目标", routeId: "current-goal" };
  if (goal.status === "draft") return { id: "confirm-goal", title: "确认当前项目目标", meta: "确认范围后再进入拆解", routeId: "current-goal" };
  if (goal.status === "planned") return { id: "decompose-goal", title: "生成并确认目标拆解", meta: "从目标定义进入可执行结构", routeId: "current-goal" };
  if (goal.status === "queued") return { id: "start-goal", title: "启动当前目标", meta: "目标已拆解，等待开始", routeId: "current-goal" };
  if (goal.status === "failed" || reportStatus === "failed") return { id: "resolve-validation", title: "处理项目验收失败项", meta: "修复阻塞后重新验收", routeId: "validation-report" };
  if (goal.status === "pending-confirm") return { id: "confirm-completion", title: "确认当前目标完成", meta: "验收已结束，等待完成确认", routeId: "current-goal" };
  if (goal.status === "done") return { id: "next-goal", title: "选择或创建下一个项目目标", meta: "当前目标已经完成", routeId: "goal-history" };
  if (!acceptanceReady) return { id: "define-acceptance", title: "为当前目标建立验收标准", meta: "没有验收标准时不计算完成度", routeId: "acceptance-criteria" };
  return { id: "advance-goal", title: "继续推进当前目标并准备验收", meta: "按验收标准判断项目进展", routeId: "current-goal" };
}

export function selectCurrentProgress(store) {
  const goal = valueOf(store, "progress.goal", null);
  const acceptance = valueOf(store, "progress.acceptance", null);
  const validationReport = valueOf(store, "progress.validation-report", null);
  const risks = valueOf(store, "progress.risks", []);
  const evidence = valueOf(store, "progress.evidence", {});
  const criteria = Array.isArray(acceptance?.criteria) ? acceptance.criteria : [];
  const acceptanceReady = Boolean(goal?.id && acceptance?.goal?.id === goal.id && criteria.length);
  const acceptanceMissing = Boolean(goal?.id && !acceptanceReady);
  const reportStatus = acceptanceReady ? validationReport?.status || "missing" : "missing";
  const visibleRisks = Array.isArray(risks) ? risks : [];
  const nextAction = nextProjectAction({ acceptanceReady, goal, reportStatus });
  const files = Array.isArray(evidence.fileStatuses) && evidence.fileStatuses.length
    ? evidence.fileStatuses
    : (evidence.files || []).map((path) => ({ path, status: "found" }));

  return Object.freeze({
    id: "project-progress.main",
    render: true,
    summary: valueOf(store, "progress.summary", "当前进度会从项目里程碑、目标、验收和风险事实中自动汇总。"),
    milestone: valueOf(store, "progress.milestone", "尚未定义当前里程碑"),
    projectGoal: valueOf(store, "product.goal", "尚未登记项目目标"),
    goal: Object.freeze({
      title: goal?.shortTitle || goal?.title || "暂无目标",
      status: goal ? goalLabels[goal.status] || goal.status || "待确认" : "待建立",
      routeId: "current-goal",
    }),
    stage: goalStage(goal),
    acceptance: Object.freeze({
      label: acceptanceReady ? `${criteria.length} 项标准` : acceptanceMissing ? "缺少验收标准" : "--",
      kind: acceptanceMissing ? "missing-required" : acceptanceReady ? "ready" : "empty",
      meta: acceptanceReady ? "已关联当前目标" : acceptanceMissing ? "当前目标没有可用验收标准" : "等待当前目标建立后登记",
      routeId: "acceptance-criteria",
    }),
    validation: Object.freeze({
      label: validationLabel(reportStatus),
      kind: reportStatus === "missing" ? "empty" : reportStatus,
      meta: acceptanceReady && validationReport?.generatedAt ? validationReport.generatedAt : "--",
      routeId: "validation-report",
    }),
    risks: Object.freeze({
      count: visibleRisks.length,
      meta: visibleRisks[0]?.title || "当前没有已登记项目风险",
      routeId: "project-risks",
    }),
    nextAction: Object.freeze(nextAction),
    evidence: Object.freeze({
      count: files.length,
      files: Object.freeze([...new Set([".omnidesk/cache/workspace-facts.json", ...files.map((file) => file.path).filter(Boolean)])]),
      updatedAt: evidence.updatedAt || evidence.observedAt || null,
      status: evidence.status || "自动汇总",
    }),
  });
}

export const currentProgressSelectors = Object.freeze({ selectCurrentProgress });

export function resolvedStageGoalTurn(turn, action, parentTitle) {
  return {
    ...turn,
    actions: [
      { id: "supplement-stage-goal", label: "补充范围", title: action.title },
      { id: "open-stage-goal-decomposition", label: "进入任务拆解", target: "current-goal" },
    ],
    intent: "stage-goal-created",
    pendingAction: null,
    references: [],
    resolvedActionId: turn.pendingAction?.id,
    stageGoal: { parentTitle: parentTitle || "当前项目目标", scope: action.summary, status: "planned", title: action.title },
    statusLabel: "已登记",
    text: "阶段目标已登记。",
  };
}

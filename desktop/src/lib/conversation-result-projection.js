export function buildNonPlanConversationTurn({
  activeProjectGoalTitle,
  actionPromptsForMessage,
  chatResult,
  conversationDiagnostic,
  durationMs,
  eventsForMessage,
  message,
  messageKind,
  recommendedAction,
  requestId,
  safeDisplayText,
  stageGoalCandidate,
  statusLabelForMessage,
}) {
  if (stageGoalCandidate) {
    const action = { id: "create-stage-goal", label: "确认登记为阶段目标", summary: stageGoalCandidate.summary, title: stageGoalCandidate.title };
    return {
      kind: "stage-goal",
      turn: {
        id: `${Date.now()}-assistant`,
        durationMs,
        actions: [action],
        diagnostic: conversationDiagnostic(chatResult),
        events: eventsForMessage(messageKind, chatResult),
        intent: "stage-goal-candidate",
        pendingAction: { ...action, actionId: "create-stage-goal", id: `stage-goal-${requestId}`, type: "create-stage-goal" },
        references: [],
        requestId,
        role: "assistant",
        stageGoal: { parentTitle: activeProjectGoalTitle || "当前项目目标", scope: stageGoalCandidate.summary, status: "draft", title: stageGoalCandidate.title },
        statusLabel: "目标候选",
        text: "我识别到一个阶段目标候选，确认后才会登记。",
      },
    };
  }
  if (chatResult?.shouldCreatePlan) return null;
  const pendingAction = recommendedAction || null;
  const reply = safeDisplayText(chatResult?.reply, "我在。你可以继续说想做什么。");
  return {
    kind: "chat",
    turn: {
      id: `${Date.now()}-assistant`,
      durationMs,
      actions: chatResult?.intent === "task" ? actionPromptsForMessage(message, chatResult.intent) : [],
      diagnostic: conversationDiagnostic(chatResult),
      events: eventsForMessage(messageKind, chatResult),
      intent: chatResult?.intent || "chat",
      ephemeral: ["model-status", "connection-status"].includes(messageKind),
      pendingAction,
      references: Array.isArray(chatResult?.references) ? chatResult.references : [],
      requestId,
      role: "assistant",
      statusLabel: statusLabelForMessage(messageKind),
      text: pendingAction ? `${reply}\n\n回复“可以”后生成执行计划。` : reply,
    },
  };
}

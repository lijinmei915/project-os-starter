export function turnToAssistantMessage(turn, index = 0) {
  const id = String(turn?.id || `turn-${index}`);
  const role = turn?.role === "user" ? "user" : "assistant";
  if (turn?.stageGoal) {
    return {
      id,
      role,
      status: { type: "complete", reason: "stop" },
      content: [{
        type: "tool-call",
        toolCallId: `stage-goal-${id}`,
        toolName: "stage_goal",
        args: {
          actions: Array.isArray(turn.actions) ? turn.actions : [],
          intent: turn.intent,
          parentTitle: turn.stageGoal.parentTitle,
          scope: turn.stageGoal.scope,
          statusLabel: turn.statusLabel,
          title: turn.stageGoal.title,
          turnId: id,
        },
        result: turn.intent === "stage-goal-created" ? { status: "registered" } : undefined,
      }],
    };
  }
  return {
    id,
    role,
    ...(role === "assistant" ? { status: { type: "complete", reason: "stop" } } : {}),
    content: [{ type: "text", text: String(turn?.text || "") }],
  };
}

export function normalizeAssistantUiTurns(turns = []) {
  const normalized = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn?.intent === "stage-goal-candidate" && turns.slice(index + 1).some((item) => item?.intent === "stage-goal-created")) continue;
    if (["stage-goal-candidate", "stage-goal-created"].includes(turn?.intent) && !turn.stageGoal) {
      const title = String(turn.text || "").match(/「([^」]+)」/)?.[1] || "阶段目标";
      const previousUser = [...turns.slice(0, index)].reverse().find((item) => item?.role === "user");
      normalized.push({
        ...turn,
        actions: turn.intent === "stage-goal-created" ? [
          { id: "supplement-stage-goal", label: "补充范围", title },
          { id: "open-stage-goal-decomposition", label: "进入任务拆解", target: "current-goal" },
        ] : turn.actions,
        stageGoal: {
          parentTitle: "当前项目目标",
          scope: previousUser?.text || "--",
          title,
        },
        statusLabel: turn.intent === "stage-goal-created" ? "已登记" : "目标候选",
      });
      continue;
    }
    normalized.push(turn);
  }
  return normalized;
}

export function conversationTurnsToAssistantMessages(turns = []) {
  return normalizeAssistantUiTurns(turns).map(turnToAssistantMessage);
}

export function assistantUiPocEnabled(search = "") {
  return new URLSearchParams(search).get("conversationUi") === "assistant";
}

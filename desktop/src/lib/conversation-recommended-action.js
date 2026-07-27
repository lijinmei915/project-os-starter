export function recommendedActionFromChatResult(chatResult, requestId) {
  if (chatResult?.responseMode !== "native-recommendation-call") return null;
  const task = String(chatResult?.recommendedAction?.task || "").trim();
  if (!task || task.length > 1_200) return null;
  return {
    id: `recommend-agent-${requestId}`,
    task,
    type: "start-agent",
  };
}

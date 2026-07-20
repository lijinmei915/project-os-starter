export function applyConversationTakeover({ chatTurns, clearInput, onChatTurnsChange, onStopPlan, projectExecutionEvent, requestRef, runningRequest, setChatLoading, setPendingTurn, settleRequest, takeover, userTurn }) {
  if (takeover.decision === "continue-current") {
    setPendingTurn((current) => current ? { ...current, label: "继续当前请求" } : current);
    clearInput();
    return { handled: true, turns: chatTurns };
  }
  if (takeover.decision === "cancel") {
    let turns = chatTurns;
    if (settleRequest(requestRef, runningRequest.id, "cancelled")) {
      turns = projectExecutionEvent([...chatTurns, userTurn], { id: `${Date.now()}-assistant-cancelled`, outcome: "cancelled", requestId: runningRequest.id, text: "已按你的要求停止当前处理。" });
      onChatTurnsChange(turns);
    }
    setChatLoading(false); setPendingTurn(null); onStopPlan?.(); clearInput();
    return { handled: true, turns };
  }
  if (takeover.decision === "redirect") {
    settleRequest(requestRef, runningRequest.id, "cancelled");
    const turns = projectExecutionEvent(chatTurns, { id: `${Date.now()}-assistant-superseded`, outcome: "cancelled", requestId: runningRequest.id, text: "已停止旧方向，正在按你的新要求处理。" });
    setChatLoading(false); setPendingTurn(null); onStopPlan?.();
    return { handled: false, turns };
  }
  return { handled: false, turns: chatTurns };
}

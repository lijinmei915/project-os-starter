export function applyConversationTakeover({ cancelRequest, chatTurns, clearInput, onChatTurnsChange, onStopPlan, projectExecutionEvent, requestRef, runningRequest, setChatLoading, setPendingTurn, settleRequest, takeover, userTurn }) {
  if (takeover.decision === "continue-current") {
    setPendingTurn((current) => current ? { ...current, label: "继续当前请求" } : current);
    clearInput();
    return { handled: true, turns: chatTurns };
  }
  if (takeover.decision === "cancel") {
    let turns = chatTurns;
    if (settleRequest(requestRef, runningRequest.id, "cancelled")) {
      void cancelRequest?.(runningRequest.id);
      turns = projectExecutionEvent([...chatTurns, userTurn], { id: `${Date.now()}-assistant-cancelled`, outcome: "cancelled", requestId: runningRequest.id, text: "已按你的要求停止当前处理。" });
      onChatTurnsChange(turns);
    }
    setChatLoading(false); setPendingTurn(null); onStopPlan?.(); clearInput();
    return { handled: true, turns };
  }
  if (takeover.decision === "redirect") {
    if (settleRequest(requestRef, runningRequest.id, "cancelled")) void cancelRequest?.(runningRequest.id);
    setChatLoading(false); setPendingTurn(null); onStopPlan?.();
    return { handled: false, turns: chatTurns };
  }
  return { handled: false, turns: chatTurns };
}

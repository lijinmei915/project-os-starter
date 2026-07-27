export async function resolveConversationChatResult({
  attachments,
  chatWithModel,
  isTauri,
  localStatusReply,
  message,
  messageKind,
  previewChatResult,
  provider,
  providerHealth,
  requestContext,
  requestId,
  snapshot,
  tasks,
}) {
  if (messageKind === "task") {
    return { intent: "task", reply: "可以，我先生成计划。", shouldCreatePlan: true };
  }
  if (["model-status", "connection-status"].includes(messageKind)) {
    return {
      intent: messageKind,
      reply: localStatusReply({ kind: messageKind, provider, providerHealth, snapshot, tasks }),
      shouldCreatePlan: false,
    };
  }
  if (!isTauri) return previewChatResult(message, attachments.length > 0, snapshot, tasks, requestContext.contextState);
  return chatWithModel({
    attachments: attachments.map((attachment) => ({ dataUrl: attachment.dataUrl, mimeType: attachment.mimeType, name: attachment.name })),
    contextState: requestContext.contextState,
    message,
    recentTurns: requestContext.recentTurns.slice(0, -1),
    projectMemory: requestContext.projectMemory || [],
    responseContract: requestContext.contextState.expectedNextAction === "recommend-next"
      ? "recommendation-required"
      : "standard",
    requestId,
    summary: requestContext.summary,
  });
}

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
  withTimeout,
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
  return withTimeout(chatWithModel({
    attachments: attachments.map((attachment) => ({ dataUrl: attachment.dataUrl, mimeType: attachment.mimeType, name: attachment.name })),
    contextState: requestContext.contextState,
    message,
    recentTurns: requestContext.recentTurns.slice(0, -1),
    projectMemory: requestContext.projectMemory || [],
    requestId,
    summary: requestContext.summary,
  }), 12000, "模型响应超时，已切换到本地回答。");
}

export function shouldGenerateConversationPlan({ actionFromCommitment, attachmentsCount = 0, chatResult, isActionRequestMessage, message }) {
  return Boolean(chatResult?.shouldCreatePlan) || Boolean(actionFromCommitment) || isActionRequestMessage(message, attachmentsCount > 0);
}

export function modelHealthUpdate(chatResult, fallbackModel) {
  const model = chatResult?.providerModel || fallbackModel;
  if (chatResult?.providerStatus === "available") return { message: `${model} work`, model, status: "available" };
  if (["interrupted", "request-failed", "timed-out"].includes(chatResult?.providerStatus)) return null;
  if (chatResult?.providerStatus && chatResult.providerStatus !== "available") {
    return { message: chatResult.providerError || "模型不可用", model, status: chatResult.providerStatus };
  }
  return null;
}

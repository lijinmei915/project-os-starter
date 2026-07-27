export function shouldGenerateConversationPlan({ attachmentsCount = 0, chatResult, isActionRequestMessage, message }) {
  return Boolean(chatResult?.shouldCreatePlan) || isActionRequestMessage(message, attachmentsCount > 0);
}

export function modelHealthUpdate(chatResult, fallbackModel) {
  const model = chatResult?.providerModel || fallbackModel;
  if (chatResult?.providerStatus === "available") return { message: `${model} work`, model, status: "available" };
  if (["authentication-failed", "quota-exhausted", "model-unavailable"].includes(chatResult?.providerStatus)) {
    return { message: chatResult.providerError || "模型不可用", model, status: chatResult.providerStatus };
  }
  return null;
}

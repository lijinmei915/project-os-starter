export function submittedConversationAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    dataUrl: attachment.dataUrl,
    id: attachment.id,
    mimeType: attachment.type,
    name: attachment.name,
    url: attachment.url,
  }));
}

export function modelConversationAttachments(attachments = []) {
  return attachments.map(({ dataUrl, mimeType, name }) => ({ dataUrl, mimeType, name }));
}

export function releaseConversationAttachments(attachments = []) {
  attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
}

export function withActiveTaskConversationContext(baseRequestContext, { activeConversationTaskId, activeTask, taskGoalName, taskNextAction }) {
  if (!activeConversationTaskId || !activeTask) return baseRequestContext;
  return {
    ...baseRequestContext,
    contextState: {
      ...baseRequestContext.contextState,
      taskId: activeTask.id,
      taskTitle: activeTask.title || "",
      taskStatus: activeTask.status || "",
      taskGoal: taskGoalName(activeTask),
      taskSummary: activeTask.plan?.summary || activeTask.description || "",
      taskNextAction: taskNextAction(activeTask).label,
    },
  };
}

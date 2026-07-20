export const conversationStates = Object.freeze({
  idle: "idle",
  thinking: "thinking",
  awaitingConfirmation: "awaiting-confirmation",
  executing: "executing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export const conversationCommands = Object.freeze({
  answer: "answer",
  cancelAction: "cancel-action",
  confirmAction: "confirm-action",
  executeAction: "execute-action",
  inspectAction: "inspect-action",
  resumeTask: "resume-task",
  startPlan: "start-plan",
});

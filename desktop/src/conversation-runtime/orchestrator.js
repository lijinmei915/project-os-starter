import { followUpDecision } from "../lib/conversation-record.js";
import { conversationActionDecision } from "./action-registry.js";
import { conversationCommands } from "./contract.js";
import { classifyConversationIntent } from "./intent-router.js";

export function resolveConversationCommand({ activeTask, hasAttachments = false, message, pendingAction } = {}) {
  const decision = followUpDecision(message);
  if (pendingAction && decision === "cancel") return { command: conversationCommands.cancelAction, decision, pendingAction };
  if (pendingAction && decision === "inspect") return { command: conversationCommands.inspectAction, decision, pendingAction };
  if (pendingAction && decision === "confirm") return { command: conversationCommands.confirmAction, decision, pendingAction };
  if (pendingAction) {
    return { command: conversationCommands.answer, decision: "revise", intent: "chat", pendingAction };
  }
  if (!pendingAction && decision === "confirm" && activeTask) return { command: conversationCommands.resumeTask, decision, taskId: activeTask.id };
  const actionDecision = conversationActionDecision(message);
  if (actionDecision?.confirmation === "none") {
    return { ...actionDecision, command: conversationCommands.executeAction, decision: "execute" };
  }
  const intent = classifyConversationIntent(message, hasAttachments);
  return {
    command: intent === "task" ? conversationCommands.startPlan : conversationCommands.answer,
    decision,
    intent,
  };
}

import { derivePendingAction } from "../lib/conversation-record.js";
import { resolveConversationCommand } from "./orchestrator.js";
import { isDuplicateSubmission } from "./store.js";

export function prepareConversationSubmission({
  activeTask,
  attachments = [],
  message = "",
  now = Date.now(),
  previousSubmission,
  random = Math.random(),
  turns = [],
} = {}) {
  const text = String(message || "").trim();
  const submission = {
    at: now,
    key: `${text}\n${attachments.map((attachment) => attachment.name).join("|")}`,
  };
  if (isDuplicateSubmission(previousSubmission, submission)) {
    return { duplicate: true, submission };
  }
  const requestId = `${now}-${random.toString(16).slice(2)}`;
  const pendingAction = derivePendingAction(turns);
  const command = resolveConversationCommand({
    activeTask,
    hasAttachments: attachments.length > 0,
    message: text,
    pendingAction,
  });
  const userTurn = {
    attachments,
    id: `${now}-user`,
    requestId,
    resolvedActionId: ["confirm", "cancel"].includes(command.decision) ? pendingAction?.id || "" : "",
    role: "user",
    submissionId: requestId,
    text: text || "请根据截图帮我分析并修改。",
  };
  return { command, duplicate: false, pendingAction, requestId, startedAt: now, submission, userTurn };
}

export async function dispatchConversationCommand(command, handlers = {}) {
  const handler = handlers[command?.command];
  if (!handler) return { handled: false, result: false };
  return { handled: true, result: await handler(command) };
}

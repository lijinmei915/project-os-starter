import { normalizeTurnSummary } from "./summary.js";

export const conversationSchemaVersion = "omnidesk.conversation.v0.3";
export const legacyConversationSchemaVersion = "project-os.conversation.v0.3";
const compatibleLegacyConversationSchemaVersions = new Set([
  legacyConversationSchemaVersion,
  "project-os.desktop-conversation.v0.1",
  "omnidesk.desktop-conversation.v0.1",
]);

function normalizeWaitingForUserActionTurn(turn) {
  if (!isWaitingForUserAction(turn)) return turn;
  return { ...turn, outcome: "awaiting-confirmation" };
}

function normalizeLegacyInvalidPatchTurn(turn) {
  const invalidPatch = turn?.role === "assistant"
    && turn?.outcome === "succeeded"
    && /不是可应用的 diff|没有可应用的 diff/.test(String(turn?.text || ""));
  if (!invalidPatch) return turn;
  return {
    ...turn,
    diagnostic: turn.diagnostic || {
      detail: "历史记录中的草稿不是可应用的 unified diff。",
      label: "改动草稿不可应用",
      message: "任务和失败证据已保留，可补充要求后重新生成。",
    },
    events: Array.isArray(turn.events) ? turn.events.map((event) => event?.id === "change-draft-patch"
      ? { ...event, detail: event.detail || "当前草稿尚不可应用。", status: "failed" }
      : event) : turn.events,
    outcome: "failed",
  };
}

export function migrateConversationRecord(record = {}) {
  const turns = Array.isArray(record.turns)
    ? record.turns.map(normalizeWaitingForUserActionTurn).map(normalizeLegacyInvalidPatchTurn)
    : [];
  const waitingForUserAction = turns.some((turn) => turn?.outcome === "awaiting-confirmation"
    && Array.isArray(turn.actions) && turn.actions.some((action) => action?.id === "generate-patch"));
  const migrated = {
    ...record,
    runtimeState: waitingForUserAction && ["thinking", "executing"].includes(record.runtimeState)
      ? "awaiting-confirmation"
      : record.runtimeState || "idle",
    schemaVersion: conversationSchemaVersion,
    summary: waitingForUserAction
      ? { ...normalizeTurnSummary(record.summary), pendingAction: null }
      : normalizeTurnSummary(record.summary),
    turns,
  };
  if (compatibleLegacyConversationSchemaVersions.has(record.schemaVersion)) {
    migrated.schemaMigration = {
      from: record.schemaVersion,
      mode: "read-projection",
    };
  } else if (!record.schemaMigration) {
    delete migrated.schemaMigration;
  }
  return migrated;
}

function isWaitingForUserAction(turn) {
  if (turn?.role !== "assistant" || !["running", "awaiting-confirmation"].includes(turn?.outcome) || turn?.pendingAction) return false;
  return Array.isArray(turn.actions) && turn.actions.some((action) => action?.id === "generate-patch");
}

export function recoverConversationRuntime(record = {}) {
  const migrated = migrateConversationRecord(record);
  const unfinished = ["thinking", "executing"].includes(migrated.runtimeState);
  if (!unfinished) return migrated;
  const latestAssistant = [...migrated.turns].reverse().find((turn) => turn?.role === "assistant");
  if (isWaitingForUserAction(latestAssistant)) {
    return {
      ...migrated,
      recoveryReason: "awaiting-user-action",
      runtimeState: "awaiting-confirmation",
      summary: { ...migrated.summary, pendingAction: null },
    };
  }
  const task = migrated.summary.currentTopic || migrated.contextState?.currentTopic || "恢复上次请求";
  const latestTaskId = [...migrated.turns].reverse().find((turn) => turn.taskId)?.taskId || "";
  const interruptedActionId = migrated.summary.pendingAction?.id
    || [...migrated.turns].reverse().find((turn) => turn.pendingAction?.id)?.pendingAction?.id
    || "";
  const recoveryAction = { id: "retry", label: "重试", task };
  const actions = [
    recoveryAction,
    ...(latestTaskId ? [{ id: "open-topic", label: "查看任务", target: "execution", taskId: latestTaskId }] : []),
  ];
  let assistantIndex = -1;
  for (let index = migrated.turns.length - 1; index >= 0; index -= 1) {
    if (migrated.turns[index]?.role === "assistant") {
      assistantIndex = index;
      break;
    }
  }
  const recoveryTurn = {
    actions,
    diagnostic: {
      detail: "应用退出时请求仍处于处理中，迟到结果已失效。",
      label: "上次处理已中断",
      message: "可以重试，已有任务记录仍会保留。",
    },
    id: `recovery-${migrated.id || "conversation"}`,
    outcome: "failed",
    pendingAction: null,
    resolvedActionId: interruptedActionId,
    role: "assistant",
    text: "上次处理因应用关闭而中断，没有继续写入结果。",
  };
  const turns = assistantIndex < 0
    ? [...migrated.turns, recoveryTurn]
    : migrated.turns.map((turn, index) => index === assistantIndex ? { ...turn, ...recoveryTurn, id: turn.id || recoveryTurn.id } : turn);
  return {
    ...migrated,
    recoveryAction,
    recoveryReason: "interrupted",
    runtimeState: "failed",
    summary: { ...migrated.summary, pendingAction: null },
    turns,
  };
}

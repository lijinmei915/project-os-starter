import { buildTurnSummary, normalizeTurnSummary } from "../conversation-runtime/summary.js";

function compactText(value, maxLength = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

const ephemeralConversationPatterns = [
  /你是什么模型/i,
  /当前.*模型/i,
  /模型.*是什么/i,
  /模型状态/i,
  /网络.*可用/i,
  /连接.*(?:可用|好了|状态)/i,
  /模型.*可用/i,
];

export function isEphemeralConversationTurn(turn = {}) {
  if (turn.ephemeral === true || ["model-status", "connection-status"].includes(turn.intent)) return true;
  if (turn.role !== "user") return false;
  const text = compactText(turn.text, 160);
  return ephemeralConversationPatterns.some((pattern) => pattern.test(text));
}

export function isEphemeralConversation(record = {}) {
  if (record.kind === "ephemeral") return true;
  const turns = Array.isArray(record.turns) ? record.turns.filter((turn) => compactText(turn?.text)) : [];
  return Boolean(turns.length && turns.every(isEphemeralConversationTurn));
}

function isDelegation(text) {
  return /你(自己|来)?判断|直接(修|改|做|处理|执行)|帮我|替我|交给你|你决定|开始执行/.test(text);
}

export function isContextDependentFollowUp(text) {
  const compact = compactText(text, 80);
  return compact.length <= 36 && (
    followUpDecision(compact) !== "none"
    || /^(那|那么|然后|所以|这个|这些|它|上面|刚才|你就|你来|你自己|直接|继续|怎么办|为什么)/.test(compact)
  );
}

export function isDialogueActionRequest(message, hasAttachments = false) {
  const text = compactText(message, 600).toLowerCase();
  return hasAttachments || [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
    "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
    "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
    "直接修", "直接改", "直接做", "你来处理", "你自己处理", "运行一轮", "跑一轮",
  ].some((keyword) => text.includes(keyword));
}

export function followUpDecision(message) {
  const text = compactText(message, 40).replace(/[。！!，,\s]/g, "");
  if (/^(?:好(?:的)?|可以|行|继续|开始(?:吧)?|那(?:就)?开始(?:吧)?|执行|就这样|按这个来|(?:(?:那)?就)?这么做(?:吧)?|那就做(?:吧)?|开始做(?:吧)?|(?:可以)?推进(?:吧)?)$/.test(text)) return "confirm";
  if (/^(不用了|不用|取消|算了|先不做|停下|停止)$/.test(text)) return "cancel";
  if (/^(然后呢|下一步呢|接下来呢|所以呢)$/.test(text)) return "inspect";
  return "none";
}

export function derivePendingAction(turns = []) {
  const resolved = new Set();
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.resolvedActionId) resolved.add(turn.resolvedActionId);
    const action = turn?.pendingAction;
    if (action?.id && !resolved.has(action.id)) return action;
  }
  return null;
}

export function contextualizeUserMessage(message, contextState = {}) {
  const text = compactText(message, 600);
  if (!text || !contextState.currentTopic || !isContextDependentFollowUp(text)) return text;
  const parts = [`当前话题：${contextState.currentTopic}`];
  if (contextState.previousConclusion) parts.push(`上一结论：${contextState.previousConclusion}`);
  parts.push(`用户当前要求：${text}`);
  return parts.join("\n");
}

function expectedAction(text) {
  if (/直接(修|改)|修复|改一下|处理一下/.test(text)) return "apply-fix";
  if (/你(自己|来)?判断|你决定/.test(text)) return "decide-next";
  if (/执行|开始做|落实|实现/.test(text)) return "execute-task";
  if (/检查|验证|测试/.test(text)) return "run-checks";
  if (/建议|怎么办|下一步/.test(text)) return "recommend-next";
  if (/风险|问题|原因|为什么|怎么样|如何|怎么/.test(text)) return "answer-question";
  return "continue-conversation";
}

export function buildDialogueContextState(turns = [], summary) {
  const normalizedSummary = normalizeTurnSummary(summary);
  const meaningfulTurns = turns.filter((turn) => compactText(turn?.text));
  const userTurns = meaningfulTurns.filter((turn) => turn.role === "user");
  const assistantTurns = meaningfulTurns.filter((turn) => turn.role === "assistant");
  const latestUser = userTurns.at(-1);
  const latestAssistant = assistantTurns.at(-1);
  const latestUserText = compactText(latestUser?.text);
  const explicitTopicTurn = [...userTurns]
    .reverse()
    .find((turn, index) => index > 0 || !isContextDependentFollowUp(latestUserText)
      ? !isContextDependentFollowUp(compactText(turn?.text))
      : false);
  const firstUserText = compactText(userTurns[0]?.text);

  return {
    currentTopic: compactText(
      explicitTopicTurn?.text
        || normalizedSummary.currentTopic
        || firstUserText,
      160,
    ),
    expectedNextAction: expectedAction(latestUserText),
    lastIntent: latestUser?.intent || (isDelegation(latestUserText) ? "task" : "chat"),
    pendingQuestion: /[?？]|怎么办|为什么|如何|怎么|什么|是否|能不能/.test(latestUserText)
      ? latestUserText
      : normalizedSummary.unresolvedQuestions.at(-1) || "",
    previousConclusion: compactText(latestAssistant?.text || normalizedSummary.conclusions.at(-1)),
    pendingAction: derivePendingAction(turns) || normalizedSummary.pendingAction,
    userDelegation: isDelegation(latestUserText) ? latestUserText : normalizedSummary.userDelegation,
  };
}

export function buildChatRequestContext(turns = [], limit = 8, previousSummary) {
  const durableTurns = turns.filter((turn) => !isEphemeralConversationTurn(turn));
  const summary = buildTurnSummary(durableTurns, { previousSummary, recentLimit: limit });
  const meaningfulTurns = durableTurns
    .filter((turn) => ["user", "assistant"].includes(turn?.role) && compactText(turn?.text))
    .slice(-limit)
    .map((turn) => ({
      pendingAction: turn.pendingAction || null,
      resolvedActionId: turn.resolvedActionId || "",
      role: turn.role,
      text: compactText(turn.text, 600),
    }));
  return {
    contextState: buildDialogueContextState(meaningfulTurns, summary),
    recentTurns: meaningfulTurns,
    summary,
  };
}

export function buildConversationRecord({ goalId = "", id, projectId = "", summary: previousSummary, taskId = "", taskTitle = "", turns, updatedAt }) {
  const durableTurns = turns.filter((turn) => !isEphemeralConversationTurn(turn));
  const firstUser = durableTurns.find((turn) => turn.role === "user");
  const title = String(taskTitle || firstUser?.text || "新对话").trim().replace(/\s+/g, " ").slice(0, 24) || "新对话";
  const lastTurn = [...durableTurns].reverse().find((turn) => turn.text);
  return {
    id,
    goalId,
    projectId,
    contextState: buildDialogueContextState(durableTurns),
    preview: String(lastTurn?.text || "").trim().replace(/\s+/g, " ").slice(0, 72),
    summary: buildTurnSummary(durableTurns, { previousSummary }),
    taskId,
    title,
    turns: durableTurns.map(({ actions, conversationEvents, diagnostic, durationMs, events, id: turnId, intent, memoryReferences, outcome, pendingAction, providerStreamTrace, references, requestId, resolvedActionId, responseMode, role, statusLabel, submissionId, taskId, text, workflow }) => ({
      actions, conversationEvents, diagnostic, durationMs, events, id: turnId, intent, memoryReferences, outcome, pendingAction, providerStreamTrace, references, requestId, resolvedActionId, responseMode, role, statusLabel, submissionId, taskId, text, workflow,
    })),
    updatedAt,
  };
}

export function mergeConversationRecords(current, record) {
  return [record, ...current.filter((item) => {
    if (item.id === record.id) return false;
    if (record.taskId) return item.taskId !== record.taskId;
    return item.taskId || item.title !== record.title;
  })].slice(0, 50);
}

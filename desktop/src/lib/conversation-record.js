function compactText(value, maxLength = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isDelegation(text) {
  return /你(自己|来)?判断|直接(修|改|做|处理|执行)|帮我|替我|交给你|你决定|开始执行/.test(text);
}

export function isContextDependentFollowUp(text) {
  const compact = compactText(text, 80);
  return compact.length <= 36 && /^(那|那么|然后|所以|这个|这些|它|上面|刚才|你就|你来|你自己|直接|继续|怎么办|为什么)/.test(compact);
}

export function isDialogueActionRequest(message, hasAttachments = false) {
  const text = compactText(message, 600).toLowerCase();
  return hasAttachments || [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
    "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
    "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
    "直接修", "直接改", "直接做", "你来处理", "你自己处理",
  ].some((keyword) => text.includes(keyword));
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

export function buildDialogueContextState(turns = []) {
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

  return {
    currentTopic: compactText(explicitTopicTurn?.text || userTurns[0]?.text, 160),
    expectedNextAction: expectedAction(latestUserText),
    lastIntent: latestUser?.intent || (isDelegation(latestUserText) ? "task" : "chat"),
    pendingQuestion: /[?？]|怎么办|为什么|如何|怎么|什么|是否|能不能/.test(latestUserText) ? latestUserText : "",
    previousConclusion: compactText(latestAssistant?.text),
    userDelegation: isDelegation(latestUserText) ? latestUserText : "",
  };
}

export function buildChatRequestContext(turns = [], limit = 8) {
  const meaningfulTurns = turns
    .filter((turn) => ["user", "assistant"].includes(turn?.role) && compactText(turn?.text))
    .slice(-limit)
    .map((turn) => ({ role: turn.role, text: compactText(turn.text, 600) }));
  return {
    contextState: buildDialogueContextState(turns),
    recentTurns: meaningfulTurns,
  };
}

export function buildConversationRecord({ id, turns, updatedAt }) {
  const firstUser = turns.find((turn) => turn.role === "user");
  const title = String(firstUser?.text || "新对话").trim().replace(/\s+/g, " ").slice(0, 24) || "新对话";
  const lastTurn = [...turns].reverse().find((turn) => turn.text);
  return {
    id,
    contextState: buildDialogueContextState(turns),
    preview: String(lastTurn?.text || "").trim().replace(/\s+/g, " ").slice(0, 72),
    title,
    turns: turns.map(({ actions, id: turnId, intent, references, role, text }) => ({ actions, id: turnId, intent, references, role, text })),
    updatedAt,
  };
}

export function mergeConversationRecords(current, record) {
  return [record, ...current.filter((item) => item.id !== record.id && item.title !== record.title)].slice(0, 50);
}

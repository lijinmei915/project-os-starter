function compactText(value, maxLength = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isDelegation(text) {
  return /你(自己|来)?判断|直接(修|改|做|处理|执行)|帮我|替我|交给你|你决定|开始执行/.test(text);
}

function expectedAction(text) {
  if (/直接(修|改)|修复|改一下|处理一下/.test(text)) return "apply-fix";
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

  return {
    currentTopic: compactText(userTurns[0]?.text, 160),
    expectedNextAction: expectedAction(latestUserText),
    lastIntent: latestUser?.intent || (isDelegation(latestUserText) ? "task" : "chat"),
    pendingQuestion: /[?？]|怎么办|为什么|如何|怎么|什么|是否|能不能/.test(latestUserText) ? latestUserText : "",
    previousConclusion: compactText(latestAssistant?.text),
    userDelegation: isDelegation(latestUserText) ? latestUserText : "",
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
    turns: turns.map(({ actions, id: turnId, role, text }) => ({ actions, id: turnId, role, text })),
    updatedAt,
  };
}

export function mergeConversationRecords(current, record) {
  return [record, ...current.filter((item) => item.id !== record.id && item.title !== record.title)].slice(0, 50);
}

export const turnSummaryVersion = "project-os.turn-summary.v0.1";

function compactText(value, maxLength = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function uniqueBy(items, keyFor, limit) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(-limit);
}

function pendingActionFromTurns(turns) {
  const resolved = new Set();
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.resolvedActionId) resolved.add(turn.resolvedActionId);
    if (turn?.pendingAction?.id && !resolved.has(turn.pendingAction.id)) return turn.pendingAction;
  }
  return null;
}

export function emptyTurnSummary() {
  return {
    conclusions: [],
    constraints: [],
    coveredThroughTurnId: "",
    coveredTurnCount: 0,
    currentTopic: "",
    decisions: [],
    executionResults: [],
    pendingAction: null,
    unresolvedQuestions: [],
    userDelegation: "",
    version: turnSummaryVersion,
  };
}

export function normalizeTurnSummary(summary) {
  const fallback = emptyTurnSummary();
  if (!summary || typeof summary !== "object") return fallback;
  return {
    conclusions: Array.isArray(summary.conclusions) ? summary.conclusions.slice(-4) : [],
    constraints: Array.isArray(summary.constraints) ? summary.constraints.slice(-5) : [],
    coveredThroughTurnId: compactText(summary.coveredThroughTurnId),
    coveredTurnCount: Number.isInteger(summary.coveredTurnCount) && summary.coveredTurnCount > 0 ? summary.coveredTurnCount : 0,
    currentTopic: compactText(summary.currentTopic, 160),
    decisions: Array.isArray(summary.decisions) ? summary.decisions.slice(-5) : [],
    executionResults: Array.isArray(summary.executionResults) ? summary.executionResults.slice(-5) : [],
    pendingAction: summary.pendingAction && typeof summary.pendingAction === "object" ? summary.pendingAction : null,
    unresolvedQuestions: Array.isArray(summary.unresolvedQuestions) ? summary.unresolvedQuestions.slice(-3) : [],
    userDelegation: compactText(summary.userDelegation),
    version: turnSummaryVersion,
  };
}

export function buildTurnSummary(turns = [], { previousSummary, recentLimit = 8 } = {}) {
  const previous = normalizeTurnSummary(previousSummary);
  const meaningful = turns.filter((turn) => ["assistant", "user"].includes(turn?.role) && compactText(turn?.text, 600));
  const coveredCount = Math.max(0, meaningful.length - recentLimit);
  const covered = meaningful.slice(0, coveredCount);
  if (!covered.length) {
    return {
      ...previous,
      pendingAction: pendingActionFromTurns(turns) || previous.pendingAction,
    };
  }

  const topicTurn = [...covered].reverse().find((turn) => turn.role === "user"
    && !/^(那|那么|然后|所以|这个|这些|它|上面|刚才|你就|你来|你自己|直接|继续)/.test(compactText(turn.text, 80))
    && !/(不要|不能|必须|只做|只要|先别|暂时|保持|避免|不允许|不需要)/.test(turn.text));
  const conclusions = covered
    .filter((turn) => turn.role === "assistant" && !["running"].includes(turn.outcome))
    .map((turn) => compactText(turn.text, 360));
  const constraints = covered
    .filter((turn) => turn.role === "user" && /(不要|不能|必须|只做|只要|先别|暂时|保持|避免|不允许|不需要)/.test(turn.text))
    .map((turn) => compactText(turn.text, 280));
  const decisions = covered
    .filter((turn) => Boolean(turn.resolvedActionId) || (turn.role === "assistant" && turn.pendingAction))
    .map((turn) => ({
      actionId: turn.resolvedActionId || turn.pendingAction?.id || "",
      role: turn.role,
      text: compactText(turn.text, 280),
    }));
  const executionResults = covered
    .filter((turn) => turn.role === "assistant" && ["cancelled", "failed", "succeeded", "timed-out"].includes(turn.outcome))
    .map((turn) => ({
      outcome: turn.outcome,
      requestId: turn.requestId || "",
      taskId: turn.taskId || "",
      text: compactText(turn.text, 320),
    }));
  const lastCovered = covered.at(-1);
  const hasAnswerAfterLastCovered = lastCovered?.role === "user"
    && turns.slice(turns.indexOf(lastCovered) + 1).some((turn) => turn.role === "assistant" && compactText(turn.text));
  const unresolvedQuestions = lastCovered?.role === "user"
    && /[?？]|怎么办|为什么|如何|怎么|什么|是否|能不能/.test(lastCovered.text)
    && !hasAnswerAfterLastCovered
    ? [compactText(lastCovered.text, 280)]
    : [];
  const delegationTurn = [...covered].reverse().find((turn) => turn.role === "user"
    && /你(自己|来)?判断|直接(修|改|做|处理|执行)|帮我|替我|交给你|你决定|开始执行/.test(turn.text));

  return {
    conclusions: uniqueBy([...previous.conclusions, ...conclusions], (item) => item, 4),
    constraints: uniqueBy([...previous.constraints, ...constraints], (item) => item, 5),
    coveredThroughTurnId: covered.at(-1)?.id || previous.coveredThroughTurnId,
    coveredTurnCount: Math.max(previous.coveredTurnCount || 0, coveredCount),
    currentTopic: compactText(topicTurn?.text || previous.currentTopic, 160),
    decisions: uniqueBy([...previous.decisions, ...decisions], (item) => `${item.actionId}:${item.text}`, 5),
    executionResults: uniqueBy(
      [...previous.executionResults, ...executionResults],
      (item) => `${item.requestId}:${item.outcome}:${item.text}`,
      5,
    ),
    pendingAction: pendingActionFromTurns(turns),
    unresolvedQuestions: uniqueBy([...previous.unresolvedQuestions, ...unresolvedQuestions], (item) => item, 3),
    userDelegation: compactText(delegationTurn?.text || previous.userDelegation, 240),
    version: turnSummaryVersion,
  };
}

import { buildTurnSummary } from "../conversation-runtime/summary.js";

export const conversationRetention = Object.freeze({
  recentTurnLimit: 120,
});

export function retainConversationTurns(turns = [], { previousSummary, recentTurnLimit = conversationRetention.recentTurnLimit } = {}) {
  const normalizedTurns = Array.isArray(turns) ? turns : [];
  const limit = Math.max(1, Number(recentTurnLimit) || conversationRetention.recentTurnLimit);
  const evictedTurnCount = Math.max(0, normalizedTurns.length - limit);
  return {
    evictedTurnCount,
    summary: buildTurnSummary(normalizedTurns, { previousSummary, recentLimit: limit }),
    turns: evictedTurnCount ? normalizedTurns.slice(-limit) : normalizedTurns,
  };
}

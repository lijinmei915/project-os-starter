export function appendUniqueTurn(turns, turn) {
  if (!turn?.id || turns.some((item) => item.id === turn.id)) return turns;
  return [...turns, turn];
}

export function isDuplicateSubmission(previous, next, windowMs = 1200) {
  return Boolean(previous?.key && previous.key === next?.key && next.at - previous.at < windowMs);
}

export function normalizeConversationTurns(turns, normalizeReferences = (value) => value) {
  return turns.reduce((current, turn) => appendUniqueTurn(current, {
    ...turn,
    references: normalizeReferences(turn.references || []),
  }), []);
}

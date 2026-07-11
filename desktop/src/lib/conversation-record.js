export function buildConversationRecord({ id, turns, updatedAt }) {
  const firstUser = turns.find((turn) => turn.role === "user");
  const title = String(firstUser?.text || "新对话").trim().replace(/\s+/g, " ").slice(0, 24) || "新对话";
  const lastTurn = [...turns].reverse().find((turn) => turn.text);
  return {
    id,
    preview: String(lastTurn?.text || "").trim().replace(/\s+/g, " ").slice(0, 72),
    title,
    turns: turns.map(({ actions, id: turnId, role, text }) => ({ actions, id: turnId, role, text })),
    updatedAt,
  };
}

export function mergeConversationRecords(current, record) {
  return [record, ...current.filter((item) => item.id !== record.id && item.title !== record.title)].slice(0, 50);
}

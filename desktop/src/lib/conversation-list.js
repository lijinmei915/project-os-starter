function conversationTimestamp(conversation) {
  const timestamp = Date.parse(String(conversation?.updatedAt || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function conversationMatchesQuery(conversation, query = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [conversation?.title, conversation?.preview, conversation?.taskId]
    .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
}

export function groupConversations(conversations = [], { now = Date.now() } = {}) {
  const day = 24 * 60 * 60 * 1000;
  const visible = conversations
    .filter((conversation) => !conversation?.archivedAt)
    .sort((left, right) => conversationTimestamp(right) - conversationTimestamp(left));
  const activeItems = visible;
  const taskItems = activeItems.filter((conversation) => conversation?.taskId);
  const generalItems = activeItems.filter((conversation) => !conversation?.taskId);
  const groups = [];
  if (taskItems.length) groups.push({ items: taskItems, kind: "task", label: "任务对话" });
  const today = generalItems.filter((conversation) => now - conversationTimestamp(conversation) < day);
  const yesterday = generalItems.filter((conversation) => {
    const age = now - conversationTimestamp(conversation);
    return age >= day && age < day * 2;
  });
  const earlier = generalItems.filter((conversation) => now - conversationTimestamp(conversation) >= day * 2 || !conversationTimestamp(conversation));
  if (today.length) groups.push({ items: today, kind: "general", label: "今天" });
  if (yesterday.length) groups.push({ items: yesterday, kind: "general", label: "昨天" });
  if (earlier.length) groups.push({ items: earlier, kind: "general", label: "更早" });
  return groups;
}

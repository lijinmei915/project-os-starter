function conversationTimestamp(conversation) {
  const timestamp = Date.parse(String(conversation?.updatedAt || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function displayConversationText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function cleanConversationText(value) {
  return displayConversationText(value)
    .replace(/\s+/g, " ")
    .replace(/生成计划$/g, "")
    .trim();
}

function compactConversationText(value, maxLength) {
  const text = cleanConversationText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function isLowSignalConversationText(value) {
  const text = cleanConversationText(value);
  const normalized = text.replace(/[。！？!?,，\s]/g, "").toLowerCase();
  if (!normalized || /^\d+$/.test(normalized)) return true;
  if (["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(normalized)) return true;
  return [
    "我在",
    "已创建执行计划",
    "已生成执行前计划",
    "我先直接回答",
    "模型对话暂时不可用",
    "浏览器预览",
  ].some((phrase) => text.includes(phrase));
}

export function visibleConversationPreview(conversation) {
  const title = cleanConversationText(conversation?.title);
  const preview = cleanConversationText(conversation?.preview);
  if (!preview || preview === title || isLowSignalConversationText(preview)) return "";
  return compactConversationText(preview, 34);
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
    .filter((conversation) => !conversation?.archivedAt && !conversation?.taskId)
    .sort((left, right) => conversationTimestamp(right) - conversationTimestamp(left));
  const groups = [];
  const today = visible.filter((conversation) => now - conversationTimestamp(conversation) < day);
  const yesterday = visible.filter((conversation) => {
    const age = now - conversationTimestamp(conversation);
    return age >= day && age < day * 2;
  });
  const earlier = visible.filter((conversation) => now - conversationTimestamp(conversation) >= day * 2 || !conversationTimestamp(conversation));
  if (today.length) groups.push({ items: today, kind: "general", label: "今天" });
  if (yesterday.length) groups.push({ items: yesterday, kind: "general", label: "昨天" });
  if (earlier.length) groups.push({ items: earlier, kind: "general", label: "更早" });
  return groups;
}

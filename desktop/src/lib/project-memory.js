const MEMORY_VERSION = "project-os.memory.v0.1";
const MEMORY_KINDS = new Set(["constraint", "decision", "lesson", "preference", "result"]);
const CONFIRMED_KINDS = new Set(["constraint", "decision", "preference"]);

function text(value, limit = 360) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function keyFor(item) {
  return `${item.scope}:${item.kind}:${text(item.content, 180).toLocaleLowerCase("zh-CN")}`;
}

export function emptyProjectMemory(projectId = "") {
  return { schemaVersion: MEMORY_VERSION, projectId, updatedAt: "", items: [], audit: [] };
}

export function normalizeProjectMemory(memory = {}, projectId = "") {
  const items = Array.isArray(memory.items) ? memory.items : [];
  return {
    ...emptyProjectMemory(memory.projectId || projectId),
    ...memory,
    audit: Array.isArray(memory.audit) ? memory.audit.filter((event) => event?.id && event?.type && event?.at).slice(-240) : [],
    items: items.filter((item) => MEMORY_KINDS.has(item?.kind) && text(item.content)).map((item) => ({
      confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.6,
      createdAt: item.createdAt || "",
      expiresAt: item.expiresAt || null,
      id: text(item.id, 120),
      kind: item.kind,
      content: text(item.content),
      scope: ["project", "task", "conversation"].includes(item.scope) ? item.scope : "project",
      source: item.source && typeof item.source === "object" ? item.source : {},
      status: ["candidate", "confirmed", "superseded"].includes(item.status) ? item.status : "confirmed",
      updatedAt: item.updatedAt || item.createdAt || "",
      version: Number.isInteger(item.version) && item.version > 0 ? item.version : 1,
      conflictsWith: Array.isArray(item.conflictsWith) ? item.conflictsWith.filter(Boolean).map((id) => text(id, 120)) : [],
    })),
  };
}

function conflictKey(content) {
  return text(content, 180).toLocaleLowerCase("zh-CN")
    .replace(/(不要|不能|必须|只做|只要|先别|暂时|保持|避免|不允许|不需要|可以|允许|应该|应当|无需|不必)/g, "")
    .replace(/[，。！？、,!.?\s]/g, "");
}

function hasOpposingPolarity(left, right) {
  const negative = /(不要|不能|先别|避免|不允许|不需要|无需|不必)/;
  return negative.test(left) !== negative.test(right);
}

export function memoryConflicts(memory, candidate) {
  const current = normalizeProjectMemory(memory);
  const candidateKey = conflictKey(candidate?.content);
  if (candidateKey.length < 4) return [];
  return current.items
    .filter((item) => item.kind === candidate.kind && item.scope === (candidate.scope || (candidate.source?.taskId ? "task" : "project")))
    .filter((item) => conflictKey(item.content) === candidateKey && hasOpposingPolarity(item.content, candidate.content))
    .map((item) => item.id);
}

export function appendMemoryAudit(memory, event, { now = new Date().toISOString() } = {}) {
  const current = normalizeProjectMemory(memory);
  const normalized = {
    at: now,
    id: event.id || `memory-audit-${Date.now()}`,
    itemIds: Array.isArray(event.itemIds) ? event.itemIds.filter(Boolean).slice(0, 12) : [],
    reason: text(event.reason, 160),
    requestId: text(event.requestId, 120),
    taskId: text(event.taskId, 120),
    type: text(event.type, 48),
  };
  return { ...current, updatedAt: now, audit: [...current.audit, normalized].slice(-240) };
}

export function memoryCandidatesFromSummary(summary = {}, { conversationId = "", taskId = "" } = {}) {
  const source = { conversationId, taskId };
  const candidates = [];
  (summary.constraints || []).forEach((content) => candidates.push({ content, confidence: 0.9, kind: "constraint", source, status: "confirmed" }));
  (summary.decisions || []).forEach((decision) => candidates.push({ content: decision?.text, confidence: 0.82, kind: "decision", source, status: "candidate" }));
  (summary.executionResults || []).filter((result) => result?.outcome === "succeeded").forEach((result) => candidates.push({ content: result.text, confidence: 0.8, kind: "result", source: { ...source, taskId: result.taskId || taskId }, status: "candidate" }));
  return candidates.filter((item) => text(item.content));
}

export function memoryCandidatesFromTurns(turns = [], { conversationId = "", taskId = "" } = {}) {
  const source = { conversationId, taskId };
  return turns
    .filter((turn) => turn?.role === "user")
    .map((turn) => text(turn.text, 280))
    .filter((content) => /(不要|不能|必须|只做|只要|先别|暂时|保持|避免|不允许|不需要)/.test(content))
    .map((content) => ({ content, confidence: 0.9, kind: "constraint", source, status: "confirmed" }));
}

export function mergeProjectMemory(memory, candidates = [], { now = new Date().toISOString(), projectId = "" } = {}) {
  const current = normalizeProjectMemory(memory, projectId);
  const byKey = new Map(current.items.map((item) => [keyFor(item), item]));
  const audit = [];
  candidates.forEach((candidate, index) => {
    const conflictsWith = memoryConflicts({ ...current, items: [...byKey.values()] }, candidate);
    const item = {
      ...candidate,
      content: text(candidate.content),
      id: candidate.id || `memory-${Date.now()}-${index}`,
      scope: candidate.taskId || candidate.source?.taskId ? "task" : "project",
      createdAt: candidate.createdAt || now,
      updatedAt: now,
      status: conflictsWith.length ? "candidate" : candidate.status || (CONFIRMED_KINDS.has(candidate.kind) ? "confirmed" : "candidate"),
      conflictsWith,
      version: Number.isInteger(candidate.version) ? candidate.version : 1,
    };
    const previous = byKey.get(keyFor(item));
    if (previous) {
      byKey.set(keyFor(item), { ...previous, confidence: Math.max(previous.confidence, item.confidence), source: item.source, updatedAt: now, version: previous.version + 1 });
      audit.push({ id: `memory-audit-${Date.now()}-${index}`, type: "write-merged", itemIds: [previous.id], reason: "相同范围、类型和内容已合并。", at: now });
    } else {
      byKey.set(keyFor(item), item);
      audit.push({ id: `memory-audit-${Date.now()}-${index}`, type: conflictsWith.length ? "write-conflict" : "write-created", itemIds: [item.id, ...conflictsWith], reason: conflictsWith.length ? "与既有记忆存在相反约束，等待人工确认。" : "从对话摘要或明确约束提取。", at: now });
    }
  });
  return { ...current, projectId: current.projectId || projectId, updatedAt: now, items: [...byKey.values()].slice(-120), audit: [...current.audit, ...audit].slice(-240) };
}

export function retrieveProjectMemory(memory, { query = "", taskId = "", limit = 6, now = new Date().toISOString() } = {}) {
  const terms = text(query, 240).toLocaleLowerCase("zh-CN").split(/\s+/).filter((term) => term.length > 1);
  return normalizeProjectMemory(memory).items
    .filter((item) => item.status === "confirmed" && (!item.expiresAt || item.expiresAt > now))
    .map((item) => ({ item, score: (item.scope === "task" && item.source?.taskId === taskId ? 8 : 0) + item.confidence * 3 + terms.filter((term) => item.content.toLocaleLowerCase("zh-CN").includes(term)).length * 2 }))
    .sort((left, right) => right.score - left.score || String(right.item.updatedAt).localeCompare(String(left.item.updatedAt)))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function projectMemoryReferences(items = [], { query = "", taskId = "" } = {}) {
  const terms = text(query, 240).toLocaleLowerCase("zh-CN").split(/\s+/).filter((term) => term.length > 1);
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    reason: item.scope === "task" && item.source?.taskId === taskId
      ? "当前任务范围匹配"
      : terms.some((term) => item.content.toLocaleLowerCase("zh-CN").includes(term))
        ? "当前请求关键词匹配"
        : "已确认的项目协作上下文",
  }));
}

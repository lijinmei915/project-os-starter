import { resourceBudget } from "./resource-budget.js";

function sessionIdOf(session) {
  return session?.sessionId || session?.session_id || session?.id || "";
}

function withoutSession(record = {}, sessionId) {
  const next = { ...record };
  delete next[sessionId];
  return next;
}

export function nextTerminalSessionId(sessions = []) {
  const used = new Set(sessions.map(sessionIdOf).filter(Boolean));
  let index = sessions.length + 1;
  let id = `term-${index}`;
  while (used.has(id)) {
    index += 1;
    id = `term-${index}`;
  }
  return id;
}

export function appendTerminalCommandLog({ activeSessionId, logs = [], now, output, result, textBySession = {} }) {
  const command = result?.command || result?.id || "unknown command";
  const text = `${textBySession[activeSessionId] || ""}\n$ ${command}\n${output}\n`.slice(-resourceBudget.terminalTextLimit);
  return {
    logs: [{ command, id: `${now.id}-${result?.id || "terminal"}`, output: result?.output || (result?.success ? "Command completed." : "Command failed."), status: result?.success ? "success" : "failed", timestamp: now.timestamp }, ...logs].slice(0, resourceBudget.terminalLogLimit),
    textBySession: { ...textBySession, [activeSessionId]: text },
  };
}

export function closeTerminalSessionState({ activeSessionId, chunksBySession = {}, sessionId, sessions = [], textBySession = {} }) {
  const sessionIds = sessions.map(sessionIdOf).filter(Boolean);
  const index = sessionIds.indexOf(sessionId);
  const fallback = sessionIds[index - 1] || sessionIds[index + 1] || "main";
  return {
    activeSessionId: activeSessionId === sessionId ? fallback : activeSessionId,
    chunksBySession: withoutSession(chunksBySession, sessionId),
    sessions: sessions.filter((session) => sessionIdOf(session) !== sessionId),
    textBySession: withoutSession(textBySession, sessionId),
  };
}

export function clearTerminalSessionRefs(refs = {}, sessionId) {
  Object.values(refs).forEach((ref) => {
    if (ref?.current) delete ref.current[sessionId];
  });
}

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTerminalContext, formatTerminalContextForInput } from "../../lib/terminal-context";
import { measureDesktopPerformance } from "../../lib/performance-baseline";
import { appendTerminalCommandLog, clearTerminalSessionRefs, closeTerminalSessionState, nextTerminalSessionId } from "../../lib/terminal-session-controller";
import { resourceBudget } from "../../lib/resource-budget";

function safeText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function cleanTerminalText(value) {
  let text = safeText(value)
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-Z\\-_]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  while (text.includes("\b")) {
    const next = text.replace(/[^\n]\x08/g, "").replace(/^\x08/gm, "");
    if (next === text) break;
    text = next;
  }
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function hasTerminalScreenControl(value) {
  return /\x1Bc|\x1B\[[0-?]*[ -/]*[HJf]|\x1B\[[0-?]*[ -/]*[hl]/.test(safeText(value));
}

function isTerminalPromptEcho(text) {
  const lines = safeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length === 1 && /^[\w.-]+@[\w.-]+\s+\S+\s+[%$#]$/.test(lines[0]);
}

function terminalPromptLine(text) {
  const lines = safeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

function collapseDuplicateTerminalPromptLines(text) {
  const nextLines = [];
  safeText(text).split("\n").forEach((line) => {
    const trimmed = line.trim();
    const previous = nextLines.length ? nextLines[nextLines.length - 1].trim() : "";
    if (trimmed && trimmed === previous && isTerminalPromptEcho(trimmed)) return;
    nextLines.push(line);
  });
  return nextLines.join("\n");
}

// Owns terminal state, Tauri event handling, and session commands. App injects the runtime bridge.
export function useTerminalSession({ isTauri, terminalClient }) {
  const [terminalRunningId, setTerminalRunningId] = useState("");
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [activeTerminalSessionId, setActiveTerminalSessionId] = useState("main");
  const [terminalSessions, setTerminalSessions] = useState([]);
  const [terminalTextBySession, setTerminalTextBySession] = useState({});
  const [terminalChunksBySession, setTerminalChunksBySession] = useState({});
  const [terminalError, setTerminalError] = useState("");

  const lastTerminalPromptRef = useRef({});
  const terminalTextBySessionRef = useRef(terminalTextBySession);
  const terminalSessionsRef = useRef(terminalSessions);
  const terminalClearRequestedRef = useRef({});
  const terminalGenerationBySessionRef = useRef({});
  const terminalInputBufferRef = useRef({});
  const terminalLastOutputRef = useRef({});
  const terminalPassthroughRef = useRef({});

  useEffect(() => { terminalTextBySessionRef.current = terminalTextBySession; }, [terminalTextBySession]);
  useEffect(() => { terminalSessionsRef.current = terminalSessions; }, [terminalSessions]);

  const resetTerminalSessionState = useCallback(() => {
    setTerminalLogs([]);
    setActiveTerminalSessionId("main");
    setTerminalSessions([]);
    setTerminalTextBySession({});
    setTerminalChunksBySession({});
    setTerminalError("");
    lastTerminalPromptRef.current = {};
    terminalClearRequestedRef.current = {};
    terminalGenerationBySessionRef.current = {};
    terminalInputBufferRef.current = {};
    terminalLastOutputRef.current = {};
    terminalPassthroughRef.current = {};
  }, []);

  const startTerminalSession = useCallback(async (sessionId, { activate = true, reset = false } = {}) => {
    if (!isTauri) return false;
    setTerminalError("");
    try {
      if (reset) {
        await terminalClient.stopTerminalSession({ sessionId }).catch(() => {});
        setTerminalTextBySession((current) => ({ ...current, [sessionId]: "" }));
        setTerminalChunksBySession((current) => ({ ...current, [sessionId]: [] }));
        clearTerminalSessionRefs({ lastTerminalPromptRef, terminalClearRequestedRef, terminalGenerationBySessionRef, terminalInputBufferRef, terminalLastOutputRef, terminalPassthroughRef }, sessionId);
      }
      const session = await terminalClient.startTerminalSession({ sessionId, cols: 120, rows: 32 });
      terminalGenerationBySessionRef.current = { ...terminalGenerationBySessionRef.current, [sessionId]: Number(session.generation || 0) };
      setTerminalSessions((current) => [...current.filter((item) => (item.sessionId || item.session_id || item.id) !== sessionId), session]);
      setTerminalTextBySession((current) => ({ ...current, [sessionId]: current[sessionId] || `Connected to ${session.shell} at ${session.cwd}\n` }));
      setTerminalChunksBySession((current) => ({ ...current, [sessionId]: current[sessionId] || [] }));
      if (activate) setActiveTerminalSessionId(sessionId);
      return true;
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [isTauri, terminalClient]);

  useEffect(() => {
    if (!isTauri) {
      setTerminalTextBySession({ main: "浏览器预览不能启动本地终端。请在桌面 App 窗口里使用完整终端。" });
      setTerminalSessions([]);
      return undefined;
    }
    let cancelled = false;
    let unlisten = null;
    const start = async () => {
      try {
        unlisten = await terminalClient.subscribeTerminalOutput((event) => {
          const finishMeasure = measureDesktopPerformance("terminal-output");
          const payload = event.payload || {};
          const sessionId = payload.sessionId || "main";
          const generation = Number(payload.generation || 0);
          if (generation && terminalGenerationBySessionRef.current[sessionId] && generation !== Number(terminalGenerationBySessionRef.current[sessionId])) return;
          let data = payload.data || "";
          const now = Date.now();
          const lastOutput = terminalLastOutputRef.current[sessionId];
          if (lastOutput?.data === data && now - lastOutput.at < 80) return;
          terminalLastOutputRef.current = { ...terminalLastOutputRef.current, [sessionId]: { at: now, data } };
          const passthrough = Boolean(terminalPassthroughRef.current[sessionId]);
          if (!passthrough && !(terminalTextBySessionRef.current[sessionId] || "").trim()) data = data.replace(/^(?:\r?\n)+/, "");
          let cleanedData = cleanTerminalText(data);
          const screenControlOnly = !cleanedData && hasTerminalScreenControl(data);
          if (!cleanedData && !screenControlOnly) return;
          const previousText = terminalTextBySessionRef.current[sessionId] || "";
          if (terminalClearRequestedRef.current[sessionId]) {
            terminalClearRequestedRef.current = { ...terminalClearRequestedRef.current, [sessionId]: false };
            data = `\u001bc${data}`;
          }
          if (!passthrough) {
            const collapsed = collapseDuplicateTerminalPromptLines(cleanedData);
            if (collapsed !== cleanedData) { data = collapsed; cleanedData = collapsed; }
            const incoming = terminalPromptLine(cleanedData);
            if (isTerminalPromptEcho(cleanedData) && (lastTerminalPromptRef.current[sessionId]?.text === incoming || terminalPromptLine(previousText) === incoming)) return;
            if (isTerminalPromptEcho(cleanedData)) lastTerminalPromptRef.current = { ...lastTerminalPromptRef.current, [sessionId]: { at: now, text: incoming } };
          }
          const nextText = screenControlOnly ? previousText : `${previousText}${cleanedData}`.slice(-resourceBudget.terminalTextLimit);
          terminalTextBySessionRef.current = { ...terminalTextBySessionRef.current, [sessionId]: nextText };
          setTerminalChunksBySession((current) => {
            const chunks = current[sessionId] || [];
            return { ...current, [sessionId]: [...chunks, { data, id: `${Date.now()}-${chunks.length}` }].slice(-resourceBudget.terminalChunkLimit) };
          });
          setTerminalTextBySession((current) => ({ ...current, [sessionId]: nextText }));
          finishMeasure({ sessionId, textLength: nextText.length });
        });
        if (cancelled) { unlisten?.(); return; }
        await startTerminalSession("main", { activate: true });
      } catch (err) {
        if (!cancelled) {
          setTerminalError(err instanceof Error ? err.message : String(err));
          setTerminalTextBySession((current) => ({ ...current, main: current.main || "终端启动失败。" }));
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      unlisten?.();
      new Set(["main", ...terminalSessionsRef.current.map((item) => item.sessionId || item.session_id || item.id).filter(Boolean)]).forEach((sessionId) => terminalClient.stopTerminalSession({ sessionId }).catch(() => {}));
    };
  }, [isTauri, startTerminalSession, terminalClient]);

  const writeTerminalData = useCallback(async (data, { trackInput = true } = {}) => {
    if (!data) return false;
    const sessionId = activeTerminalSessionId;
    let dataToSend = data;
    if (trackInput) {
      if (data === "\u0003") terminalInputBufferRef.current = { ...terminalInputBufferRef.current, [sessionId]: "" };
      else {
        const previous = terminalInputBufferRef.current[sessionId] || "";
        const editing = data.startsWith("\u001b") || data === "\t" || (/[^\r\n\b\x20-\x7e]/.test(data));
        if (!editing && /[\r\n]/.test(data)) {
          if (/^codex(?:\s|$)/.test(previous.trim())) {
            dataToSend = "\u0015clear\u000dcodex\u000d";
            terminalClearRequestedRef.current = { ...terminalClearRequestedRef.current, [sessionId]: true };
            terminalPassthroughRef.current = { ...terminalPassthroughRef.current, [sessionId]: true };
            setTerminalTextBySession((current) => ({ ...current, [sessionId]: "" }));
            setTerminalChunksBySession((current) => ({ ...current, [sessionId]: [] }));
            delete terminalLastOutputRef.current[sessionId];
          }
          terminalInputBufferRef.current = { ...terminalInputBufferRef.current, [sessionId]: "" };
        } else if (!editing) {
          const nextInput = data === "\u007f" || data === "\b" ? previous.slice(0, -1) : `${previous}${data}`;
          let buffered = nextInput.slice(-240);
          if (buffered.length >= 2 && buffered.length % 2 === 0 && buffered.slice(0, buffered.length / 2) === buffered.slice(buffered.length / 2)) { buffered = buffered.slice(0, buffered.length / 2); dataToSend = ""; }
          terminalInputBufferRef.current = { ...terminalInputBufferRef.current, [sessionId]: buffered };
        }
      }
    }
    try {
      if (!dataToSend) { setTerminalError(""); return true; }
      await terminalClient.writeTerminalSession({ sessionId, data: dataToSend });
      setTerminalError("");
      return true;
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [activeTerminalSessionId, terminalClient]);

  const resizeTerminalSession = useCallback(async (cols, rows) => {
    if (!isTauri || !cols || !rows) return false;
    try { await terminalClient.resizeTerminalSession({ sessionId: activeTerminalSessionId, cols, rows }); return true; }
    catch (err) { setTerminalError(err instanceof Error ? err.message : String(err)); return false; }
  }, [activeTerminalSessionId, isTauri, terminalClient]);

  const closeTerminalSession = useCallback(async (sessionId) => {
    if (!sessionId || sessionId === "main") return false;
    try {
      if (isTauri) await terminalClient.stopTerminalSession({ sessionId });
      const next = closeTerminalSessionState({ activeSessionId: activeTerminalSessionId, chunksBySession: terminalChunksBySession, sessionId, sessions: terminalSessions, textBySession: terminalTextBySession });
      setTerminalSessions(next.sessions); setTerminalTextBySession(next.textBySession); setTerminalChunksBySession(next.chunksBySession); setActiveTerminalSessionId(next.activeSessionId);
      clearTerminalSessionRefs({ lastTerminalPromptRef, terminalClearRequestedRef, terminalGenerationBySessionRef, terminalInputBufferRef, terminalLastOutputRef, terminalPassthroughRef }, sessionId);
      return true;
    } catch (err) { setTerminalError(err instanceof Error ? err.message : String(err)); return false; }
  }, [activeTerminalSessionId, isTauri, terminalChunksBySession, terminalSessions, terminalTextBySession, terminalClient]);

  const appendContextToTerminal = useCallback(async (lines) => {
    window.dispatchEvent(new Event("project-os:open-terminal"));
    if (isTauri) return writeTerminalData(formatTerminalContextForInput(lines), { trackInput: false });
    const context = formatTerminalContext(lines);
    setTerminalTextBySession((current) => ({ ...current, [activeTerminalSessionId]: `${current[activeTerminalSessionId] || ""}${context}`.slice(-resourceBudget.terminalTextLimit) }));
    return true;
  }, [activeTerminalSessionId, isTauri, writeTerminalData]);

  const appendTerminalLog = useCallback((result) => {
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const input = {
      activeSessionId: activeTerminalSessionId,
      now: { id: Date.now(), timestamp: now },
      output: cleanTerminalText(result?.output || ""),
      result,
    };
    setTerminalLogs((current) => appendTerminalCommandLog({ ...input, logs: current, textBySession: terminalTextBySessionRef.current }).logs);
    setTerminalTextBySession((current) => appendTerminalCommandLog({ ...input, logs: terminalLogs, textBySession: current }).textBySession);
  }, [activeTerminalSessionId, terminalLogs]);

  const terminalSession = terminalSessions.find((item) => (item.sessionId || item.session_id || item.id) === activeTerminalSessionId) || null;
  return {
    activeTerminalSessionId, appendContextToTerminal, appendTerminalLog, closeTerminalSession, newTerminalSession: () => startTerminalSession(nextTerminalSessionId(terminalSessions), { activate: true }),
    openNativeTerminal: async () => { try { await terminalClient.openNativeTerminal(); setTerminalError(""); return true; } catch (err) { setTerminalError(err instanceof Error ? err.message : String(err)); return false; } },
    resetTerminalSessionState, resizeTerminalSession, restartTerminalSession: () => startTerminalSession(activeTerminalSessionId, { activate: true, reset: true }),
    setActiveTerminalSessionId, setTerminalLogs, setTerminalRunningId, terminalChunks: terminalChunksBySession[activeTerminalSessionId] || [], terminalError,
    terminalLogs, terminalRunningId, terminalSession, terminalSessions, terminalText: terminalTextBySession[activeTerminalSessionId] || "", writeTerminalData,
  };
}

import React, { useEffect, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { ArrowRight, Eraser, ExternalLink, Loader2, Plus, RotateCcw, Square, TerminalSquare, X } from "lucide-react";
import { formatTerminalInputForPaste } from "../../lib/terminal-context";
import { traceNativeTerminalStage } from "../../lib/native-test-trace";
import { isTauriRuntime } from "../../lib/runtime-api";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { Tooltip } from "../ui/tooltip";
import "@xterm/xterm/css/xterm.css";

function terminalThemeForCurrentMode() {
  const light = document.documentElement.classList.contains("theme-light");
  if (light) {
    return {
      background: "#ffffff",
      black: "#e9eaec",
      blue: "#1f5fbf",
      brightBlack: "#8f9399",
      brightBlue: "#175cd3",
      brightCyan: "#0e9384",
      brightGreen: "#087443",
      brightMagenta: "#6941c6",
      brightRed: "#b42318",
      brightWhite: "#111317",
      brightYellow: "#b54708",
      cursor: "#111317",
      cyan: "#0e9384",
      foreground: "#161a1f",
      green: "#067647",
      magenta: "#7f56d9",
      red: "#d92d20",
      selectionBackground: "#d7d9dd",
      white: "#f3f4f6",
      yellow: "#b54708",
    };
  }
  return {
    background: "#050908",
    black: "#101716",
    blue: "#7ea7ff",
    brightBlack: "#66706f",
    brightBlue: "#a9c2ff",
    brightCyan: "#8ee8d3",
    brightGreen: "#7ce4b0",
    brightMagenta: "#d7b7ff",
    brightRed: "#ff9a87",
    brightWhite: "#f4fbf8",
    brightYellow: "#ffe09a",
    cursor: "#35e6aa",
    cyan: "#68d8c2",
    foreground: "#d7e3df",
    green: "#35d892",
    magenta: "#c8a5ff",
    red: "#ff846f",
    selectionBackground: "#214238",
    white: "#d7e3df",
    yellow: "#ffd680",
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function TerminalDock({
  active = true,
  activeSessionId = "main",
  draftRequest,
  logs,
  runningId,
  onRunCheck,
  onWriteTerminalData,
  onResizeTerminalSession,
  onSelectTerminalSession,
  onNewTerminalSession,
  onCloseTerminalSession,
  onOpenNativeTerminal,
  onRestartTerminalSession,
  onSaveTerminalImage,
  text,
  chunks,
  session,
  sessions = [],
  error,
}) {
  const [terminalDraft, setTerminalDraft] = useState("");
  const [terminalDraftSending, setTerminalDraftSending] = useState(false);
  const [terminalImageError, setTerminalImageError] = useState("");
  const [terminalImageAttachments, setTerminalImageAttachments] = useState([]);
  const [terminalImagePreview, setTerminalImagePreview] = useState(null);
  const terminalDraftRef = React.useRef(null);
  const terminalHostRef = React.useRef(null);
  const xtermRef = React.useRef(null);
  const fitAddonRef = React.useRef(null);
  const writeDataRef = React.useRef(onWriteTerminalData);
  const resizeSessionRef = React.useRef(onResizeTerminalSession);
  const writtenChunkCountRef = React.useRef(0);
  const renderedSessionKeyRef = React.useRef("");
  const lastSizeRef = React.useRef({ cols: 0, rows: 0 });
  const isDesktopRuntime = isTauriRuntime();
  const isTerminalReady = Boolean(session);
  const terminalEmptyState = !isDesktopRuntime ? "preview" : error ? "failed" : "starting";
  const agentWorking = /(?:^|\n)\s*(?:Working|Running)\s*\(/i.test(String(text || ""));
  const visibleSessions = sessions.length ? sessions : session ? [session] : [];
  const sessionKey = session
    ? `${session.sessionId || session.session_id || session.id || activeSessionId}:${session.generation || ""}`
    : "";

  useEffect(() => {
    writeDataRef.current = onWriteTerminalData;
  }, [onWriteTerminalData]);

  useEffect(() => {
    resizeSessionRef.current = onResizeTerminalSession;
  }, [onResizeTerminalSession]);

  const syncTerminalSize = React.useCallback((force = false) => {
    if (!xtermRef.current || !fitAddonRef.current) return;
    try {
      traceNativeTerminalStage("terminal-dock.fit-start");
      fitAddonRef.current.fit();
      traceNativeTerminalStage("terminal-dock.fit-complete");
      const cols = xtermRef.current.cols;
      const rows = xtermRef.current.rows;
      if (!cols || !rows) return;
      if (!force && cols === lastSizeRef.current.cols && rows === lastSizeRef.current.rows) return;
      lastSizeRef.current = { cols, rows };
      resizeSessionRef.current?.(cols, rows);
    } catch {
      traceNativeTerminalStage("terminal-dock.fit-error");
      // Ignore fit races while the panel is settling.
    }
  }, []);

  useEffect(() => {
    if (!terminalHostRef.current || xtermRef.current) return undefined;
    traceNativeTerminalStage("terminal-dock.mount");

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 1.35,
      scrollOnUserInput: true,
      scrollback: 5000,
      theme: terminalThemeForCurrentMode(),
    });
    const fitAddon = new FitAddon();
    traceNativeTerminalStage("terminal-dock.xterm-created");
    terminal.loadAddon(fitAddon);
    terminal.open(terminalHostRef.current);
    traceNativeTerminalStage("terminal-dock.xterm-opened");
    try {
      traceNativeTerminalStage("terminal-dock.initial-focus-start");
      terminal.focus();
      traceNativeTerminalStage("terminal-dock.initial-focus-complete");
    } catch {
      traceNativeTerminalStage("terminal-dock.initial-focus-error");
    }
    terminal.attachCustomKeyEventHandler((event) => {
      if (
        event.type !== "keydown"
        || event.isComposing
        || event.key !== "Tab"
        || event.metaKey
        || event.ctrlKey
        || event.altKey
      ) {
        return true;
      }
      event.preventDefault();
      event.stopPropagation();
      terminal.scrollToBottom();
      writeDataRef.current(event.shiftKey ? "\u001b[Z" : "\t");
      return false;
    });
    const dataDisposable = terminal.onData((data) => {
      terminal.scrollToBottom();
      writeDataRef.current(data);
    });
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    requestAnimationFrame(() => {
      syncTerminalSize(true);
      requestAnimationFrame(() => syncTerminalSize(true));
    });

    const themeObserver = new MutationObserver(() => {
      terminal.options.theme = terminalThemeForCurrentMode();
    });
    themeObserver.observe(document.documentElement, { attributeFilter: ["class"], attributes: true });
    window.addEventListener("resize", syncTerminalSize);
    return () => {
      traceNativeTerminalStage("terminal-dock.cleanup");
      themeObserver.disconnect();
      window.removeEventListener("resize", syncTerminalSize);
      dataDisposable.dispose();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      writtenChunkCountRef.current = 0;
      renderedSessionKeyRef.current = "";
      lastSizeRef.current = { cols: 0, rows: 0 };
    };
  }, [syncTerminalSize]);

  useEffect(() => {
    if (!xtermRef.current) return;
    const replayChunks = Array.isArray(chunks) ? chunks : [];
    if (renderedSessionKeyRef.current !== sessionKey) {
      xtermRef.current.reset();
      replayChunks.forEach((chunk) => xtermRef.current.write(chunk.data || ""));
      writtenChunkCountRef.current = replayChunks.length;
      renderedSessionKeyRef.current = sessionKey;
      requestAnimationFrame(() => {
        syncTerminalSize(true);
        requestAnimationFrame(() => {
          syncTerminalSize(true);
          xtermRef.current?.scrollToBottom();
          xtermRef.current?.focus();
        });
      });
      return;
    }
    const nextChunks = replayChunks.slice(writtenChunkCountRef.current);
    nextChunks.forEach((chunk) => {
      xtermRef.current.write(chunk.data || "", () => xtermRef.current?.scrollToBottom());
    });
    writtenChunkCountRef.current = replayChunks.length;
  }, [chunks, sessionKey, syncTerminalSize]);

  useEffect(() => {
    if (!active || !xtermRef.current) return;
    traceNativeTerminalStage("terminal-dock.active-effect");
    requestAnimationFrame(() => {
      syncTerminalSize(true);
      requestAnimationFrame(() => syncTerminalSize(true));
      try {
        traceNativeTerminalStage("terminal-dock.active-focus-start");
        xtermRef.current?.focus();
        traceNativeTerminalStage("terminal-dock.active-focus-complete");
      } catch {
        traceNativeTerminalStage("terminal-dock.active-focus-error");
      }
    });
  }, [active, syncTerminalSize]);

  useEffect(() => {
    if (!draftRequest?.command) return;
    setTerminalDraft(draftRequest.command);
    requestAnimationFrame(() => terminalDraftRef.current?.focus());
  }, [draftRequest]);

  const clearTerminal = () => {
    xtermRef.current?.clear();
    writtenChunkCountRef.current = Array.isArray(chunks) ? chunks.length : 0;
    requestAnimationFrame(() => xtermRef.current?.focus());
  };

  const submitTerminalDraft = async () => {
    if (!terminalDraft || terminalDraftSending) return;
    setTerminalDraftSending(true);
    try {
      const command = terminalImageAttachments.length
        ? `codex ${terminalImageAttachments.map((image) => `-i ${shellQuote(image.path)}`).join(" ")} ${shellQuote(terminalDraft)}\n`
        : terminalDraft;
      const sent = await onWriteTerminalData(
        formatTerminalInputForPaste(command, { submit: true }),
        { trackInput: false }
      );
      if (sent !== false) {
        setTerminalDraft("");
        terminalImageAttachments.forEach((image) => URL.revokeObjectURL(image.url));
        setTerminalImageAttachments([]);
      }
    } finally {
      setTerminalDraftSending(false);
    }
  };

  const handleTerminalPaste = async (event) => {
    const image = Array.from(event.clipboardData?.files || []).find((file) => file.type.startsWith("image/"))
      || Array.from(event.clipboardData?.items || [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile?.();
    if (!image || !onSaveTerminalImage) return;
    event.preventDefault();
    event.stopPropagation();
    setTerminalImageError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
        reader.readAsDataURL(image);
      });
      const path = await onSaveTerminalImage({ name: image.name || "pasted-image.png", dataUrl });
      if (path) {
        setTerminalImageAttachments((current) => [...current, { name: image.name || "图片", path, url: URL.createObjectURL(image) }].slice(-6));
      }
    } catch (error) {
      setTerminalImageError(error instanceof Error ? error.message : String(error));
    }
  };

  if (!isTerminalReady) {
    const emptyStateLabel = terminalEmptyState === "preview"
      ? "preview"
      : terminalEmptyState === "failed"
        ? "启动失败"
        : "正在启动";
    const emptyStateTitle = terminalEmptyState === "preview"
      ? "浏览器预览不启动本地终端"
      : terminalEmptyState === "failed"
        ? "终端启动失败"
        : "正在启动本地终端";
    const emptyStateDescription = terminalEmptyState === "preview"
      ? (text || "请在桌面 App 窗口里使用完整终端。这里不会执行命令，也不会写入工程文件。")
      : terminalEmptyState === "failed"
        ? error
        : "正在连接当前项目的本地终端。";

    return (
      <section className="terminalDock" aria-label="终端" onPaste={handleTerminalPaste}>
        <div className="terminalDockHeader">
          <div className="terminalDockPrimary">
            <Tooltip content={emptyStateTitle}>
              <div className="terminalSessionTabs" role="tablist" aria-label="终端会话">
                <button className="terminalSessionTab active" type="button" role="tab" aria-selected="true">
                  {terminalEmptyState === "starting"
                    ? <Loader2 className="terminalLoadingIcon" aria-hidden="true" />
                    : <TerminalSquare aria-hidden="true" />}
                  <span>{emptyStateLabel}</span>
                </button>
              </div>
            </Tooltip>
          </div>
          {isDesktopRuntime ? (
            <div className="terminalDockActions">
              <Tooltip content="在原生终端打开">
                <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={onOpenNativeTerminal} aria-label="在原生终端打开">
                  <ExternalLink strokeWidth={2} aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>
          ) : null}
        </div>
        <div className="terminalPreviewEmpty">
          {terminalEmptyState === "starting"
            ? <Loader2 className="terminalLoadingIcon" aria-hidden="true" />
            : <TerminalSquare aria-hidden="true" />}
          <strong>{emptyStateTitle}</strong>
          <p>{emptyStateDescription}</p>
          {terminalDraft ? <code className="terminalPreviewCommand">{terminalDraft}</code> : null}
          {terminalEmptyState === "failed" ? (
            <Button size="sm" type="button" variant="default" onClick={onRestartTerminalSession}>
              <RotateCcw aria-hidden="true" />
              重试
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="terminalDock" aria-label="终端" onPaste={handleTerminalPaste}>
      <div className="terminalDockHeader">
        <div className="terminalDockPrimary">
          <Tooltip content={session?.cwd || "终端"}>
            <div className="terminalSessionTabs" role="tablist" aria-label="终端会话">
              {visibleSessions.map((item, index) => {
                const sessionId = item.sessionId || item.session_id || item.id || `term-${index + 1}`;
                const activeItem = sessionId === activeSessionId;
                const canClose = sessionId !== "main";
                return (
                  <div
                    className={`terminalSessionTab${activeItem ? " active" : ""}`}
                    key={sessionId}
                    role="tab"
                    aria-selected={activeItem}
                    tabIndex={0}
                    onClick={() => onSelectTerminalSession?.(sessionId)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onSelectTerminalSession?.(sessionId);
                    }}
                    title={item.cwd || session?.cwd || sessionId}
                  >
                    <TerminalSquare aria-hidden="true" />
                    <span>{sessionId === "main" ? "main" : sessionId.replace(/^terminal-/, "term-")}</span>
                    {canClose ? (
                      <span
                        aria-label={`关闭 ${sessionId}`}
                        className="terminalSessionClose"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onCloseTerminalSession?.(sessionId);
                        }}
                        role="button"
                        tabIndex={0}
                        title="关闭会话"
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          onCloseTerminalSession?.(sessionId);
                        }}
                      >
                        <X aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Tooltip>
        </div>
        <div className="terminalDockActions">
          <Tooltip content="在原生终端打开">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={onOpenNativeTerminal} aria-label="在原生终端打开">
              <ExternalLink strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="新建会话">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={onNewTerminalSession} aria-label="新建终端会话">
              <Plus strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="清空屏幕">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={clearTerminal} aria-label="清空终端屏幕">
              <Eraser strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="停止当前命令">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={() => onWriteTerminalData("\u0003")} aria-label="停止当前命令">
              <Square strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="重启终端">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={onRestartTerminalSession} aria-label="重启终端">
              <RotateCcw strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div
        className="terminal terminalDockOutput terminalDockXterm"
        onMouseDown={() => requestAnimationFrame(() => {
          xtermRef.current?.scrollToBottom();
          xtermRef.current?.focus();
        })}
        ref={terminalHostRef}
      />
      {agentWorking ? (
        <div className="terminalTaskNotice" role="status">
          <span>当前终端任务正在执行。需要补充或调整方向，请回到对话。</span>
          <button type="button" onClick={() => window.dispatchEvent(new Event("omnidesk:open-conversation"))}>返回对话调整</button>
        </div>
      ) : null}
      <div className="terminalComposer" role="region" aria-label="终端输入">
        {terminalImageAttachments.length ? (
          <div className="terminalImageAttachment" title={terminalImageAttachments.map((image) => image.path).join("\n")}>
            {terminalImageAttachments.map((image, index) => (
              <span className="terminalImageAttachmentItem" key={image.path}>
                <button className="terminalImageAttachmentPreview" aria-label={`预览 ${image.name}`} onClick={() => setTerminalImagePreview(image)} type="button">
                  <img src={image.url} alt="" />
                </button>
                <span>{image.name}</span>
                <button aria-label={`移除 ${image.name}`} onClick={() => { URL.revokeObjectURL(image.url); setTerminalImagePreview(null); setTerminalImageAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} type="button">×</button>
              </span>
            ))}
          </div>
        ) : null}
        <textarea
          aria-label="终端输入内容"
          className="terminalComposerInput"
          disabled={terminalDraftSending}
          onChange={(event) => setTerminalDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submitTerminalDraft();
          }}
          placeholder="输入终端内容..."
          onPaste={handleTerminalPaste}
          ref={terminalDraftRef}
          rows={1}
          value={terminalDraft}
        />
        <Tooltip content="发送到终端">
          <Button
            aria-label="发送到终端"
            className="terminalComposerSend"
            disabled={!terminalDraft || terminalDraftSending}
            onClick={submitTerminalDraft}
            size="icon"
            type="button"
            variant="primary"
          >
            {terminalDraftSending
              ? <Loader2 className="terminalLoadingIcon" aria-hidden="true" />
              : <ArrowRight aria-hidden="true" />}
          </Button>
        </Tooltip>
      </div>
      {terminalImageError ? <Notice className="terminalNotice" variant="danger">{terminalImageError}</Notice> : null}
      {error ? <Notice className="terminalNotice" variant="danger">{error}</Notice> : null}
      {terminalImagePreview ? (
        <div className="chatImagePreview" role="dialog" aria-modal="true" aria-label={`预览 ${terminalImagePreview.name}`} onClick={() => setTerminalImagePreview(null)}>
          <div className="chatImagePreviewPanel" onClick={(event) => event.stopPropagation()}>
            <div className="chatImagePreviewHeader">
              <span>{terminalImagePreview.name}</span>
              <button className="chatImagePreviewClose" type="button" onClick={() => setTerminalImagePreview(null)} aria-label="关闭图片预览">
                <X aria-hidden="true" strokeWidth={2.25} />
              </button>
            </div>
            <img src={terminalImagePreview.url} alt={terminalImagePreview.name} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

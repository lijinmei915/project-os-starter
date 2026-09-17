import React from "react";
import { publicErrorMessage } from "../../lib/public-error-message";
import { cn } from "../../lib/cn";
import { presentConversationActivity } from "../../conversation-runtime/presentation";

export function Conversation({ children, className, ...props }) {
  const conversationRef = React.useRef(null);
  const pinnedToBottomRef = React.useRef(true);

  React.useLayoutEffect(() => {
    const node = conversationRef.current;
    const viewport = node?.parentElement;
    if (!node || !viewport) return undefined;

    const scrollToBottom = () => {
      if (pinnedToBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
    };
    const updatePinnedState = () => {
      const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      pinnedToBottomRef.current = remaining <= 48;
    };

    scrollToBottom();
    viewport.addEventListener("scroll", updatePinnedState, { passive: true });
    const observer = new ResizeObserver(scrollToBottom);
    observer.observe(node);
    return () => {
      viewport.removeEventListener("scroll", updatePinnedState);
      observer.disconnect();
    };
  }, []);

  React.useLayoutEffect(() => {
    const viewport = conversationRef.current?.parentElement;
    if (viewport && pinnedToBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
  }, [children]);

  return (
    <div className={cn("conversation", className)} role="log" aria-live="polite" ref={conversationRef} {...props}>
      {children}
    </div>
  );
}

export function ConversationMessage({ children, className, grouped = false, meta, role = "assistant", title }) {
  const isUser = role === "user";
  const showMeta = isUser && Boolean(title || meta);

  return (
    <article className={cn("conversationMessage", `conversationMessage-${role}`, grouped && "conversationMessage-grouped", className)}>
      <div className="conversationBody">
        {showMeta ? (
          <div className="conversationMeta">
            {title ? <strong>{title}</strong> : null}
            {meta ? <span>{meta}</span> : null}
          </div>
        ) : null}
        <div className="conversationBubble">{children}</div>
      </div>
    </article>
  );
}

function formatDuration(durationMs) {
  const seconds = Math.max(0, Math.round((durationMs || 0) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

export function AgentProcessingStatus({ background = false, conversationEvents = [], durationMs = 0, events = [], label = "正在处理", running = false, startedAt, summary = "" }) {
  const [elapsed, setElapsed] = React.useState(durationMs);
  React.useEffect(() => {
    if (!running) {
      setElapsed(durationMs);
      return undefined;
    }
    const update = () => setElapsed(Date.now() - (startedAt || Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [durationMs, running, startedAt]);
  const activity = presentConversationActivity({ conversationEvents, events, label, running, summary });
  const failedEvent = events.find((event) => event.status === "failed")
    || conversationEvents.find((event) => event.status === "failed");
  const currentEvent = events.find((event) => event.status === "current")
    || conversationEvents.find((event) => event.status === "running");
  const showDuration = running || (!currentEvent && durationMs > 0);
  return (
    <details className={`agentProcessingStatus${running ? " running" : ""}${currentEvent ? " current" : ""}${failedEvent ? " failed" : ""}`} defaultOpen={running}>
      <summary>
        <span className="agentProcessingIndicator" aria-hidden="true" />
        <strong>{activity.summary}</strong>
        {showDuration ? <time>{formatDuration(elapsed)}</time> : null}
        {running && background ? <span className="agentProcessingBackgroundLabel">后台运行</span> : null}
        {(activity.timeline.length || activity.tools.length) ? <>
          <span className="agentProcessingDetailsLabel agentProcessingDetailsLabel-open">收起详情</span>
          <span className="agentProcessingDetailsLabel agentProcessingDetailsLabel-closed">查看详情</span>
        </> : null}
        <span className="agentProcessingChevron" aria-hidden="true" />
      </summary>
      {activity.timeline.length ? (
        <div className="agentProcessingSteps">
          {activity.timeline.map((event, index) => (
            <div
              aria-current={event.status === "current" ? "step" : undefined}
              className={`agentProcessingStep ${event.status || "pending"}`}
              key={event.id || `${event.label || event.title}-${index}`}
            >
              <span aria-hidden="true" />
              <div>
                <strong>{event.label || event.title}</strong>
                {event.detail ? <p>{event.status === "failed" ? publicErrorMessage(event.detail) : event.detail}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {activity.toolEvents.length ? (
        <div className="agentToolActivity" aria-label="工具调用">
          <strong>工具调用</strong>
          <ul>{activity.toolEvents.map((tool) => <li className={tool.status} key={tool.id}><span aria-hidden="true" /><div><b>{tool.label}</b>{tool.detail ? <p>{tool.detail}</p> : null}</div></li>)}</ul>
        </div>
      ) : null}
    </details>
  );
}

export function ConversationArtifact({ children, className, title }) {
  return (
    <section className={cn("conversationArtifact", className)}>
      {title ? <div className="conversationArtifactTitle">{title}</div> : null}
      {children}
    </section>
  );
}

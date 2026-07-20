import React from "react";
import { cn } from "../../lib/cn";
import { presentConversationActivity } from "../../conversation-runtime/presentation";

export function Conversation({ children, className, ...props }) {
  const conversationRef = React.useRef(null);

  React.useEffect(() => {
    const node = conversationRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "end" });
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

export function AgentProcessingStatus({ conversationEvents = [], durationMs = 0, events = [], label = "正在处理", running = false, startedAt }) {
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
  const activity = presentConversationActivity({ conversationEvents, events, label, running });
  const failedEvent = events.find((event) => event.status === "failed")
    || conversationEvents.find((event) => event.status === "failed");
  const currentEvent = events.find((event) => event.status === "current")
    || conversationEvents.find((event) => event.status === "running");
  const showDuration = running || (!currentEvent && durationMs > 0);
  return (
    <details className={`agentProcessingStatus${running ? " running" : ""}${currentEvent ? " current" : ""}${failedEvent ? " failed" : ""}`}>
      <summary>
        <span className="agentProcessingIndicator" aria-hidden="true" />
        <strong>{activity.summary}</strong>
        {showDuration ? <time>{formatDuration(elapsed)}</time> : null}
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
                {event.detail ? <p>{event.detail}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {activity.tools.length ? (
        <details className="agentToolActivity">
          <summary>已使用工具 {activity.tools.length}</summary>
          <ul>{activity.tools.map((tool) => <li key={tool}>{tool}</li>)}</ul>
        </details>
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

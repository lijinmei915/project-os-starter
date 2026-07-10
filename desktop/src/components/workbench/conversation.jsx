import React from "react";
import { cn } from "../../lib/cn";

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

export function ConversationArtifact({ children, className, title }) {
  return (
    <section className={cn("conversationArtifact", className)}>
      {title ? <div className="conversationArtifactTitle">{title}</div> : null}
      {children}
    </section>
  );
}

import React from "react";
import omnideskLogo from "../../assets/omnidesk-logo.svg";
import { cn } from "../../lib/cn";

export function Conversation({ children, className, ...props }) {
  return (
    <div className={cn("conversation", className)} role="log" aria-live="polite" {...props}>
      {children}
    </div>
  );
}

export function ConversationMessage({ children, className, grouped = false, meta, role = "assistant", title }) {
  const isUser = role === "user";
  const showIdentity = !isUser && !grouped;
  const displayTitle = title || (isUser ? "" : "OmniDesk");
  const showMeta = showIdentity && Boolean(displayTitle || meta);

  return (
    <article className={cn("conversationMessage", `conversationMessage-${role}`, grouped && "conversationMessage-grouped", className)}>
      {showIdentity ? (
        <div className="conversationAvatar" aria-hidden="true">
          <img src={omnideskLogo} alt="" />
        </div>
      ) : null}
      <div className="conversationBody">
        {showMeta ? (
          <div className="conversationMeta">
            {displayTitle ? <strong>{displayTitle}</strong> : null}
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

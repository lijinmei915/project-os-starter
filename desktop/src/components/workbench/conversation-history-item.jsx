import React from "react";
import { Archive, RotateCcw, X } from "lucide-react";
import { Panel } from "../ui/panel";
import { Tooltip } from "../ui/tooltip";
import { formatConversationUpdatedAt } from "../../lib/conversation-presentation";

export function ConversationHistoryItem({ conversation, active, onArchiveConversation, onDeleteConversation, onRestoreConversation, onSelectConversation }) {
  return (
    <Panel as="article" className={`conversationHistoryItem${active ? " active" : ""}`} padding="none">
      <div className="conversationHistoryRow">
        <button
          aria-label={`打开对话：${conversation.title}`}
          className="conversationHistoryButton"
          type="button"
          onClick={() => onSelectConversation(conversation.id)}
        >
          <div className="conversationHistoryHead">
            <div className="conversationHistoryTitle">
              <strong>{conversation.title}</strong>
            </div>
            <span>{formatConversationUpdatedAt(conversation.updatedAt)}</span>
          </div>
        </button>
        <div className="conversationHistoryActions">
          <Tooltip content={conversation.archivedAt ? "恢复对话" : "归档对话"}>
            <button
              aria-label={`${conversation.archivedAt ? "恢复" : "归档"}对话：${conversation.title}`}
              className="conversationHistoryArchive"
              type="button"
              onClick={() => (conversation.archivedAt ? onRestoreConversation : onArchiveConversation)?.(conversation.id)}
            >
              {conversation.archivedAt ? <RotateCcw strokeWidth={2} aria-hidden="true" /> : <Archive strokeWidth={2} aria-hidden="true" />}
            </button>
          </Tooltip>
          <Tooltip content="永久删除对话">
            <button
              aria-label={`永久删除对话：${conversation.title}`}
              className="conversationHistoryDelete"
              type="button"
              onClick={() => onDeleteConversation(conversation.id)}
            >
              <X strokeWidth={2} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    </Panel>
  );
}

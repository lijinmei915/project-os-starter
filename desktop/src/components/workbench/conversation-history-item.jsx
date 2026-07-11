import React from "react";
import { X } from "lucide-react";
import { Panel } from "../ui/panel";
import { Tooltip } from "../ui/tooltip";

export function ConversationHistoryItem({ conversation, active, onDeleteConversation, onSelectConversation }) {
  return (
    <Panel as="article" className={`conversationHistoryItem${active ? " active" : ""}`} padding="none">
      <button
        aria-label={`打开对话：${conversation.title}`}
        className="conversationHistoryButton"
        type="button"
        onClick={() => onSelectConversation(conversation.id)}
      >
        <div className="conversationHistoryHead">
          <strong>{conversation.title}</strong>
          <span>{conversation.updatedAt}</span>
        </div>
      </button>
      <Tooltip content="删除对话">
        <button
          aria-label={`删除对话：${conversation.title}`}
          className="conversationHistoryDelete"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteConversation(conversation.id);
          }}
        >
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </Tooltip>
    </Panel>
  );
}

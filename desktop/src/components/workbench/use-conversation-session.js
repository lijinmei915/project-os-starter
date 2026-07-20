import { useState } from "react";

export function useConversationSession() {
  const [chatTurns, setChatTurns] = useState([]);
  const [conversationSummary, setConversationSummary] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(() => `conv-${Date.now()}`);
  const [activeConversationTaskId, setActiveConversationTaskId] = useState("");

  return {
    activeConversationId,
    activeConversationTaskId,
    chatTurns,
    conversationSummary,
    conversations,
    setActiveConversationId,
    setActiveConversationTaskId,
    setChatTurns,
    setConversationSummary,
    setConversations,
  };
}

import { useEffect, useState } from "react";

const activeConversationStorageKey = "omnidesk.activeConversationId.v1";

function initialConversationId() {
  if (typeof window === "undefined") return `conv-${Date.now()}`;
  return window.localStorage.getItem(activeConversationStorageKey) || `conv-${Date.now()}`;
}

export function useConversationSession() {
  const [chatTurns, setChatTurns] = useState([]);
  const [conversationSummary, setConversationSummary] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [activeConversationTaskId, setActiveConversationTaskId] = useState("");

  useEffect(() => {
    if (activeConversationId) window.localStorage.setItem(activeConversationStorageKey, activeConversationId);
  }, [activeConversationId]);

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

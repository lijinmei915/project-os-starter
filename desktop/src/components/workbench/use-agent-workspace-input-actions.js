import { useCallback } from "react";

export function useAgentWorkspaceInputActions({ addImageFiles, chatTurns, composerRef, handleConversationTurnAction, setTaskInput }) {
  const handlePaste = useCallback((event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    addImageFiles(files);
  }, [addImageFiles]);

  const useStarterPrompt = useCallback((prompt) => {
    setTaskInput(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [composerRef, setTaskInput]);

  const handleAssistantUiAction = useCallback(async (action, turnId) => {
    const turn = chatTurns.find((item) => item.id === turnId);
    return handleConversationTurnAction(action, turn);
  }, [chatTurns, handleConversationTurnAction]);

  return { handleAssistantUiAction, handlePaste, useStarterPrompt };
}

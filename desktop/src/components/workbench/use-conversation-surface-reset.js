import { useEffect, useRef } from "react";

/** Resets transient Conversation surface state when a new conversation is selected. */
export function useConversationSurfaceReset({
  clearAttachments,
  composerResetKey,
  focusComposer,
  onChatTurnsChange,
  onSelectEngineeringFile,
  resetConversationRequest,
  resetWorkspaceTabs,
  setTerminalDraftRequest,
  setTaskInput,
}) {
  const actionsRef = useRef({});

  useEffect(() => {
    actionsRef.current = {
      clearAttachments,
      focusComposer,
      onChatTurnsChange,
      onSelectEngineeringFile,
      resetConversationRequest,
      resetWorkspaceTabs,
      setTerminalDraftRequest,
      setTaskInput,
    };
  });

  useEffect(() => {
    const actions = actionsRef.current;
    actions.setTaskInput("");
    actions.clearAttachments();
    actions.resetConversationRequest();
    actions.setTerminalDraftRequest(null);
    actions.onChatTurnsChange([]);
    actions.onSelectEngineeringFile?.(null);
    actions.resetWorkspaceTabs();
    actions.focusComposer?.();
  }, [composerResetKey]);
}

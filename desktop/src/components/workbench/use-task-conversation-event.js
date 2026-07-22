import { useCallback, useEffect } from "react";
import { clearTransientWorkspaceTabs } from "../../lib/workspace-tab-state";

export function useTaskConversationEvent({ onOpenTaskConversation, onSelectTask, setActiveWorkspaceTab, setWorkspaceTabs, tasks }) {
  const openTaskConversationWorkspace = useCallback((taskId) => {
    const normalizedTaskId = String(taskId || "");
    if (!tasks.some((task) => task.id === normalizedTaskId)) return false;
    void onOpenTaskConversation?.(normalizedTaskId);
    onSelectTask?.(normalizedTaskId, { preserveWorkspace: true });
    setWorkspaceTabs(clearTransientWorkspaceTabs);
    setActiveWorkspaceTab("plan");
    return true;
  }, [onOpenTaskConversation, onSelectTask, setActiveWorkspaceTab, setWorkspaceTabs, tasks]);

  useEffect(() => {
    const openTaskConversation = (event) => {
      openTaskConversationWorkspace(event.detail?.taskId);
    };
    window.addEventListener("omnidesk:open-task-conversation", openTaskConversation);
    return () => window.removeEventListener("omnidesk:open-task-conversation", openTaskConversation);
  }, [openTaskConversationWorkspace]);

  return { openTaskConversationWorkspace };
}

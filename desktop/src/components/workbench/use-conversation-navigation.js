import { deleteConversationState, newConversationState, openTaskConversationState, selectConversationState } from "../../lib/conversation-session-state";

export function useConversationNavigation({
  activeConversationId,
  conversations,
  deleteConversation,
  saveConversation,
  markProjectActivitySeen,
  onResetConversation,
  projectId,
  setActiveConversationId,
  setActiveConversationTaskId,
  setActiveTaskId,
  setChatTurns,
  setConversationResetKey,
  setConversationSummary,
  setReadonlyPlan,
  setSelectedEngineeringFile,
  setConversations,
  setRunnerError,
  tasks,
}) {
  const applyConversationState = (next, { clearFile = true } = {}) => {
    setActiveConversationId(next.activeConversationId);
    setActiveConversationTaskId(next.activeConversationTaskId);
    setChatTurns(next.turns);
    setConversationSummary(next.conversationSummary);
    setActiveTaskId(next.activeTaskId);
    setReadonlyPlan(next.readonlyPlan);
    if (clearFile) setSelectedEngineeringFile(null);
  };

  const openTaskConversation = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;
    applyConversationState(openTaskConversationState({ conversations, task }), { clearFile: false });
    return true;
  };

  const selectConversation = (id) => {
    const next = selectConversationState({ conversations, id, tasks });
    if (!next) return;
    markProjectActivitySeen(projectId);
    applyConversationState(next);
  };

  const deleteSelectedConversation = (id) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation || !window.confirm(`永久删除「${conversation.title}」？删除后无法恢复。`)) return;
    const state = deleteConversationState({ activeConversationId, conversations, id, tasks });
    setConversations(state.conversations);
    deleteConversation(id).catch((error) => setRunnerError(error instanceof Error ? error.message : String(error)));
    if (!state.next) return;
    applyConversationState(state.next);
    if (!state.conversations.length) setConversationResetKey((key) => key + 1);
  };

  const setConversationArchived = async (id, archivedAt) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return false;
    const next = { ...conversation, archivedAt: archivedAt || null, updatedAt: new Date().toISOString() };
    setConversations((current) => current.map((item) => item.id === id ? next : item));
    try {
      await saveConversation(next);
      if (id === activeConversationId && archivedAt) startNewConversation();
      return true;
    } catch (error) {
      setConversations((current) => current.map((item) => item.id === id ? conversation : item));
      setRunnerError(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const archiveConversation = (id) => setConversationArchived(id, new Date().toISOString());
  const restoreConversation = (id) => setConversationArchived(id, null);

  const startNewConversation = () => {
    applyConversationState(newConversationState());
    onResetConversation();
    setConversationResetKey((key) => key + 1);
  };

  return { archiveConversation, deleteConversation: deleteSelectedConversation, openTaskConversation, restoreConversation, selectConversation, startNewConversation };
}

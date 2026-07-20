import { useCallback } from "react";
import { isEphemeralConversation } from "../../lib/conversation-record";

/** Resets transient cross-domain state after switching the active Workspace. */
export function useWorkspaceEphemeralReset({
  listDesktopConversations,
  listDesktopTasks,
  recoverConversationRuntime,
  resetTerminalSessionState,
  setActiveConversationId,
  setActiveConversationTaskId,
  setActiveTaskId,
  setApplyError,
  setChatTurns,
  setConversationSummary,
  setConversations,
  setHandoffError,
  setPatchError,
  setPlanError,
  setReadonlyPlan,
  setRunnerError,
  setSelectedEngineeringFile,
  setTasks,
}) {
  return useCallback(() => {
    setActiveConversationId(`conv-${Date.now()}`);
    setActiveConversationTaskId("");
    setChatTurns([]);
    setConversationSummary(null);
    setActiveTaskId("");
    setReadonlyPlan(null);
    setSelectedEngineeringFile(null);
    setPlanError("");
    setRunnerError("");
    setPatchError("");
    setApplyError("");
    setHandoffError("");
    resetTerminalSessionState();
    listDesktopConversations()
      .then((records) => setConversations(Array.isArray(records) ? records.filter((record) => !isEphemeralConversation(record)).map(recoverConversationRuntime) : []))
      .catch(() => setConversations([]));
    listDesktopTasks()
      .then((records) => setTasks(Array.isArray(records) ? records : []))
      .catch(() => setTasks([]));
  }, [listDesktopConversations, listDesktopTasks, recoverConversationRuntime, resetTerminalSessionState, setActiveConversationId, setActiveConversationTaskId, setActiveTaskId, setApplyError, setChatTurns, setConversationSummary, setConversations, setHandoffError, setPatchError, setPlanError, setReadonlyPlan, setRunnerError, setSelectedEngineeringFile, setTasks]);
}

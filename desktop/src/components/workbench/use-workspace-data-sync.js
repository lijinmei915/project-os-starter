import { useEffect } from "react";
import { isEphemeralConversation } from "../../lib/conversation-record";
import { recoverTaskRuntime } from "../../lib/task-state";

/**
 * Loads the persisted Conversation and Task projections for the active Workspace.
 * Clients and state setters are injected so the lifecycle boundary stays usable
 * in both the Tauri runtime and the browser preview.
 */
export function useWorkspaceDataSync({
  projectId,
  projectPath,
  listDesktopConversations,
  listDesktopTasks,
  recoverConversationRuntime,
  saveDesktopConversation,
  saveDesktopTask,
  setConversations,
  taskStatuses,
  setTasks,
  setRunnerError,
}) {
  useEffect(() => {
    let cancelled = false;
    Promise.all([listDesktopConversations(), listDesktopTasks()])
      .then(([conversationRecords, taskRecords]) => {
        if (cancelled) return;
        const conversations = Array.isArray(conversationRecords)
          ? conversationRecords.filter((record) => !isEphemeralConversation(record)).map(recoverConversationRuntime)
          : [];
        const tasks = Array.isArray(taskRecords)
          ? taskRecords.map((task) => recoverTaskRuntime(task, conversations, taskStatuses))
          : [];
        setConversations(conversations);
        setTasks(tasks);
        if (saveDesktopConversation) {
          conversations.forEach((conversation, index) => {
            if (JSON.stringify(conversation) !== JSON.stringify(conversationRecords?.filter((record) => !isEphemeralConversation(record))[index])) void saveDesktopConversation(conversation).catch(() => {});
          });
        }
        if (saveDesktopTask) {
          tasks.forEach((task, index) => {
            if (JSON.stringify(task) !== JSON.stringify(taskRecords?.[index])) void saveDesktopTask(task).catch(() => {});
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setRunnerError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [listDesktopConversations, listDesktopTasks, projectId, projectPath, recoverConversationRuntime, saveDesktopConversation, saveDesktopTask, setConversations, setRunnerError, setTasks, taskStatuses]);
}

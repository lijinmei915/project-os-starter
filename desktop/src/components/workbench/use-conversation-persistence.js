import { useRef } from "react";
import { buildConversationRecord, isEphemeralConversationTurn, mergeConversationRecords } from "../../lib/conversation-record";
import { retainConversationTurns } from "../../lib/conversation-retention";
import { saveDesktopConversation } from "../../lib/desktop-conversation-client";
import { getProjectMemory, saveProjectMemory } from "../../lib/project-memory-client";
import { memoryCandidatesFromSummary, memoryCandidatesFromTurns, mergeProjectMemory } from "../../lib/project-memory";
import { measureDesktopPerformance } from "../../lib/performance-baseline";
import { conversationRuntimeState, migrateConversationRecord, normalizeConversationReferences, normalizeConversationTurns } from "../../conversation-runtime";

export function useConversationPersistence({
  activeConversationId, activeConversationTaskId, activeTask, conversationSummary, setAndPersistTask,
  setChatTurns, setConversationSummary, setConversations, setRunnerError, snapshot, tasks,
}) {
  const persistRef = useRef(Promise.resolve());
  return (nextTurns) => {
    const finishMeasure = measureDesktopPerformance("conversation-update");
    const normalizedTurns = normalizeConversationTurns(nextTurns, normalizeConversationReferences);
    const retention = retainConversationTurns(normalizedTurns, { previousSummary: conversationSummary });
    const turns = retention.turns;
    setChatTurns(turns);
    finishMeasure({ evictedTurnCount: retention.evictedTurnCount, retainedTurnCount: turns.length });
    const durableTurns = turns.filter((turn) => !isEphemeralConversationTurn(turn));
    if (!durableTurns.length) return;
    const task = tasks.find((item) => item.id === activeConversationTaskId);
    const record = migrateConversationRecord({
      ...buildConversationRecord({
        goalId: task?.goalId || "", id: activeConversationId, projectId: snapshot.currentProjectId || "",
        summary: conversationSummary, taskId: task?.id || "", taskTitle: task?.title || "", turns: durableTurns,
        updatedAt: new Date().toISOString(),
      }),
      summary: retention.summary,
      runtimeState: conversationRuntimeState({ activeTask, turns }).state,
    });
    setConversationSummary(record.summary);
    setConversations((current) => mergeConversationRecords(current, record));
    persistRef.current = persistRef.current.catch(() => {}).then(async () => {
      await saveDesktopConversation(record);
      const candidates = [
        ...memoryCandidatesFromSummary(record.summary, { conversationId: record.id, taskId: task?.id || "" }),
        ...memoryCandidatesFromTurns(durableTurns, { conversationId: record.id, taskId: task?.id || "" }),
      ];
      if (candidates.length) {
        const memory = await getProjectMemory();
        await saveProjectMemory(mergeProjectMemory(memory, candidates, { projectId: snapshot.currentProjectId || "" }));
      }
    }).catch((error) => setRunnerError(error instanceof Error ? error.message : String(error)));
    const latest = [...turns].reverse().find((turn) => turn.role === "assistant" && String(turn.text || "").trim());
    if (task && latest && task.latestResult !== latest.text) {
      void setAndPersistTask({ ...task, conversationId: activeConversationId, conversationSummary: record.summary, conversationUpdatedAt: new Date().toISOString(), latestResult: latest.text, updatedAt: new Date().toISOString() }, { durable: true })
        .catch((error) => setRunnerError(error instanceof Error ? error.message : String(error)));
    }
  };
}

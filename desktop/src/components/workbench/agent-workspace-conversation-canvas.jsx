import { ConversationTranscript } from "./conversation-transcript";
import { TabsContent } from "../ui/tabs";

export function AgentWorkspaceConversationCanvas({
  assistantUi,
  chatLoading,
  chatLoadingEvents,
  chatLoadingLabel,
  chatStartedAt,
  conversationState,
  error,
  isEmpty,
  loading,
  onTurnAction,
  onUseStarterPrompt,
  pendingTurn,
  phase,
  starterPrompts,
  streamingReply,
  tasks,
  turns,
}) {
  return (
    <TabsContent className="workspaceTabContent agentCanvas" value="plan">
      {assistantUi || (isEmpty ? (
        <div className="conversationStart">
          <h2>有什么新点子？</h2>
          <div className="conversationStarters" aria-label="建议任务">
            {starterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => onUseStarterPrompt(prompt)}>{prompt}</button>)}
          </div>
        </div>
      ) : (
        <ConversationTranscript
          chatLoading={chatLoading}
          chatLoadingEvents={chatLoadingEvents}
          chatLoadingLabel={chatLoadingLabel}
          chatStartedAt={chatStartedAt}
          conversationState={conversationState}
          error={error}
          loading={loading}
          onTurnAction={onTurnAction}
          pendingTurn={pendingTurn}
          phase={phase}
          streamingReply={streamingReply}
          tasks={tasks}
          turns={turns}
        />
      ))}
    </TabsContent>
  );
}

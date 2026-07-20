import { AgentTopicCapabilitySummary } from "./agent-topic-capability-summary";
import { AgentTopicTaskBoard } from "./agent-topic-task-board";
import { AgentTopicCurrentTaskDetail, AgentTopicExecutionResults } from "./agent-topic-task-detail";
import { ControlledCommandsPanel } from "./controlled-commands-panel";

/** Stateless content branch for the Agent topic surface. */
export function AgentTopicPanelContent({
  id,
  topic,
  compact,
  capabilityKind,
  activeCapabilitySpec,
  canPreviewAgentTopicFile,
  cards,
  onOpenCapabilityFile,
  taskBoardProps,
  currentTaskDetailProps,
  executionResultsProps,
}) {
  return (
    <div className="agentTopicStack" aria-label={`${topic.title}状态`}>
      <AgentTopicCapabilitySummary
        capabilityKind={capabilityKind}
        capabilitySpec={activeCapabilitySpec}
        canPreviewFile={canPreviewAgentTopicFile}
        cards={cards}
        compact={compact}
        onOpenFile={onOpenCapabilityFile}
      />
      {id === "task-list" ? <AgentTopicTaskBoard {...taskBoardProps} /> : null}
      {id === "execution-terminal" ? <ControlledCommandsPanel /> : null}
      {id === "task-list" ? <AgentTopicCurrentTaskDetail {...currentTaskDetailProps} /> : null}
      {id === "execution-results" ? <AgentTopicExecutionResults {...executionResultsProps} /> : null}
    </div>
  );
}

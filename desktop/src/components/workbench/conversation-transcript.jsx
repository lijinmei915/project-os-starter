import { FileText } from "lucide-react";
import { conversationTextForDisplay } from "../../conversation-runtime";
import { Badge } from "../ui/badge";
import { PatchDraft, ReadonlyPlan } from "./plan-views";
import { AgentProcessingStatus, Conversation, ConversationMessage } from "./conversation";

function agentEventsForTurn(turn) {
  return Array.isArray(turn?.events) ? turn.events : [];
}

function shouldShowAgentTimeline(turn) {
  const events = agentEventsForTurn(turn);
  return Boolean(
    events.length
    && (turn.intent === "task" || turn.workflow?.length || events.some((event) => ["current", "failed"].includes(event.status)))
  );
}

function referenceSignature(references = []) {
  return references.map((reference) => `${reference.kind}:${reference.target}`).sort().join("|");
}

function previousAssistantReferenceSignature(turns, beforeIndex) {
  const previous = turns.slice(0, beforeIndex).reverse().find((turn) => turn.role === "assistant");
  return referenceSignature(previous?.references);
}

function displayText(value) {
  return String(value || "").replace(/\u0000/g, "") || "--";
}

function TaskOutcome({ turn }) {
  if (!turn?.taskId || turn.pendingAction || !["succeeded", "failed"].includes(turn.outcome)) return null;
  const succeeded = turn.outcome === "succeeded";
  return <div className="conversationTaskOutcome">
    <Badge variant={succeeded ? "success" : "danger"}>{succeeded ? "验收通过" : "需要处理"}</Badge>
    <span>{succeeded ? "结果已写入任务记录。" : "失败证据已保留，可从执行工作面继续处理。"}</span>
  </div>;
}

function Attachments({ attachments }) {
  if (!attachments?.length) return null;
  return (
    <div className="conversationAttachmentGrid">
      {attachments.map((attachment) => (
        <figure className="conversationAttachment" key={attachment.id}>
          <img src={attachment.url} alt={attachment.name} />
          <figcaption>{attachment.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ConversationTranscript({
  chatLoading,
  chatLoadingEvents,
  chatLoadingLabel,
  chatStartedAt,
  conversationState,
  error,
  loading,
  onTurnAction,
  pendingTurn,
  phase,
  streamingReply,
  tasks,
  turns,
}) {
  return (
    <Conversation data-runtime-state={conversationState}>
      {turns.map((turn, turnIndex) => (
      <ConversationMessage key={turn.id} role={turn.role}>
        {shouldShowAgentTimeline(turn) ? (
          <AgentProcessingStatus conversationEvents={turn.conversationEvents} durationMs={turn.durationMs} events={agentEventsForTurn(turn)} />
        ) : null}
          {turn.taskId || turn.pendingAction?.type === "confirm-active-task" ? (() => {
            const taskId = turn.taskId || turn.pendingAction.taskId;
            const task = tasks.find((item) => item.id === taskId);
            return task?.plan ? <ReadonlyPlan className="conversationReadonlyPlan" plan={task.plan} statusLabel={turn.pendingAction ? "计划待确认" : "已确认"} /> : null;
          })() : null}
          {turn.stageGoal ? (
            <section className="conversationGoal" aria-label={turn.intent === "stage-goal-created" ? "已登记阶段目标" : "阶段目标候选"}>
              <div className="conversationGoalHeader">
                <strong>{turn.stageGoal.title}</strong>
                <Badge variant={turn.intent === "stage-goal-created" ? "success" : "warning"}>{turn.statusLabel}</Badge>
              </div>
              <dl>
                <div><dt>范围</dt><dd>{turn.stageGoal.scope || "--"}</dd></div>
                <div><dt>关联项目目标</dt><dd>{turn.stageGoal.parentTitle || "--"}</dd></div>
                <div><dt>状态</dt><dd>{turn.intent === "stage-goal-created" ? "待拆解" : "待确认"}</dd></div>
              </dl>
              {turn.intent === "stage-goal-candidate" ? <p>确认前不会写入目标，也不会创建任务或开始执行。</p> : null}
            </section>
          ) : <div>{conversationTextForDisplay(displayText(turn.text))}</div>}
          <TaskOutcome turn={turn} />
          {turn.pendingAction?.type === "apply-patch" ? (
            <PatchDraft className="conversationPatchDraft" draft={tasks.find((task) => task.id === turn.pendingAction.taskId)?.patchDraft} />
          ) : null}
          {turn.diagnostic ? (
            <div className="conversationDiagnostic">
              <span>{turn.diagnostic.label}</span>
              <p>{turn.diagnostic.message}</p>
              {turn.diagnostic.detail ? <details><summary>Details</summary><code>{turn.diagnostic.detail}</code></details> : null}
            </div>
          ) : null}
          {turn.references?.length && referenceSignature(turn.references) !== previousAssistantReferenceSignature(turns, turnIndex) ? (
            <details className="conversationReferences" aria-label="回答依据">
              <summary>依据 {turn.references.length}</summary>
              <div>
                {turn.references.map((reference) => (
                  <button key={`${reference.kind}-${reference.target}`} type="button" onClick={() => onTurnAction?.({ ...reference, id: "open-reference" }, turn)}>
                    <FileText aria-hidden="true" />
                    <span>{reference.label}</span>
                  </button>
                ))}
              </div>
            </details>
          ) : null}
          {turn.actions?.length ? (
            <div className="conversationActions">
              {turn.actions.map((action) => (
                <button key={action.id} type="button" onClick={() => onTurnAction?.(action, turn)}>{action.label}</button>
              ))}
            </div>
          ) : null}
          <Attachments attachments={turn.attachments} />
        </ConversationMessage>
      ))}

      {loading || error ? (
        <ConversationMessage meta={loading ? "连接中" : error ? "需要检查" : phase} role="assistant" title="OmniDesk">
          {loading ? "正在连接本地工作区。" : error ? `本地能力暂时不可用：${error}` : null}
        </ConversationMessage>
      ) : null}

      {streamingReply ? (
        <ConversationMessage className="conversationMessage-streaming" role="assistant">
          <div>{conversationTextForDisplay(streamingReply)}<span className="conversationStreamCursor" aria-label="正在生成" /></div>
        </ConversationMessage>
      ) : null}

      {pendingTurn || chatLoading ? (
        <>
          {pendingTurn && pendingTurn.showUser !== false ? (
            <ConversationMessage role="user">
              <div>{displayText(pendingTurn.text)}</div>
              <Attachments attachments={pendingTurn.attachments} />
            </ConversationMessage>
          ) : null}
          {!streamingReply ? (
            <AgentProcessingStatus
              events={pendingTurn?.events || chatLoadingEvents}
              label={pendingTurn?.label || chatLoadingLabel}
              running
              startedAt={pendingTurn?.startedAt || chatStartedAt}
            />
          ) : null}
        </>
      ) : null}
    </Conversation>
  );
}

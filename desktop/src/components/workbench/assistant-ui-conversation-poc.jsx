import React, { useMemo } from "react";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
} from "@assistant-ui/react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { AgentUserFormCard } from "./agent-user-form-card";
import { normalizeAssistantUiTurns, turnToAssistantMessage } from "../../lib/assistant-ui-adapter";

function assistantUiMessage(turn, index) {
  if (!turn.agentInteraction) return turnToAssistantMessage(turn, index);
  const { interaction, run } = turn.agentInteraction;
  return {
    id: turn.id,
    role: "assistant",
    status: { type: "complete", reason: "stop" },
    content: [{ type: "tool-call", toolCallId: interaction.id, toolName: "ask_user", args: { interaction, run }, result: interaction.status === "submitted" ? interaction.response : undefined }],
  };
}

function TextPart({ text }) {
  return <div>{text}</div>;
}

function StageGoalPart({ args, onAction, result, status }) {
  const registered = result?.status === "registered";
  return (
    <section className="conversationGoal" aria-label={registered ? "已登记阶段目标" : "阶段目标候选"}>
      <div className="conversationGoalHeader">
        <strong>{args.title}</strong>
        <Badge variant={registered ? "success" : "warning"}>{args.statusLabel || (registered ? "已登记" : "目标候选")}</Badge>
      </div>
      <dl>
        <div><dt>范围</dt><dd>{args.scope || "--"}</dd></div>
        <div><dt>关联项目目标</dt><dd>{args.parentTitle || "--"}</dd></div>
        <div><dt>状态</dt><dd>{registered ? "待拆解" : "待确认"}</dd></div>
      </dl>
      {!registered ? <p>确认前不会写入目标，也不会创建任务或开始执行。</p> : null}
      {args.actions?.length ? (
        <div className="conversationActions">
          {args.actions.map((action) => (
            <Button key={action.id} size="sm" type="button" variant={action.id === "create-stage-goal" ? "primary" : "ghost"} onClick={() => onAction?.(action, args.turnId)}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {status?.type === "incomplete" ? <p>该目标消息仍在处理中。</p> : null}
    </section>
  );
}

function AssistantMessage({ toolRenderers }) {
  const role = useMessage((state) => state.role);
  return (
    <MessagePrimitive.Root className={`conversationMessage conversationMessage-${role}`}>
      <div className="conversationBody">
        <div className="conversationBubble">
          <MessagePrimitive.Parts components={{
            Text: TextPart,
            tools: { by_name: toolRenderers },
          }} />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

export function AssistantUiConversationPoc({ interactions = [], isRunning = false, onAction, onRetryInteraction, onSubmitInteraction, turns = [] }) {
  const stageGoalRenderer = useMemo(() => (props) => <StageGoalPart {...props} onAction={onAction} />, [onAction]);
  const askUserRenderer = useMemo(() => ({ args }) => <AgentUserFormCard interaction={args.interaction} onRetry={() => onRetryInteraction?.(args.run)} onSubmit={(response) => onSubmitInteraction?.(args.run, response)} run={args.run} />, [onRetryInteraction, onSubmitInteraction]);
  const toolRenderers = useMemo(() => ({ ask_user: askUserRenderer, stage_goal: stageGoalRenderer }), [askUserRenderer, stageGoalRenderer]);
  const messages = useMemo(() => [...normalizeAssistantUiTurns(turns), ...interactions.map(({ interaction, run }) => ({ agentInteraction: { interaction, run }, id: `interaction-${run.id}-${interaction.id}` }))], [interactions, turns]);
  const runtime = useExternalStoreRuntime({
    convertMessage: assistantUiMessage,
    isRunning,
    messages,
    onNew: async () => {},
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="conversation assistantUiConversationPoc" role="log" aria-live="polite">
        <ThreadPrimitive.Viewport autoScroll className="assistantUiConversationViewport">
          <ThreadPrimitive.Messages components={{ Message: () => <AssistantMessage toolRenderers={toolRenderers} /> }} />
          {isRunning ? <div className="assistantUiRunning" role="status">正在处理当前请求...</div> : null}
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

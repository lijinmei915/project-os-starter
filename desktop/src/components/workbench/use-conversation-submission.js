import { addConversationConfirmationHandler } from "../../lib/conversation-confirmation-handler";
import { resolveConversationChatResult } from "../../lib/conversation-chat-result";
import { createBasicConversationImmediateHandlers } from "../../lib/conversation-immediate-handlers";
import { buildNonPlanConversationTurn } from "../../lib/conversation-result-projection";
import { recommendedActionFromChatResult } from "../../lib/conversation-recommended-action";
import { modelHealthUpdate, shouldGenerateConversationPlan } from "../../lib/conversation-result-decision";
import { syncConversationProfilePatches } from "../../lib/conversation-profile-sync";
import { getProjectMemory, saveProjectMemory } from "../../lib/project-memory-client";
import { appendMemoryAudit, projectMemoryReferences, retrieveProjectMemory } from "../../lib/project-memory";
import { modelConversationAttachments, releaseConversationAttachments, submittedConversationAttachments, withActiveTaskConversationContext } from "../../lib/conversation-submission-utils";
import { applyConversationTakeover } from "../../lib/conversation-takeover-controller";
import { composerResponseForPendingInteraction } from "../../lib/conversation-agent-events";
import { beginRequest, isRequestRunning, settleRequest } from "../../lib/request-lifecycle";
import {
  actionCancelledTurn,
  classifyConversationIntent,
  createConversationActionAdapters,
  dispatchConversationCommand,
  executeConversationActionRequest,
  executionReadyAgentEvents,
  planProgressEvents,
  prepareConversationSubmission,
  projectExecutionEvent,
  resolveRequestTakeover,
} from "../../conversation-runtime";

// Keeps the full request lifecycle in the Conversation boundary. Runtime access stays injected.
export function useConversationSubmission({
  activeConversationId,
  activeConversationTaskId,
  activeProjectGoalTitle,
  activeRequestRef,
  activeTask,
  actionPromptsForMessage,
  agentEventsForMessageKind,
  attachments,
  buildChatRequestContext,
  cancelRuntimeRequest,
  chatTurns,
  chatWithModel,
  conversationDiagnosticForResult,
  conversationSummary,
  contextualizeUserMessage,
  executePendingPatchApply,
  isActionRequestMessage,
  isTauri,
  interactions,
  lastSubmissionRef,
  loadingEventsForMessageKind,
  loadingLabelForMessageKind,
  localStatusReply,
  onChatTurnsChange,
  onGeneratePlan,
  onModelHealthChange,
  onSubmitAgentInteraction,
  onProfileUpdated,
  onRunChatAction,
  onStopPlan,
  pendingTurn,
  previewChatResult,
  profilePatchesFromMessage,
  provider,
  providerHealth,
  providerProfileUpdater,
  resolveStageGoalTurn,
  safeDisplayText,
    clearAttachments,
  setChatLoading,
  setChatLoadingEvents,
  setChatLoadingLabel,
  setChatStartedAt,
  setPendingTurn,
  setStreamingReply,
  setTaskInput,
  snapshot,
  stageGoalCandidateFromMessage,
  taskConversationAction,
  taskGoalName,
  taskStatuses,
  tasks,
  taskInput,
}) {
  return async function submitTask(event) {
    event.preventDefault();
    const nextInput = taskInput.trim();
    if (!nextInput && !attachments.length) return;
    const runningRequest = activeRequestRef.current?.status === "running" ? activeRequestRef.current : null;
    const takeover = resolveRequestTakeover(nextInput, { running: Boolean(runningRequest) });
    const submittedAttachments = submittedConversationAttachments(attachments);
    const prepared = prepareConversationSubmission({
      activeTask,
      attachments: submittedAttachments,
      message: nextInput,
      previousSubmission: lastSubmissionRef.current,
      turns: chatTurns,
    });
    if (prepared.duplicate) return;
    lastSubmissionRef.current = prepared.submission;
    const { pendingAction, requestId, startedAt: requestStartedAt, userTurn } = prepared;
    const runtimeCommand = prepared.command;
    const followUp = runtimeCommand.decision;
    const clearSubmittedInput = () => {
      setTaskInput("");
      clearAttachments();
      releaseConversationAttachments(submittedAttachments);
    };
    const interactionReply = composerResponseForPendingInteraction(interactions, nextInput, submittedAttachments.length);
    if (interactionReply) {
      lastSubmissionRef.current = prepared.submission;
      onChatTurnsChange([...chatTurns, userTurn]);
      clearSubmittedInput();
      await onSubmitAgentInteraction?.(interactionReply.run, interactionReply.response);
      return;
    }
    const takeoverResult = applyConversationTakeover({
      cancelRequest: cancelRuntimeRequest,
      chatTurns,
      clearInput: clearSubmittedInput,
      onChatTurnsChange,
      onStopPlan,
      projectExecutionEvent,
      requestRef: activeRequestRef,
      runningRequest,
      setChatLoading,
      setPendingTurn,
      settleRequest,
      takeover,
      userTurn,
    });
    if (takeoverResult.handled) return;
    const requestBaseTurns = takeoverResult.turns;
    setTaskInput("");
    clearAttachments();
    onChatTurnsChange([...requestBaseTurns, userTurn]);
    beginRequest(activeRequestRef, requestId, requestStartedAt);
    setChatStartedAt(requestStartedAt);
    setChatLoadingLabel(runningRequest ? "正在切换到新要求" : "正在准备请求");
    setChatLoadingEvents(loadingEventsForMessageKind("chat"));
    setChatLoading(true);
    const baseRequestContext = buildChatRequestContext([...requestBaseTurns, userTurn], 8, conversationSummary);
    let requestContext = withActiveTaskConversationContext(baseRequestContext, {
      activeConversationTaskId,
      activeTask,
      taskGoalName,
      taskNextAction: taskConversationAction,
    });
    try {
      const memory = await getProjectMemory();
      const projectMemory = retrieveProjectMemory(memory, {
        query: nextInput,
        taskId: activeTask?.id || activeConversationTaskId,
      });
      const memoryReferences = projectMemoryReferences(projectMemory, {
        query: nextInput,
        taskId: activeTask?.id || activeConversationTaskId,
      });
      requestContext = {
        ...requestContext,
        memoryReferences,
        projectMemory,
      };
      if (memoryReferences.length) {
        void saveProjectMemory(appendMemoryAudit(memory, {
          itemIds: memoryReferences.map((reference) => reference.id), reason: memoryReferences.map((reference) => reference.reason).join("；"), requestId, taskId: activeTask?.id || activeConversationTaskId, type: "read",
        }));
      }
    } catch {
      requestContext = { ...requestContext, projectMemory: [] };
    }
    if (!isRequestRunning(activeRequestRef, requestId)) {
      releaseConversationAttachments(submittedAttachments);
      return;
    }
    userTurn.memoryReferences = requestContext.memoryReferences || [];
    const immediateHandlers = {
      ...createBasicConversationImmediateHandlers({
        activeTask,
        clearSubmittedInput,
        createCancelledTurn: actionCancelledTurn,
        onChatTurnsChange,
        onRunChatAction,
        pendingAction,
        requestBaseTurns,
        requestId,
        runningTaskStatus: taskStatuses.running,
        userTurn,
      }),
      "execute-action": async (command) => {
        const resolvedTurns = command.resolvePendingAction
          ? requestBaseTurns.map((turn) => turn.pendingAction?.id === command.resolvePendingAction.id
            ? { ...turn, actions: [], pendingAction: null, resolvedActionId: command.resolvePendingAction.id }
            : turn)
          : requestBaseTurns;
        setTaskInput("");
        clearAttachments();
        onChatTurnsChange([...resolvedTurns, userTurn]);
        const result = await executeConversationActionRequest({
          action: command.action,
          adapters: createConversationActionAdapters({
            generatePlan: onGeneratePlan,
            isRequestActive: (nextRequestId) => isRequestRunning(activeRequestRef, nextRequestId),
            runAction: onRunChatAction,
          }),
          context: {
            attachments: modelConversationAttachments(submittedAttachments),
            conversationId: activeConversationId,
            displayTask: requestContext.contextState.currentTopic || nextInput,
            input: nextInput,
            requestId,
            startedAt: requestStartedAt,
          },
          onProgress: ({ events, label }) => {
            if (!isRequestRunning(activeRequestRef, requestId)) return;
            setPendingTurn((current) => ({
              ...(current || { attachments: submittedAttachments, showUser: false, startedAt: requestStartedAt, text: nextInput }),
              events,
              label,
            }));
          },
        });
        if (!isRequestRunning(activeRequestRef, requestId)) {
          releaseConversationAttachments(submittedAttachments);
          return true;
        }
        if (!settleRequest(activeRequestRef, requestId, result.requestStatus)) return true;
        if (result.turn) onChatTurnsChange([...resolvedTurns, userTurn, result.turn]);
        setPendingTurn(null);
        clearSubmittedInput();
        return result.handled;
      },
    };
    addConversationConfirmationHandler({
      activeProjectGoalTitle,
      clearSubmittedInput,
      executePendingPatchApply,
      executePendingAgent: async (action) => immediateHandlers["execute-action"]({
        action: { id: "start-agent", task: action.task },
        resolvePendingAction: action,
      }),
      executePendingPlan: async (action) => immediateHandlers["execute-action"]({
        action: { id: "generate-plan", task: action.task },
        resolvePendingAction: action,
      }),
      executionReadyEvents: executionReadyAgentEvents,
      handlers: immediateHandlers,
      onChatTurnsChange,
      onRunChatAction,
      pendingAction,
      projectExecutionEvent,
      requestBaseTurns,
      requestId,
      resolveStageGoalTurn,
      userTurn,
    });
    const immediate = await dispatchConversationCommand(runtimeCommand, immediateHandlers);
    if (immediate.handled) return;

    setChatStartedAt(requestStartedAt);
    const contextualTask = pendingAction?.type === "generate-plan" && followUp === "confirm"
      ? pendingAction.task
      : contextualizeUserMessage(nextInput, requestContext.contextState);
    setTaskInput("");
    clearAttachments();
    onChatTurnsChange([...requestBaseTurns, userTurn]);
    syncConversationProfilePatches({
      isTauri: Boolean(isTauri),
      onProfileUpdated,
      patches: profilePatchesFromMessage(nextInput),
      updateProfile: providerProfileUpdater,
    });
    const messageKind = pendingAction?.type === "generate-plan" && followUp === "confirm"
      ? "task"
      : classifyConversationIntent(nextInput, submittedAttachments.length > 0);
    setChatLoadingLabel(loadingLabelForMessageKind(messageKind));
    setChatLoadingEvents(loadingEventsForMessageKind(messageKind));
    setStreamingReply("");
    setChatLoading(true);

    let chatResult;
    try {
      chatResult = await resolveConversationChatResult({
        attachments: submittedAttachments,
        chatWithModel,
        isTauri: Boolean(isTauri),
        localStatusReply,
        message: nextInput,
        messageKind,
        previewChatResult,
        provider,
        providerHealth,
        requestContext,
        requestId,
        snapshot,
        tasks,
      });
    } catch (error) {
      const providerError = error instanceof Error ? error.message : String(error);
      chatResult = {
        intent: "chat",
        providerError,
        providerModel: provider?.model || "",
        providerStatus: "request-failed",
        reply: "本轮请求没有完成，请重新发送。模型连接状态没有因此改变。",
        shouldCreatePlan: false,
      };
    } finally {
      if (isRequestRunning(activeRequestRef, requestId)) setChatLoading(false);
    }

    if (!isRequestRunning(activeRequestRef, requestId)) {
      releaseConversationAttachments(submittedAttachments);
      return;
    }
    const revisingPendingAction = runtimeCommand.decision === "revise";
    const recommendedAction = revisingPendingAction
      ? null
      : recommendedActionFromChatResult(chatResult, requestId);
    const shouldCreatePlan = !revisingPendingAction && shouldGenerateConversationPlan({
      attachmentsCount: submittedAttachments.length,
      chatResult,
      isActionRequestMessage,
      message: nextInput,
    });
    const healthUpdate = modelHealthUpdate(chatResult, provider?.model);
    if (healthUpdate) onModelHealthChange?.(healthUpdate.model, healthUpdate.status, healthUpdate.message);
    const nonPlanResult = buildNonPlanConversationTurn({
      activeProjectGoalTitle,
      actionPromptsForMessage,
      chatResult: shouldCreatePlan ? { ...chatResult, shouldCreatePlan: true } : chatResult,
      conversationDiagnostic: (result) => conversationDiagnosticForResult(result, providerHealth),
      durationMs: Date.now() - requestStartedAt,
      eventsForMessage: agentEventsForMessageKind,
      message: nextInput,
      messageKind,
      recommendedAction,
      requestId,
      safeDisplayText,
      stageGoalCandidate: stageGoalCandidateFromMessage(nextInput, chatResult),
      statusLabelForMessage: loadingLabelForMessageKind,
    });
    if (nonPlanResult) {
      if (!settleRequest(activeRequestRef, requestId, "succeeded")) return;
      onChatTurnsChange([...requestBaseTurns, userTurn, nonPlanResult.turn]);
      setStreamingReply("");
      releaseConversationAttachments(submittedAttachments);
      return;
    }
    setPendingTurn({
      attachments: submittedAttachments,
      events: planProgressEvents("context"),
      label: "读取项目上下文",
      showUser: false,
      startedAt: requestStartedAt,
      text: nextInput || "请根据截图帮我分析并修改。",
    });
    const actionResult = await executeConversationActionRequest({
      action: { id: "generate-plan", task: contextualTask || "请根据截图帮我分析并修改。" },
      adapters: createConversationActionAdapters({ generatePlan: onGeneratePlan }),
      context: {
        attachments: modelConversationAttachments(submittedAttachments),
        conversationId: activeConversationId,
        displayTask: requestContext.contextState.currentTopic || nextInput,
        input: nextInput,
        requestId,
        startedAt: requestStartedAt,
      },
      onProgress: ({ events, label }) => {
        if (!isRequestRunning(activeRequestRef, requestId)) return;
        setPendingTurn((current) => current ? { ...current, events, label } : current);
      },
    });
    if (!isRequestRunning(activeRequestRef, requestId)) {
      releaseConversationAttachments(submittedAttachments);
      return;
    }
    if (!settleRequest(activeRequestRef, requestId, actionResult.requestStatus)) return;
    if (actionResult.turn) onChatTurnsChange([...requestBaseTurns, userTurn, actionResult.turn]);
    setPendingTurn(null);
    setStreamingReply("");
    releaseConversationAttachments(submittedAttachments);
  };
}

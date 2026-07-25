import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, ArrowUpDown, Bot, Check, Clock3, Eraser, ExternalLink, Filter, Loader2, MessageSquare, Play, RotateCcw, Server, ShieldAlert, ShieldCheck, Square, X } from "lucide-react";
import { ChatDock } from "./components/workbench/chat-dock";
import { AppWorkbenchSurface } from "./components/workbench/app-workbench-surface";
import { ActiveTask } from "./components/workbench/active-task";
import { AgentWorkspaceConversationCanvas } from "./components/workbench/agent-workspace-conversation-canvas";
import { AgentWorkspaceAuxiliaryTabs } from "./components/workbench/agent-workspace-auxiliary-tabs";
import { PatchDraft, ReadonlyPlan } from "./components/workbench/plan-views";
import { AgentProcessingStatus } from "./components/workbench/conversation";
import { visibleConversationPreview } from "./lib/conversation-list";
import { ProviderPanel } from "./components/workbench/provider-panel";
import { TopBar } from "./components/workbench/top-bar";
import { StatusBar } from "./components/workbench/status-bar";
import { TaskCard } from "./components/workbench/task-card";
import { TaskConversationContext } from "./components/workbench/task-conversation-context";
import { TaskQueueItem } from "./components/workbench/task-rail";
import { useWorkspaceContextActions } from "./components/workbench/use-workspace-context-actions";
import { usePlanAction } from "./components/workbench/use-plan-action";
import { usePatchActions } from "./components/workbench/use-patch-actions";
import { useTerminalCheckAction } from "./components/workbench/use-terminal-check-action";
import { useGovernanceTaskActions } from "./components/workbench/use-governance-task-actions";
import { useTaskPersistence } from "./components/workbench/use-task-persistence";
import { useConversationSession } from "./components/workbench/use-conversation-session";
import { useConversationNavigation } from "./components/workbench/use-conversation-navigation";
import { useTaskSession } from "./components/workbench/use-task-session";
import { useProviderSession } from "./components/workbench/use-provider-session";
import { useComposerModelActions } from "./components/workbench/use-composer-model-actions";
import { useExecutionSession } from "./components/workbench/use-execution-session";
import { useTerminalSession } from "./components/workbench/use-terminal-session";
import { useWorkspaceSession } from "./components/workbench/use-workspace-session";
import { useChatAttachments } from "./components/workbench/use-chat-attachments";
import { useWorkspaceTabs } from "./components/workbench/use-workspace-tabs";
import { useAgentWorkspaceNavigation } from "./components/workbench/use-agent-workspace-navigation";
import { useWorkspaceNavigationEvents } from "./components/workbench/use-workspace-navigation-events";
import { useTaskConversationEvent } from "./components/workbench/use-task-conversation-event";
import { useConversationTurnActions } from "./components/workbench/use-conversation-turn-actions";
import { useConversationRequestState } from "./components/workbench/use-conversation-request-state";
import { useConversationSubmission } from "./components/workbench/use-conversation-submission";
import { useActionFeedback } from "./components/workbench/use-action-feedback";
import { useProjectActivities } from "./components/workbench/use-project-activities";
import { useConversationPersistence } from "./components/workbench/use-conversation-persistence";
import { useWorkspaceSnapshotRefresh } from "./components/workbench/use-workspace-snapshot-refresh";
import { useWorkspaceDataSync } from "./components/workbench/use-workspace-data-sync";
import { useProviderDataSync } from "./components/workbench/use-provider-data-sync";
import { useConversationSurfaceReset } from "./components/workbench/use-conversation-surface-reset";
import { useWorkspaceEphemeralReset } from "./components/workbench/use-workspace-ephemeral-reset";
import { useWorkspaceGoalActions } from "./components/workbench/use-workspace-goal-actions";
import { EngineeringFileTab } from "./components/workbench/engineering-file-tab";
import { RightRail } from "./components/workbench/right-rail";
import { ProjectSidebar } from "./components/workbench/project-sidebar";
import { useSidebarLayout } from "./components/workbench/use-sidebar-layout";
import { useWorkspaceCapabilityActions } from "./components/workbench/use-workspace-capability-actions";
import { useProviderTestRecord } from "./components/workbench/use-provider-test-record";
import { useAgentWorkspaceInputActions } from "./components/workbench/use-agent-workspace-input-actions";
import { useProviderComposerViewModel } from "./components/workbench/use-provider-composer-view-model";
import { WorkspaceTabStrip } from "./components/workbench/workspace-tab-strip";
import { OverviewPageHeader, OverviewSection } from "./components/workbench/overview-section";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./components/ui/dropdown-menu";
import { Field } from "./components/ui/field";
import { Input } from "./components/ui/input";
import { Notice } from "./components/ui/notice";
import { Panel } from "./components/ui/panel";
import { SectionGroup } from "./components/ui/section-title";
import { Select } from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsContent } from "./components/ui/tabs";
import { Tooltip } from "./components/ui/tooltip";
import { workspaceFileTabId, workspaceFileTabTitle, topicPayloadFromOutline } from "./lib/workspace-tab-presentation";
import { capabilityDescriptions, capabilityLabels, chatStarterPrompts, dedicatedSurfaceByTopic, workspaceModuleLabels } from "./lib/workbench-catalog";
import { workspaceRouteById } from "./workspace-route-registry";
import { taskGoalName, taskProgressSummary, taskUpdatedLabel } from "./lib/task-presentation";
import { stageGoalCandidateFromMessage } from "./lib/stage-goal-candidate";
import { resolvedStageGoalTurn } from "./lib/stage-goal-turn";
import { assistantUiPocEnabled } from "./lib/assistant-ui-adapter";
import { groupTasksByGoal, sortTasksForGoal } from "./lib/task-goal-groups";
import { buildAgentWorkspaceViewModel } from "./lib/agent-workspace-view-model";
import * as providerClient from "./lib/provider-client";
import { activeProviderProfileName, catalogModelsForProvider, compactModelLabel, modelAvailabilityKey, providerModelHealth, providerModelKey } from "./lib/provider-presentation";
import { taskConversationAction, taskNextAction } from "./lib/task-next-action";
import { taskContinuationPrompt } from "./lib/task-conversation-prompt";
import { checksForPlan as planChecksFor, taskStatusLabel as taskStatusText } from "./lib/task-workflow-presentation";
import { goalStatusLabel as goalStatusLabelProjection, goalStatusLabelText } from "./lib/goal-presentation";
import { actionLabel, designImplementationTopics, governanceFileHealthLabel, governanceFileStatusLabel, statusLabel } from "./lib/governance-presentation";
import { createTaskFromPlan as createTaskRecordFromPlan } from "./lib/task-record-factory";
import { actionPromptsForMessage, isActionRequestMessage, profilePatchesFromMessage } from "./lib/conversation-message-projection";
import { agentEventsForMessageKind as agentEventsForMessageKindProjection, buildPreviewPlan, conversationDiagnosticForResult, loadingEventsForMessageKind as loadingEventsForMessageKindProjection, loadingLabelForMessageKind, localStatusReply as localStatusReplyProjection, previewChatResult as previewChatResultProjection } from "./lib/preview-chat-projection";
import { activeAgentRunForTask, agentRunConversationId, agentRunsForConversation } from "./lib/task-state";
import { applyPendingConversationPatch } from "./lib/conversation-patch-apply";
import { createProviderActionController } from "./lib/provider-action-controller";
import { createConversationActionController } from "./lib/conversation-action-controller";
import { createTaskLifecycleController } from "./lib/task-lifecycle-controller";
import { createExecutionActionController } from "./lib/execution-action-controller";
import { createWorkspaceRegistryActions } from "./lib/workspace-registry-actions";
import { createWorkspaceFileActions } from "./lib/workspace-file-actions";
import { executeGuardedCheckCommand, executeTaskGuardedCheckWorkflow } from "./lib/guarded-check-executor";
import { invokePreviewCommand, isTauriRuntime } from "./lib/runtime-api";
import { cancelRuntimeRequest, chatWithModel, deleteDesktopConversation, listDesktopConversations, saveDesktopConversation } from "./lib/desktop-conversation-client";
import { deleteDesktopTask, listDesktopTasks, saveDesktopTask } from "./lib/desktop-task-client";
import * as executionClient from "./lib/execution-client";
import * as terminalClient from "./lib/terminal-client";
import * as workspaceGoalClient from "./lib/workspace-goal-client";
import * as workspaceRegistryClient from "./lib/workspace-registry-client";
import * as workspaceCapabilityClient from "./lib/workspace-capability-client";
import * as workspaceFileClient from "./lib/workspace-file-client";
import { actionFromAssistantCommitment, actionFromAssistantRecommendation, buildChatRequestContext, buildConversationRecord, contextualizeUserMessage, mergeConversationRecords } from "./lib/conversation-record";
import { taskIdForRequest } from "./lib/request-lifecycle";
import { resolveWorkspaceContext, resolveWorkspaceGoal } from "./lib/workspace-context";
import { conversationStates, executeRegisteredConversationAction, guardedCheckCapabilities, guardedCheckCapability, migrateConversationRecord, normalizeConversationReferences, normalizeConversationTurns, planProgressEvents, projectExecutionEvent, recoverConversationRuntime } from "./conversation-runtime";
import { exposeDesktopPerformanceBaseline, recordWorkbenchReady } from "./lib/performance-baseline";
import { fallbackModelCatalog, fallbackProvider, fallbackSnapshot, planCards, taskStatuses } from "./lib/workbench-defaults";
import { archiveWorkspaceGoal, confirmGoalDecomposition, confirmWorkspaceGoal, copyTextToSystemClipboard, createWorkspaceGoal, loadWorkspaceSnapshot, mergeWorkspaceGoal, pickProjectDirectory, refreshWorkspaceFactsPreview, restoreWorkspaceGoal, switchWorkspaceGoal, updateWorkspaceGoal } from "./lib/workspace-runtime-bridge";
import "./styles.css";

const AssistantUiConversationPoc = React.lazy(() => import("./components/workbench/assistant-ui-conversation-poc").then((module) => ({ default: module.AssistantUiConversationPoc })));

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("OmniDesk render error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="appError">
          <Panel className="appErrorPanel" variant="soft">
            <strong>界面刚刚出错了</strong>
            <p>{safeDisplayText(this.state.error?.message, "未知错误")}</p>
            <Button type="button" variant="primary" onClick={() => window.location.reload()}>
              重新载入
            </Button>
          </Panel>
        </div>
      );
    }
    return this.props.children;
  }
}

const fallbackPlan = null;

const taskStatusLabel = (taskOrStatus) => taskStatusText(taskOrStatus, taskStatuses);
const checksForPlan = (plan) => planChecksFor(plan, guardedCheckCapabilities);
const previewChatResult = (message, hasAttachments, snapshot = {}, tasks = [], dialogueContext = {}) => previewChatResultProjection({
  activeGoalFromSnapshot,
  hasAttachments,
  isNoiseTask,
  message,
  phaseLabel,
  snapshot,
  taskStatuses,
  tasks,
  dialogueContext,
});
const loadingEventsForMessageKind = (kind) => loadingEventsForMessageKindProjection(kind, planProgressEvents);
const agentEventsForMessageKind = (kind, chatResult) => agentEventsForMessageKindProjection(kind, chatResult, createAgentEvent);
const localStatusReply = (input) => localStatusReplyProjection({
  ...input,
  activeProviderProfileName,
  previewResult: ({ message, hasAttachments, snapshot, tasks }) => previewChatResult(message, hasAttachments, snapshot, tasks),
});
const goalPresentationDependencies = { phaseLabel, taskStatuses };
const goalStatusLabel = (todos, fallbackPhase) => goalStatusLabelProjection(todos, fallbackPhase, goalPresentationDependencies);
const createTaskFromPlan = (plan, taskText, snapshot, options = {}) => createTaskRecordFromPlan(plan, taskText, snapshot, options, {
  taskIdForRequest,
  taskStatuses,
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function createAgentEvent(type, status, title, detail = "") {
  return {
    detail,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status,
    time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    title,
    type,
  };
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(message);
      error.code = "REQUEST_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

function safeDisplayText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isNoiseTask(task) {
  const title = safeDisplayText(task?.title).trim().replace(/[。！？!?,，\s]/g, "").toLowerCase();
  return /^\d+$/.test(title) || ["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(title);
}

function phaseLabel(phase) {
  return {
    init: "启动中",
    stabilizing: "打磨中",
    shipping: "交付中",
    maintenance: "维护中",
    archived: "已归档",
  }[phase] || phase || "进行中";
}

function activeGoalFromSnapshot(snapshot) {
  return resolveWorkspaceGoal(snapshot);
}

const agentTopicPresentation = {
  activeGoalFromSnapshot,
  checksForPlan,
  isNoiseTask,
  phaseLabel,
  statuses: taskStatuses,
  taskNextAction,
  taskStatusLabel,
  taskUpdatedLabel,
};

function AgentWorkspace({
  agentRuns = [],
  mcpClient,
  snapshot,
  activeTaskId,
  activeConversationTaskId,
  selectedEngineeringFile,
  activeConversationId,
  chatTurns,
  conversationSummary,
  terminalLogs,
  terminalRunningId,
  terminalText,
  terminalChunks,
  terminalSession,
  terminalSessions,
  activeTerminalSessionId,
  terminalError,
  terminalEvidence,
  onSaveTerminalImage,
  loading,
  error,
  readonlyPlan,
  activeTask,
  tasks,
  planLoading,
  runnerLoadingId,
  runnerError,
  patchLoading,
  patchError,
  applyLoading,
  applyError,
  handoffLoading,
  handoffError,
  conversationResetKey,
  onChatTurnsChange,
  onGeneratePlan,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunChatAction,
  onRunGuardedCheck,
  onRunTerminalCheck,
  onWriteTerminalData,
  onResizeTerminalSession,
  onSelectTerminalSession,
  onNewTerminalSession,
  onCloseTerminalSession,
  onOpenNativeTerminal,
  onRestartTerminalSession,
  onProfileUpdated,
  onProviderProfileUpdate,
  onStopPlan,
  isTauri,
  provider,
  composerModelAvailability,
  composerModelOptions,
  composerModelsLoading,
  composerModelsSource,
  composerModelTesting,
  onLoadComposerModels,
  onSelectComposerModel,
  onTestComposerModel,
  onModelHealthChange,
  decomposingGoal,
  onConfirmDecomposition,
  onGenerateDecomposition,
  goalRefinementMode,
  onSelectEngineeringFile,
  onSelectConversation,
  onSelectTask,
  onOpenTaskConversation,
  onSendTaskToTerminal,
  onMarkTaskWaiting,
  onEnsureModelAvailable,
  onCreateTask,
  onCreateGoal,
  onDeleteTask,
  onArchiveGoal,
  onMergeGoal,
  onRestoreGoal,
  onCompleteTask,
  onCreateRepairTask,
  onCreateGovernanceTask,
  onPersistTask,
  onUpdateGoal,
  onCreateDesignGovernanceTask,
  onSwitchProject,
  onRequestProjectAccess,
  onRefreshWorkspace,
  onReadEngineeringFile,
  onGetHermesExecutorStatus,
  onApproveAgentRun,
  onCancelAgentRun,
  onExportAgentRun,
  onResumeAgentRun,
  onSubmitAgentInteraction,
  onRefreshAgentRuns,
}) {
  const [taskInput, setTaskInput] = useState("");
  const { addImageFiles, attachmentError, attachments, clearAttachments, removeAttachment } = useChatAttachments({ readFileAsDataUrl });
  const {
    activeRequestRef, chatLoading, chatLoadingEvents, chatLoadingLabel, chatStartedAt, lastSubmissionRef, streamingReply,
    pendingTurn, resetConversationRequest, setChatLoading, setChatLoadingEvents, setChatLoadingLabel,
    setChatStartedAt, setPendingTurn, setStreamingReply, stopCurrentResponse,
  } = useConversationRequestState({ cancelRuntimeRequest, chatTurns, initialLoadingEvents: loadingEventsForMessageKind("chat"), onChatTurnsChange, onStopPlan });
  const { activeWorkspaceTab, changeWorkspaceTab, closeWorkspaceTab, resetWorkspaceTabs, setActiveWorkspaceTab, setWorkspaceTabs, workspaceTabs } = useWorkspaceTabs({
    onSelectEngineeringFile,
    onSelectTask,
    selectedEngineeringFile,
    workspaceFileTabId,
    workspaceFileTabTitle,
  });
  const composerRef = React.useRef(null);
  const pendingApplyRequestRef = React.useRef(false);
  const useAssistantUiPoc = assistantUiPocEnabled(window.location.search);
  const interactions = agentRunsForConversation(agentRuns, activeConversationId, activeTask?.id || activeConversationTaskId)
    .flatMap((run) => {
      const history = Array.isArray(run.interactions) ? run.interactions : [];
      const active = run.checkpoint?.interaction;
      const records = active && !history.some((item) => item.id === active.id) ? [...history, active] : history;
      return records.map((interaction) => ({ interaction, run }));
    })
    .sort((left, right) => String(left.interaction.requestedAt || "").localeCompare(String(right.interaction.requestedAt || "")));
  const isConversationEmpty = !chatTurns.length && !activeTask && !readonlyPlan && !loading && !error && !pendingTurn && !chatLoading && !interactions.length;
  const providerHealth = providerModelHealth(provider, composerModelAvailability);
  const {
    activeTaskPosition,
    conversationRuntime,
    nextConversationTask,
    previousConversationTask,
  } = buildAgentWorkspaceViewModel({ activeTask, chatLoading, chatTurns, loading, pendingTurn, snapshot, tasks });
  useWorkspaceNavigationEvents({ setActiveWorkspaceTab });

  const { openTaskConversationWorkspace } = useTaskConversationEvent({
    onOpenTaskConversation,
    onSelectTask,
    setActiveWorkspaceTab,
    setWorkspaceTabs,
    tasks,
  });

  const { continueTaskInChat, navigateWorkbench, openCurrentProgress, prepareTerminalCommand, setTerminalDraftRequest, terminalDraftRequest } = useAgentWorkspaceNavigation({
    focusComposer: () => composerRef.current?.focus(),
    onOpenTaskConversation,
    onSelectEngineeringFile,
    onSwitchProject,
    setActiveWorkspaceTab,
    setTaskInput,
    setWorkspaceTabs,
    snapshot,
    taskConversationAction,
    taskContinuationPrompt,
    taskGoalName,
    taskStatusLabel,
    topicPayloadFromOutline,
  });

  useConversationSurfaceReset({
    clearAttachments,
    composerResetKey: conversationResetKey,
    focusComposer: () => composerRef.current?.focus(),
    onChatTurnsChange,
    onSelectEngineeringFile,
    resetConversationRequest,
    resetWorkspaceTabs,
    setTerminalDraftRequest,
    setTaskInput,
  });

  const activeProjectGoal = (() => {
    const registry = snapshot?.projectGoals || {};
    const items = Array.isArray(registry.projectGoals) ? registry.projectGoals : [];
    return items.find((item) => item.id === registry.activeProjectGoalId) || null;
  })();

  const executePendingPatchApply = (input) => applyPendingConversationPatch({
    ...input,
    isApplyingRef: pendingApplyRequestRef,
    onChatTurnsChange,
    onRunChatAction,
    pendingAction: input.pendingAction,
    projectExecutionEvent,
  });

  const submitTask = useConversationSubmission({
    activeConversationId,
    activeConversationTaskId,
    activeProjectGoalTitle: activeProjectGoal?.title,
    activeRequestRef,
    activeTask,
    actionFromAssistantCommitment,
    actionFromAssistantRecommendation,
    actionPromptsForMessage,
    agentEventsForMessageKind,
    attachments,
    buildChatRequestContext,
    chatTurns,
    chatWithModel,
    conversationDiagnosticForResult,
    conversationSummary,
    contextualizeUserMessage,
    executePendingPatchApply,
    isActionRequestMessage,
    isTauri,
    lastSubmissionRef,
    loadingEventsForMessageKind,
    loadingLabelForMessageKind,
    localStatusReply,
    onChatTurnsChange,
    onGeneratePlan,
    onModelHealthChange,
    onProfileUpdated,
    onRunChatAction,
    onStopPlan,
    pendingTurn,
    previewChatResult,
    profilePatchesFromMessage,
    provider,
    providerHealth,
    providerProfileUpdater: onProviderProfileUpdate,
    resolveStageGoalTurn: resolvedStageGoalTurn,
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
    taskGoalName: (task) => taskGoalName(task, snapshot),
    taskStatuses,
    tasks,
    taskInput,
    withTimeout,
  });

  const handleConversationTurnAction = useConversationTurnActions({
    activeProjectGoalTitle: activeProjectGoal?.title,
    chatTurns,
    executePendingPatchApply,
    focusComposer: () => composerRef.current?.focus(),
    navigateWorkbench,
    onChatTurnsChange,
    onRunChatAction,
    setTaskInput,
  });

  const { handleAssistantUiAction, handlePaste, useStarterPrompt } = useAgentWorkspaceInputActions({ addImageFiles, chatTurns, composerRef, handleConversationTurnAction, setTaskInput });

  return (
    <Tabs className="center" value={activeWorkspaceTab} onValueChange={changeWorkspaceTab}>
      <WorkspaceTabStrip onCloseTab={closeWorkspaceTab} tabs={workspaceTabs} />

      <AgentWorkspaceConversationCanvas
        assistantUi={useAssistantUiPoc ? <React.Suspense fallback={<AgentProcessingStatus label="载入对话 POC" running />}><AssistantUiConversationPoc interactions={interactions} isRunning={chatLoading || Boolean(pendingTurn)} onAction={handleAssistantUiAction} onSubmitInteraction={onSubmitAgentInteraction} turns={chatTurns} /></React.Suspense> : null}
        chatLoading={chatLoading}
        chatLoadingEvents={chatLoadingEvents}
        chatLoadingLabel={chatLoadingLabel}
        chatStartedAt={chatStartedAt}
        interactions={interactions}
        conversationId={activeConversationId}
        conversationState={conversationRuntime.state}
        error={error}
        isEmpty={isConversationEmpty}
        loading={loading}
        onTurnAction={(action, turn) => handleConversationTurnAction(action, turn, { projectExecution: true })}
        onSubmitInteraction={onSubmitAgentInteraction}
        onUseStarterPrompt={useStarterPrompt}
        pendingTurn={pendingTurn}
        phase={snapshot.phase}
        starterPrompts={chatStarterPrompts}
        streamingReply={streamingReply}
        tasks={tasks}
        turns={chatTurns}
      />

      <AgentWorkspaceAuxiliaryTabs
        activeWorkspaceTab={activeWorkspaceTab}
        renderFileTab={(tab) => <TabsContent className="workspaceTabContent fileCanvas" key={tab.id} value={tab.id}><EngineeringFileTab
                activeTaskId={activeTask?.id}
                agentRuns={agentRuns}
                mcpClient={mcpClient}
                mcpNative={isTauri}
                selectedEngineeringFile={tab.file}
                snapshot={snapshot}
                tasks={tasks}
                provider={provider}
                composerModelAvailability={composerModelAvailability}
                runnerLoadingId={runnerLoadingId}
                handoffLoading={handoffLoading}
                onGeneratePatchDraft={onGeneratePatchDraft}
                onApplyPatchDraft={onApplyPatchDraft}
                onApproveAgentRun={onApproveAgentRun}
                onCancelAgentRun={onCancelAgentRun}
                onExportAgentRun={onExportAgentRun}
                onMergeHandoff={onMergeHandoff}
                onRunGuardedCheck={onRunGuardedCheck}
                onSelectTask={onSelectTask}
                onMarkTaskWaiting={onMarkTaskWaiting}
                onEnsureModelAvailable={onEnsureModelAvailable}
                onCreateTask={onCreateTask}
                onCreateGoal={onCreateGoal}
                onDeleteTask={onDeleteTask}
                onArchiveGoal={onArchiveGoal}
                onMergeGoal={onMergeGoal}
                onRestoreGoal={onRestoreGoal}
                onOpenTaskConversation={onOpenTaskConversation}
                onNavigateWorkbench={navigateWorkbench}
                onCreateRepairTask={onCreateRepairTask}
                onCreateGovernanceTask={onCreateGovernanceTask}
                onCreateDesignGovernanceTask={onCreateDesignGovernanceTask}
                onPersistTask={onPersistTask}
                onUpdateGoal={onUpdateGoal}
                decomposingGoal={decomposingGoal}
                onConfirmDecomposition={onConfirmDecomposition}
                onGenerateDecomposition={onGenerateDecomposition}
                onRequestProjectAccess={onRequestProjectAccess}
                onPrepareTerminalCommand={prepareTerminalCommand}
                onRefreshWorkspace={onRefreshWorkspace}
                onReadEngineeringFile={onReadEngineeringFile}
                onResumeAgentRun={onResumeAgentRun}
                onGetHermesExecutorStatus={onGetHermesExecutorStatus}
                onCopyText={copyTextToSystemClipboard}
                onRefreshWorkspaceFacts={refreshWorkspaceFactsPreview}
                onRefreshAgentRuns={onRefreshAgentRuns}
                presentation={{ agentTopicPresentation, dedicatedSurfaceByTopic, taskStatuses, workspaceRouteById }}
              /></TabsContent>}
        tabs={workspaceTabs}
        terminal={{ activeSessionId: activeTerminalSessionId, chunks: terminalChunks, draftRequest: terminalDraftRequest, error: terminalError, evidence: terminalEvidence, logs: terminalLogs, onCloseTerminalSession, onNewTerminalSession, onOpenNativeTerminal, onRestartTerminalSession, onResizeTerminalSession, onRunCheck: onRunTerminalCheck, onSaveTerminalImage, onSelectTerminalSession, onWriteTerminalData, runningId: terminalRunningId, session: terminalSession, sessions: terminalSessions, text: terminalText }}
        trace={snapshot.trace}
      />

      {activeWorkspaceTab === "plan" ? (
        <ChatDock
          attachmentError={attachmentError}
          attachments={attachments}
          chatLoading={chatLoading}
          composerRef={composerRef}
          onFilesSelected={addImageFiles}
          onInputChange={(event) => setTaskInput(event.target.value)}
          onPaste={handlePaste}
          onRemoveAttachment={removeAttachment}
          onStop={stopCurrentResponse}
          onSubmit={submitTask}
          onVoiceInput={setTaskInput}
          currentModel={provider?.model}
          modelAvailability={composerModelAvailability}
          modelLabel={provider?.model || "模型"}
          modelLoading={composerModelsLoading}
          modelOptions={composerModelOptions}
          modelProfile={activeProviderProfileName(provider)}
          modelSource={composerModelsSource}
          modelTesting={composerModelTesting}
          onLoadComposerModels={onLoadComposerModels}
          onSelectComposerModel={onSelectComposerModel}
          onTestComposerModel={onTestComposerModel}
          goalRefinementMode={goalRefinementMode}
          taskContext={activeConversationTaskId ? activeTask : null}
          taskContextHeader={activeConversationTaskId && activeTask ? (
            <TaskConversationContext
              goalName={taskGoalName(activeTask, snapshot)}
              onNextTask={nextConversationTask ? () => openTaskConversationWorkspace(nextConversationTask.id) : undefined}
              onPreviousTask={previousConversationTask ? () => openTaskConversationWorkspace(previousConversationTask.id) : undefined}
              position={activeTaskPosition}
              statusLabel={taskStatusLabel(activeTask)}
              task={activeTask}
            />
          ) : null}
          processing={Boolean(pendingTurn)}
          planLoading={planLoading}
          taskInput={taskInput}
        />
      ) : null}
    </Tabs>
  );
}

function currentRuntimeSource() {
  return isTauriRuntime() ? "tauri" : "preview";
}

function App() {
  const {
    applySnapshot,
    error,
    loading,
    ready: workspaceReady,
    refreshSnapshot: refreshSnapshotFromSource,
    setError,
    setLoading,
    snapshot,
    source,
  } = useWorkspaceSession({
    fallbackSnapshot,
    loadSnapshot: loadWorkspaceSnapshot,
    runtimeSource: currentRuntimeSource,
  });
  const {
    activeTaskId,
    activeTask,
    readonlyPlan,
    setActiveTaskId,
    setReadonlyPlan,
    setTasks,
    tasks,
  } = useTaskSession({ fallbackPlan });
  const {
    activeConversationId,
    activeConversationTaskId,
    chatTurns,
    conversationSummary,
    conversations,
    setActiveConversationId,
    setActiveConversationTaskId,
    setChatTurns,
    setConversationSummary,
    setConversations,
  } = useConversationSession();
  const { composerModelTesting, composerModelTests, composerModels, composerModelsKey, composerModelsLoading, composerModelsSource, modelCatalog, provider, providerError, providerReady, setComposerModelTesting, setComposerModelTests, setComposerModels, setComposerModelsKey, setComposerModelsLoading, setComposerModelsSource, setModelCatalog, setProvider, setProviderError, setProviderReady } = useProviderSession({ fallbackModelCatalog, fallbackProvider });
  const [projectActionError, setProjectActionError] = useState("");
  const [agentRuns, setAgentRuns] = useState([]);
  const { applyError, applyLoading, handoffError, handoffLoading, patchError, patchLoading, planError, planLoading, runnerError, runnerLoadingId, setApplyError, setApplyLoading, setHandoffError, setHandoffLoading, setPatchError, setPatchLoading, setPlanError, setPlanLoading, setRunnerError, setRunnerLoadingId } = useExecutionSession();
  const { activeTerminalSessionId, appendContextToTerminal, appendTerminalLog, closeTerminalSession, newTerminalSession, openNativeTerminal, resetTerminalSessionState, resizeTerminalSession, restartTerminalSession, setActiveTerminalSessionId, setTerminalRunningId, terminalChunks, terminalError, terminalEvidence, terminalLogs, terminalRunningId, terminalSession, terminalSessions, terminalText, writeTerminalData } = useTerminalSession({
    isTauri: isTauriRuntime(),
    terminalClient,
  });
  const [validatingGoal, setValidatingGoal] = useState(false);
  const [signingGoal, setSigningGoal] = useState(false);
  const [decomposingGoal, setDecomposingGoal] = useState(false);
  const [goalRefinementMode, setGoalRefinementMode] = useState(false);
  const { actionFeedback, beginActionFeedback, finishActionFeedback, showToast, toast } = useActionFeedback();
  const [conversationResetKey, setConversationResetKey] = useState(0);
  const [selectedEngineeringFile, setSelectedEngineeringFile] = useState(null);
  const conversationPersistRef = React.useRef(Promise.resolve());
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const { beginSidebarResize, leftWidth, rightWidth } = useSidebarLayout();
  const refreshAgentRuns = async () => {
    const records = await executionClient.listScheduledAgentRuns();
    const scoped = (Array.isArray(records) ? records : []).filter((item) => !snapshot?.currentProjectId || item.projectId === snapshot.currentProjectId);
    setAgentRuns(scoped);
    return scoped;
  };

  useEffect(() => {
    let active = true;
    const refresh = () => executionClient.listScheduledAgentRuns().then((runs) => {
      if (!active) return;
      const records = Array.isArray(runs) ? runs : [];
      setAgentRuns(records.filter((run) => !snapshot?.currentProjectId || run.projectId === snapshot.currentProjectId));
    }).catch(() => { if (active) setAgentRuns([]); });
    refresh();
    window.addEventListener("omnidesk:agent-runs-changed", refresh);
    return () => { active = false; window.removeEventListener("omnidesk:agent-runs-changed", refresh); };
  }, [snapshot?.currentProjectId, snapshot?.currentProjectPath, source]);

  const resumeAgentRun = async (run) => {
    try {
      const result = await executionClient.resumeHermesAgent(run);
      await refreshAgentRuns();
      return result;
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : String(error_));
      return null;
    }
  };

  const approveAgentRun = async (run) => {
    try {
      const result = await executionClient.approveHermesAgent(run);
      await refreshAgentRuns();
      return result;
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : String(error_));
      return null;
    }
  };

  const cancelAgentRun = async (run) => {
    try {
      const result = await executionClient.cancelAgentRun(run);
      await refreshAgentRuns();
      showToast("任务已取消，项目占用已释放。");
      return result;
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : String(error_));
      return null;
    }
  };

  const exportAgentRun = async (run) => {
    try {
      const result = await executionClient.exportAgentRunTimeline(run);
      showToast(`调试证据已导出：${result.path}`);
      return result;
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : String(error_));
      return null;
    }
  };

  const submitAgentInteraction = async (run, response) => {
    try {
      const result = await executionClient.acceptAgentInteraction(run, response);
      await refreshAgentRuns();
      if (result?.status === "queued") {
        void executionClient.continueHermesAgent(result).then(refreshAgentRuns).catch(async (error_) => {
          await refreshAgentRuns().catch(() => setAgentRuns([]));
          showToast(`回答已保存，但 Agent 继续失败：${error_ instanceof Error ? error_.message : String(error_)}`);
        });
      }
      return result;
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : String(error_));
      return null;
    }
  };

  const { markProjectActivityCompleted, markProjectActivitySeen, projectActivities } = useProjectActivities({ planLoading, snapshot, tasks, terminalRunningId, taskStatuses });

  const resetWorkspaceEphemeralState = useWorkspaceEphemeralReset({
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
  });

  const { persistTask: setAndPersistTask } = useTaskPersistence({
    isTauri: isTauriRuntime(),
    markProjectActivityCompleted,
    projectId: snapshot.currentProjectId,
    saveTask: saveDesktopTask,
    setActiveTaskId,
    setReadonlyPlan,
    setRunnerError,
    setTasks,
    showToast,
  });

  const updateChatTurns = useConversationPersistence({
    activeConversationId, activeConversationTaskId, activeTask, conversationSummary,
    setAndPersistTask, setChatTurns, setConversationSummary, setConversations, setRunnerError,
    snapshot, tasks,
  });

  const updateProjectCapability = useWorkspaceCapabilityActions({
    capabilityLabels,
    refreshSnapshot: refreshSnapshotFromSource,
    showToast,
    updateProjectCapability: workspaceCapabilityClient.updateProjectCapability,
  });

  useWorkspaceSnapshotRefresh({
    isTauri: isTauriRuntime(),
    refreshSnapshot: refreshSnapshotFromSource,
    showToast,
    workspacePath: snapshot.currentProjectPath,
    workspaceRegistryClient,
  });

  const { confirmDecomposition, confirmGoal, createGoal, generateDecomposition, refineGoal, signOffGoal, switchGoal, updateGoal, validateGoal } = useWorkspaceGoalActions({
    applySnapshot,
    beginActionFeedback,
    buildPreviewPlan,
    createTaskFromPlan,
    executionClient,
    finishActionFeedback,
    goalClient: workspaceGoalClient,
    isTauri: isTauriRuntime(),
    loadWorkspaceSnapshot,
    persistTask: setAndPersistTask,
    provider,
    setDecomposingGoal,
    setError,
    setGoalRefinementMode,
    setSigningGoal,
    setValidatingGoal,
    showToast,
    snapshot,
    taskStatuses,
    updateWorkspaceGoal,
  });

  useWorkspaceDataSync({
    listDesktopConversations,
    listDesktopTasks,
    projectId: snapshot.currentProjectId,
    projectPath: snapshot.currentProjectPath,
    recoverConversationRuntime,
    saveDesktopConversation,
    saveDesktopTask,
    setConversations,
    setRunnerError,
    setTasks,
    taskStatuses,
  });

  useProviderDataSync({
    fallbackModelCatalog,
    fallbackProvider,
    getModelCatalog: providerClient.getModelCatalog,
    getModelHealth: providerClient.getModelHealth,
    getProviderStatus: providerClient.getProviderStatus,
    setComposerModelTests,
    setModelCatalog,
    setProvider,
    setProviderError,
    setProviderReady,
  });


  const { addProject, openProjectFolder, pickProject, relocateProject, removeProject, renameProject, switchProject } = createWorkspaceRegistryActions({
    applySnapshot,
    fallbackSnapshot,
    loadWorkspaceSnapshot,
    pickProjectDirectory,
    registryClient: workspaceRegistryClient,
    resetWorkspaceEphemeralState,
    setLoading,
    setProjectActionError,
    showToast,
    snapshot,
  });
  const requestProjectAccess = () => window.dispatchEvent(new Event("omnidesk:request-project-access"));

  const { selectEngineeringFile } = createWorkspaceFileActions({ fileClient: workspaceFileClient, setActiveTaskId, setPlanError, setReadonlyPlan, setSelectedEngineeringFile });


  const { createDesignGovernanceTask, createGovernanceTask } = useGovernanceTaskActions({
    activeConversationId,
    createTaskFromPlan,
    designImplementationTopics,
    governanceFileHealthLabel,
    persistTask: setAndPersistTask,
    showToast,
    snapshot,
  });

  const { generatePlan, stopPlanGeneration } = usePlanAction({
    activeConversationId,
    beginActionFeedback,
    buildLocalPlan: (input) => buildPreviewPlan(input, snapshot),
    cancelRuntimeRequest,
    createTaskFromPlan: (plan, taskText, options) => createTaskFromPlan(plan, taskText, snapshot, options),
    finishActionFeedback,
    generateRemotePlan: executionClient.generateReadonlyPlan,
    isTauri: isTauriRuntime(),
    persistTask: setAndPersistTask,
    setPlanError,
    setPlanLoading,
    withTimeout,
  });

  const startHermesTaskAgent = async (task) => {
    const rawRequestId = `task-${task.id}-${Date.now()}`;
    const requestId = rawRequestId.replace(/[^a-zA-Z0-9_-]/g, "-");
    const plan = task.plan || {};
    const prompt = [
      `继续执行任务：${task.title || plan.task || "未命名任务"}`,
      plan.summary ? `任务摘要：${plan.summary}` : "",
      Array.isArray(plan.steps) && plan.steps.length ? `计划步骤：${plan.steps.join("；")}` : "",
      "先读取完成任务所需的最小工程上下文。若缺少会实质影响实现结果的必要参数，调用 ask_user；不要用普通文本猜测。用户回答不代表允许写文件或运行检查。需要写入或检查时分别请求独立审批。",
    ].filter(Boolean).join("\n");
    try {
      const scopedRecords = await refreshAgentRuns();
      const existingRun = activeAgentRunForTask(scopedRecords, task.id);
      if (existingRun) {
        showToast(existingRun.status === "awaiting-user-input" ? "等待回答。" : "任务运行中。");
        return true;
      }
      const result = await executionClient.runHermesAgent(prompt, requestId, 20, "", {
        conversationId: agentRunConversationId(activeConversationId, task),
        isolate: task?.executionMode === "isolated",
        taskId: task.id,
      });
      await refreshAgentRuns();
      return ["awaiting-user-input", "awaiting-approval", "succeeded"].includes(result?.status);
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : String(error_);
      setError(message);
      showToast(message);
      return false;
    }
  };

  const runChatAction = createConversationActionController({
    activeTaskId,
    applySnapshot,
    beginActionFeedback,
    confirmWorkspaceGoal,
    createWorkspaceGoal,
    executeGuardedCheck: (...args) => executeGuardedCheck(...args),
    executePatchApply: (...args) => executePatchApply(...args),
    executePatchDraft: (...args) => executePatchDraft(...args),
    executeRegisteredConversationAction,
    finishActionFeedback,
    generatePlan,
    generatePatchDraft: (...args) => generatePatchDraft(...args),
    createRepairTask: (...args) => createRepairTask(...args),
    markTaskWaiting: (...args) => markTaskWaiting(...args),
    onEnsureModelAvailable: () => testComposerModel(provider.model),
    runGuardedCheck: (...args) => runGuardedCheck(...args),
    selectEngineeringFile: (...args) => selectEngineeringFile(...args),
    selectTask: (...args) => selectTask(...args),
    setError,
    setSelectedEngineeringFile,
    startHermesAgent: startHermesTaskAgent,
    stopPlanGeneration,
    taskStatuses,
    tasks,
    topicPayloadFromOutline,
  });

  const { archiveConversation, deleteConversation, openTaskConversation, restoreConversation, selectConversation, startNewConversation } = useConversationNavigation({
    activeConversationId,
    conversations,
    deleteConversation: deleteDesktopConversation,
    saveConversation: saveDesktopConversation,
    markProjectActivitySeen,
    onResetConversation: () => { setSelectedEngineeringFile(null); setPlanError(""); setRunnerError(""); setPatchError(""); setApplyError(""); },
    projectId: snapshot.currentProjectId,
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
  });
  const { completeTask, createManualTask, createRepairTask, markTaskWaiting, removeTask, selectTask } = createTaskLifecycleController({
    activeConversationId,
    activeConversationTaskId,
    activeTaskId,
    conversations,
    createTaskFromPlan,
    deleteTask: deleteDesktopTask,
    markProjectActivitySeen,
    persistTask: setAndPersistTask,
    readonlyPlan,
    refreshSnapshot: refreshSnapshotFromSource,
    setActiveTaskId,
    setConversations,
    setReadonlyPlan,
    setSelectedEngineeringFile,
    setTasks,
    showToast,
    snapshot,
    startNewConversation,
    taskStatuses,
    tasks,
  });

  const { executeGuardedCheck, runGuardedCheck } = createExecutionActionController({
    appendTerminalLog,
    beginActionFeedback,
    chatTurns,
    executeGuardedCheckCommand,
    executeTaskGuardedCheckWorkflow,
    finishActionFeedback,
    guardedCheckCapability,
    persistTask: setAndPersistTask,
    projectExecutionEvent,
    runCheck: executionClient.runGuardedCheck,
    setRunnerError,
    setRunnerLoadingId,
    setTasks,
    taskStatuses,
    tasks,
    updateChatTurns,
  });

  const { sendGoalToChat, sendGoalToTerminal, sendTaskToChat, sendTaskToTerminal } = useWorkspaceContextActions({
    appendContextToTerminal,
    chatTurns,
    goalStatusLabelText,
    isNoiseTask,
    onOpenConversation: () => window.dispatchEvent(new Event("omnidesk:open-conversation")),
    setActiveTaskId,
    setReadonlyPlan,
    setSelectedEngineeringFile,
    showToast,
    snapshot,
    taskStatusLabel,
    taskStatuses,
    tasks,
    updateChatTurns,
  });


  const { runTerminalCheck } = useTerminalCheckAction({
    appendTerminalLog,
    executeGuardedCheckCommand,
    guardedCheckCapability,
    runCheck: executionClient.runGuardedCheck,
    setRunnerError,
    setTerminalRunningId,
  });

  const { applyPatchDraft, executePatchApply, executePatchDraft, generatePatchDraft, mergeHandoff } = usePatchActions({
    beginActionFeedback,
    chatTurns,
    checksForPlan,
    executionClient,
    finishActionFeedback,
    persistTask: setAndPersistTask,
    projectExecutionEvent,
    setApplyError,
    setApplyLoading,
    setHandoffError,
    setHandoffLoading,
    setPatchError,
    setPatchLoading,
    setRunnerError,
    setRunnerLoadingId,
    tasks,
    updateChatTurns,
  });

  const { deleteProviderProfile, saveProvider, saveProviderSecret } = createProviderActionController({
    beginActionFeedback,
    fallbackProvider,
    finishActionFeedback,
    getProviderStatus: providerClient.getProviderStatus,
    providerClient,
    setProvider,
    setProviderError,
  });

  const { loadComposerModels, selectComposerModel, testComposerModel, updateComposerModelHealth } = useComposerModelActions({
    catalogModelsForProvider,
    composerModelTests,
    composerModels,
    composerModelsKey,
    modelAvailabilityKey,
    modelCatalog,
    provider,
    providerClient,
    providerModelKey,
    saveProvider,
    setComposerModelTesting,
    setComposerModelTests,
    setComposerModels,
    setComposerModelsKey,
    setComposerModelsLoading,
    setComposerModelsSource,
    setProvider,
    source,
  });
  const { composerModelAvailability, composerModelOptions, currentProviderHealth, currentProviderTestRecord } = useProviderComposerViewModel({
    catalogModelsForProvider,
    composerModelTests,
    composerModels,
    modelAvailabilityKey,
    modelCatalog,
    provider,
    providerModelHealth,
  });
  const recordProviderTest = useProviderTestRecord({ setComposerModelTests });

  if (!workspaceReady || !providerReady) {
    return (
      <main className="appBoot" aria-busy="true" aria-label="OmniDesk 正在启动">
        <div className="appBootMark" aria-hidden="true">O</div>
        <strong>OmniDesk</strong>
        <span>正在恢复工作区…</span>
      </main>
    );
  }

  return <AppWorkbenchSurface
    actionFeedback={actionFeedback ? <ActionFeedbackToast feedback={actionFeedback} /> : null}
    topBar={(
      <TopBar
        onStartConversation={startNewConversation}
        providerButtonLabel={activeProviderProfileName(provider)}
        providerHealth={currentProviderHealth}
        providerPanel={(
          <ProviderPanel
            fallbackModelCatalog={fallbackModelCatalog}
            provider={provider}
            modelCatalog={modelCatalog}
            modelTestRecord={currentProviderTestRecord}
            source={source}
            onSaveProvider={saveProvider}
            onSaveProviderSecret={saveProviderSecret}
            onDeleteProviderProfile={deleteProviderProfile}
            onModelTestRecorded={recordProviderTest}
            providerError={providerError}
          />
        )}
      />
    )}
    projectSidebar={(
      <ProjectSidebar
          copyTextToSystemClipboard={copyTextToSystemClipboard}
          capabilityDescriptions={capabilityDescriptions}
          capabilityLabels={capabilityLabels}
          collapsed={leftCollapsed}
          onResizeStart={(event) => beginSidebarResize("left", event)}
          onToggleCollapsed={() => setLeftCollapsed((value) => !value)}
          snapshot={snapshot}
          tasks={tasks}
          projectActivities={projectActivities}
          planLoading={planLoading}
          terminalRunningId={terminalRunningId}
          onSwitchProject={switchProject}
          onPickProject={pickProject}
          onOpenProjectFolder={openProjectFolder}
          onRelocateProject={relocateProject}
          onRenameProject={renameProject}
          onRemoveProject={removeProject}
          onSelectEngineeringFile={selectEngineeringFile}
          onUpdateCapability={updateProjectCapability}
          onProjectActionError={setProjectActionError}
          onProjectActivitySeen={markProjectActivitySeen}
          onProjectPathCopied={() => showToast("已复制项目路径。")}
          projectActionError={projectActionError}
          selectedEngineeringFile={selectedEngineeringFile}
          taskStatuses={taskStatuses}
          workspaceModuleLabels={workspaceModuleLabels}
        />
    )}
    agentWorkspace={(
        <AgentWorkspace
          snapshot={snapshot}
          activeTaskId={activeTaskId}
          agentRuns={agentRuns}
          mcpClient={executionClient}
          onApproveAgentRun={approveAgentRun}
          onCancelAgentRun={cancelAgentRun}
          onExportAgentRun={exportAgentRun}
          onResumeAgentRun={resumeAgentRun}
          onRefreshAgentRuns={refreshAgentRuns}
          onSubmitAgentInteraction={submitAgentInteraction}
          activeConversationTaskId={activeConversationTaskId}
          selectedEngineeringFile={selectedEngineeringFile}
          activeConversationId={activeConversationId}
          chatTurns={chatTurns}
          conversationSummary={conversationSummary}
          terminalLogs={terminalLogs}
          terminalRunningId={terminalRunningId}
          terminalText={terminalText}
          terminalChunks={terminalChunks}
          terminalSession={terminalSession}
          terminalSessions={terminalSessions}
          activeTerminalSessionId={activeTerminalSessionId}
          terminalError={terminalError}
          terminalEvidence={terminalEvidence}
          onSaveTerminalImage={terminalClient.saveTerminalImage}
          loading={loading}
          error={error}
          readonlyPlan={readonlyPlan}
          activeTask={activeTask}
          tasks={tasks}
          planLoading={planLoading}
          runnerLoadingId={runnerLoadingId}
          runnerError={runnerError}
          patchLoading={patchLoading}
          patchError={patchError}
          applyLoading={applyLoading}
          applyError={applyError}
          handoffLoading={handoffLoading}
          handoffError={handoffError}
          conversationResetKey={conversationResetKey}
          onChatTurnsChange={updateChatTurns}
          onGeneratePlan={generatePlan}
          onGeneratePatchDraft={generatePatchDraft}
          onApplyPatchDraft={applyPatchDraft}
          onMergeHandoff={mergeHandoff}
          onRunChatAction={runChatAction}
          onRunGuardedCheck={runGuardedCheck}
          onRunTerminalCheck={runTerminalCheck}
          onWriteTerminalData={writeTerminalData}
          onResizeTerminalSession={resizeTerminalSession}
          onSelectTerminalSession={setActiveTerminalSessionId}
          onNewTerminalSession={newTerminalSession}
          onCloseTerminalSession={closeTerminalSession}
          onOpenNativeTerminal={openNativeTerminal}
          onRestartTerminalSession={restartTerminalSession}
          onProfileUpdated={applySnapshot}
          onProviderProfileUpdate={workspaceFileClient.updateProjectProfileFromConversation}
          onStopPlan={stopPlanGeneration}
          isTauri={isTauriRuntime()}
          provider={provider}
          composerModelAvailability={composerModelAvailability}
          composerModelOptions={composerModelOptions}
          composerModelsLoading={composerModelsLoading}
          composerModelsSource={composerModelsSource}
          composerModelTesting={composerModelTesting}
          onLoadComposerModels={loadComposerModels}
          onSelectComposerModel={selectComposerModel}
          onTestComposerModel={testComposerModel}
          onModelHealthChange={updateComposerModelHealth}
          decomposingGoal={decomposingGoal}
          onConfirmDecomposition={confirmDecomposition}
          onGenerateDecomposition={generateDecomposition}
          goalRefinementMode={goalRefinementMode}
          onSelectEngineeringFile={selectEngineeringFile}
          onSelectConversation={selectConversation}
          onSelectTask={selectTask}
          onOpenTaskConversation={openTaskConversation}
          onSendTaskToTerminal={sendTaskToTerminal}
          onMarkTaskWaiting={markTaskWaiting}
          onEnsureModelAvailable={() => testComposerModel(provider.model)}
          onCreateTask={createManualTask}
          onCreateGoal={createGoal}
          onDeleteTask={removeTask}
          onArchiveGoal={archiveWorkspaceGoal}
          onMergeGoal={mergeWorkspaceGoal}
          onRestoreGoal={restoreWorkspaceGoal}
          onCompleteTask={completeTask}
          onCreateRepairTask={createRepairTask}
          onCreateGovernanceTask={createGovernanceTask}
          onCreateDesignGovernanceTask={createDesignGovernanceTask}
          onPersistTask={(task) => setAndPersistTask(task, { durable: true })}
          onUpdateGoal={updateGoal}
          onSwitchProject={switchProject}
          onRequestProjectAccess={requestProjectAccess}
          onRefreshWorkspace={refreshSnapshotFromSource}
          onReadEngineeringFile={workspaceFileClient.readEngineeringFile}
          onGetHermesExecutorStatus={executionClient.getHermesExecutorStatus}
        />
    )}
    rightRail={(
        <RightRail
          collapsed={rightCollapsed}
          onResizeStart={(event) => beginSidebarResize("right", event)}
          onToggleCollapsed={() => setRightCollapsed((value) => !value)}
          snapshot={snapshot}
          tasks={tasks}
          activeTaskId={activeTaskId}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={selectConversation}
          onArchiveConversation={archiveConversation}
          onDeleteConversation={deleteConversation}
          onRestoreConversation={restoreConversation}
          onSelectTask={selectTask}
          onSendGoalToChat={sendGoalToChat}
          onSendGoalToTerminal={sendGoalToTerminal}
          onSendTaskToChat={sendTaskToChat}
          onSendTaskToTerminal={sendTaskToTerminal}
          onMarkTaskWaiting={markTaskWaiting}
          onValidateGoal={validateGoal}
          onSignOffGoal={signOffGoal}
          onRefineGoal={refineGoal}
          onCreateGoal={createGoal}
          onSwitchGoal={switchGoal}
          onConfirmGoal={confirmGoal}
          validatingGoal={validatingGoal}
          signingGoal={signingGoal}
          planLoading={planLoading}
          terminalRunningId={terminalRunningId}
          presentation={{ isNoiseTask, taskStatuses }}
        />
    )}
    leftCollapsed={leftCollapsed}
    leftWidth={leftWidth}
    rightCollapsed={rightCollapsed}
    rightWidth={rightWidth}
    statusBar={<StatusBar snapshot={snapshot} source={source} />}
    toast={!actionFeedback && toast ? <div className={`appToast appToast-${toast.variant}`}>{toast.message}</div> : null}
  />;
}

function ActionFeedbackToast({ feedback }) {
  if (feedback.status === "running") return null;
  const variant = feedback.status === "failed" ? "danger" : feedback.status === "running" ? "running" : "success";
  return (
    <div className={`appToast appToast-${variant}`} role="status" aria-live="polite">
      {feedback.status === "running" ? <Loader2 className="appToastIcon" aria-hidden="true" /> : null}
      {feedback.status === "success" ? <Check className="appToastIcon" aria-hidden="true" /> : null}
      {feedback.status === "failed" ? <X className="appToastIcon" aria-hidden="true" /> : null}
      <span>{feedback.message}</span>
    </div>
  );
}

exposeDesktopPerformanceBaseline();
recordWorkbenchReady();

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

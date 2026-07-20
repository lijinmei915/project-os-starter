import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => fs.readFileSync(path.join(desktopRoot, relativePath), "utf8");
const componentSource = (workbench, start, end) => workbench.slice(workbench.indexOf(`function ${start}`), workbench.indexOf(`function ${end}`));

test("keeps the Workbench shell away from direct runtime commands and the retired task workspace", () => {
  const workbench = source("src/main.jsx");
  assert.equal(workbench.includes("invokeRuntimeCommand"), false);
  assert.equal(workbench.includes("invokeTauriCommand"), false);
  assert.equal(workbench.includes("TaskWorkspace"), false);
  assert.equal(workbench.includes("open-task-workspace"), false);
  for (const hook of ["useWorkspaceSession", "useConversationSession", "useTaskSession", "useExecutionSession", "useProviderSession", "useTerminalSession"]) {
    assert.match(workbench, new RegExp(`import \\{ ${hook} \\}`));
  }
});

test("keeps the task detail surface outside the Workbench shell", () => {
  const workbench = source("src/main.jsx");
  const activeTask = source("src/components/workbench/active-task.jsx");
  assert.equal(workbench.includes("function ActiveTask"), false);
  assert.match(workbench, /import \{ ActiveTask \} from "\.\/components\/workbench\/active-task"/);
  assert.match(activeTask, /export function ActiveTask/);
  assert.equal(activeTask.includes("runtime-api"), false);
  assert.equal(activeTask.includes("desktop-task-client"), false);
});

test("keeps task-context navigation injected instead of dispatching UI events", () => {
  const context = source("src/components/workbench/task-conversation-context.jsx");
  const lifecycle = source("src/components/workbench/use-task-conversation-event.js");
  const workbench = source("src/main.jsx");
  assert.equal(context.includes("project-os:open-task-conversation"), false);
  assert.equal(workbench.includes("project-os:open-task-conversation"), false);
  assert.match(context, /onPreviousTask/);
  assert.match(context, /onNextTask/);
  assert.match(lifecycle, /return \{ openTaskConversationWorkspace \}/);
});

test("keeps conversation rendering outside the Workbench request container", () => {
  const workbench = source("src/main.jsx");
  const canvas = source("src/components/workbench/agent-workspace-conversation-canvas.jsx");
  const transcript = source("src/components/workbench/conversation-transcript.jsx");
  assert.match(workbench, /<AgentWorkspaceConversationCanvas/);
  assert.equal(workbench.includes("function shouldShowAgentTimeline"), false);
  assert.match(canvas, /<ConversationTranscript/);
  assert.match(transcript, /export function ConversationTranscript/);
  assert.equal(transcript.includes("runtime-api"), false);
  assert.equal(transcript.includes("desktop-conversation-client"), false);
});

test("keeps the AgentWorkspace conversation canvas outside its workspace container", () => {
  const workbench = source("src/main.jsx");
  const canvas = source("src/components/workbench/agent-workspace-conversation-canvas.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  assert.match(workbench, /<AgentWorkspaceConversationCanvas/);
  assert.equal(workspace.includes('className="conversationStart"'), false);
  assert.match(canvas, /export function AgentWorkspaceConversationCanvas/);
  assert.match(canvas, /<ConversationTranscript/);
  assert.equal(canvas.includes("runtime-api"), false);
  assert.equal(canvas.includes("desktop-conversation-client"), false);
});

test("keeps conversation turn actions in a conversation hook", () => {
  const workbench = source("src/main.jsx");
  const actions = source("src/components/workbench/use-conversation-turn-actions.js");
  assert.match(workbench, /useConversationTurnActions/);
  assert.equal(workbench.includes("const handleConversationTurnAction = async"), false);
  assert.match(actions, /export function useConversationTurnActions/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps AgentTopic task-board state and derived rows in a task hook", () => {
  const workbench = source("src/main.jsx");
  const taskBoard = source("src/components/workbench/use-agent-topic-task-board.js");
  assert.match(workbench, /useAgentTopicTaskBoard/);
  assert.equal(workbench.includes("buildTaskBoardViewModel"), false);
  assert.match(taskBoard, /useTaskBoardState/);
  assert.match(taskBoard, /buildTaskBoardViewModel/);
  assert.equal(taskBoard.includes("runtime-api"), false);
});

test("keeps AgentTopic task mutations behind injected Task and Workspace actions", () => {
  const workbench = source("src/main.jsx");
  const controller = source("src/lib/task-board-action-controller.js");
  const goalActions = source("src/lib/agent-topic-goal-actions.js");
  const taskActions = source("src/components/workbench/use-agent-topic-task-actions.js");
  const topic = componentSource(workbench, "AgentTopicPanel", "EngineeringFileTab");
  assert.match(workbench, /useAgentTopicTaskActions/);
  assert.match(taskActions, /createTaskBoardActionController/);
  assert.match(taskActions, /createAgentTopicGoalActions/);
  assert.match(taskActions, /saveDesktopTask: onPersistTask/);
  assert.match(taskActions, /updateWorkspaceGoal: onUpdateGoal/);
  assert.equal(topic.includes("workspaceGoalClient"), false);
  assert.equal(topic.includes("desktop-task-client"), false);
  assert.match(controller, /export function createTaskBoardActionController/);
  assert.match(goalActions, /export function createAgentTopicGoalActions/);
});

test("keeps the AgentTopic task workbench outside its topic container", () => {
  const workbench = source("src/main.jsx");
  const taskBoard = source("src/components/workbench/agent-topic-task-board.jsx");
  const content = source("src/components/workbench/agent-topic-panel-content.jsx");
  assert.match(workbench, /<AgentTopicPanelContent/);
  assert.match(content, /<AgentTopicTaskBoard/);
  assert.equal(workbench.includes('className="taskBoardToolbar"'), false);
  assert.match(taskBoard, /export function AgentTopicTaskBoard/);
  assert.equal(taskBoard.includes("runtime-api"), false);
  assert.equal(taskBoard.includes("desktop-task-client"), false);
});

test("keeps AgentTopic overview cards in a pure Task and Workspace presentation module", () => {
  const workbench = source("src/main.jsx");
  const viewModel = source("src/lib/agent-topic-view-model.js");
  const cards = source("src/lib/agent-topic-cards.js");
  assert.match(workbench, /buildAgentTopicViewModel/);
  assert.match(viewModel, /buildAgentTopicCards/);
  assert.equal(workbench.includes("const cardsByTopic"), false);
  assert.match(cards, /export function buildAgentTopicCards/);
  assert.equal(cards.includes("runtime-api"), false);
});

test("keeps AgentTopic capability aggregation in a pure view-model module", () => {
  const workbench = source("src/main.jsx");
  const viewModel = source("src/lib/agent-topic-view-model.js");
  assert.match(workbench, /buildAgentTopicViewModel/);
  assert.equal(workbench.includes("const assetDomains ="), false);
  assert.match(viewModel, /export function buildAgentTopicViewModel/);
  assert.match(viewModel, /export function canPreviewAgentTopicFile/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("keeps AgentTopic Agent configuration descriptions out of the task container", () => {
  const workbench = source("src/main.jsx");
  const viewModel = source("src/lib/agent-topic-view-model.js");
  const config = source("src/lib/agent-topic-agent-config.js");
  assert.match(workbench, /buildAgentTopicViewModel/);
  assert.match(viewModel, /agentConfigCapabilitySpec/);
  assert.equal(workbench.includes("const agentConfigSpecs"), false);
  assert.match(config, /export function agentConfigCapabilitySpec/);
  assert.equal(config.includes("runtime-api"), false);
});

test("keeps AgentTopic summary rendering outside the task action container", () => {
  const workbench = source("src/main.jsx");
  const summary = source("src/components/workbench/agent-topic-capability-summary.jsx");
  const content = source("src/components/workbench/agent-topic-panel-content.jsx");
  assert.match(workbench, /<AgentTopicPanelContent/);
  assert.match(content, /<AgentTopicCapabilitySummary/);
  assert.equal(workbench.includes("className=\"agentConfigCapability\""), false);
  assert.match(summary, /export function AgentTopicCapabilitySummary/);
  assert.equal(summary.includes("runtime-api"), false);
});

test("keeps controlled execution command rendering outside the AgentTopic container", () => {
  const workbench = source("src/main.jsx");
  const commands = source("src/components/workbench/controlled-commands-panel.jsx");
  const content = source("src/components/workbench/agent-topic-panel-content.jsx");
  const topic = componentSource(workbench, "AgentTopicPanel", "EngineeringFileTab");
  assert.match(content, /<ControlledCommandsPanel/);
  assert.match(workbench, /<AgentTopicPanelContent/);
  assert.equal(topic.includes("agentControlledCommands"), false);
  assert.match(commands, /export function ControlledCommandsPanel/);
  assert.equal(commands.includes("runtime-api"), false);
});

test("keeps AgentTopic task dialogs outside the task action container", () => {
  const workbench = source("src/main.jsx");
  const taskBoard = source("src/components/workbench/agent-topic-task-board.jsx");
  const dialogs = source("src/components/workbench/agent-topic-task-dialogs.jsx");
  const content = source("src/components/workbench/agent-topic-panel-content.jsx");
  assert.match(workbench, /<AgentTopicPanelContent/);
  assert.match(content, /<AgentTopicTaskBoard/);
  assert.match(taskBoard, /<AgentTopicTaskDialogs/);
  assert.equal(workbench.includes('title="永久删除任务"'), false);
  assert.match(dialogs, /export function AgentTopicTaskDialogs/);
  assert.match(dialogs, /title="永久删除任务"/);
  assert.equal(dialogs.includes("runtime-api"), false);
  assert.equal(dialogs.includes("desktop-task-client"), false);
});

test("keeps AgentTopic task detail and result rendering outside the task action container", () => {
  const workbench = source("src/main.jsx");
  const detail = source("src/components/workbench/agent-topic-task-detail.jsx");
  const content = source("src/components/workbench/agent-topic-panel-content.jsx");
  assert.match(workbench, /<AgentTopicPanelContent/);
  assert.match(content, /<AgentTopicCurrentTaskDetail/);
  assert.match(content, /<AgentTopicExecutionResults/);
  assert.equal(workbench.includes('aria-label="任务执行步骤"'), false);
  assert.match(detail, /export function AgentTopicCurrentTaskDetail/);
  assert.match(detail, /export function AgentTopicExecutionResults/);
  assert.equal(detail.includes("runtime-api"), false);
  assert.equal(detail.includes("desktop-task-client"), false);
});

test("keeps AgentTopic Workspace goal mutations behind injected actions", () => {
  const workbench = source("src/main.jsx");
  const actions = source("src/lib/agent-topic-goal-actions.js");
  const taskActions = source("src/components/workbench/use-agent-topic-task-actions.js");
  assert.match(workbench, /useAgentTopicTaskActions/);
  assert.match(taskActions, /createAgentTopicGoalActions/);
  assert.equal(workbench.includes("const archiveGoal = async"), false);
  assert.match(actions, /archiveWorkspaceGoal/);
  assert.match(actions, /mergeWorkspaceGoal/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps the app header as an injected workbench surface", () => {
  const workbench = source("src/main.jsx");
  const topBar = source("src/components/workbench/top-bar.jsx");
  assert.equal(workbench.includes("function TopBar"), false);
  assert.match(workbench, /<TopBar/);
  assert.match(topBar, /export function TopBar/);
  assert.equal(topBar.includes("runtime-api"), false);
  assert.equal(topBar.includes("provider-client"), false);
});

test("keeps the app status bar as a stateless workbench surface", () => {
  const workbench = source("src/main.jsx");
  const statusBar = source("src/components/workbench/status-bar.jsx");
  assert.equal(workbench.includes("function StatusBar"), false);
  assert.match(workbench, /<StatusBar/);
  assert.match(statusBar, /export function StatusBar/);
  assert.equal(statusBar.includes("runtime-api"), false);
  assert.match(statusBar, /不执行终端、检查或文件写入/);
});

test("keeps the Provider form surface outside App while preserving the Provider client boundary", () => {
  const workbench = source("src/main.jsx");
  const providerPanel = source("src/components/workbench/provider-panel.jsx");
  assert.equal(workbench.includes("function ProviderPanel"), false);
  assert.match(workbench, /import \{ ProviderPanel \} from "\.\/components\/workbench\/provider-panel"/);
  assert.match(providerPanel, /export function ProviderPanel/);
  assert.match(providerPanel, /providerClient\.probeProviderModels/);
  assert.match(providerPanel, /providerClient\.testProviderModel/);
  assert.equal(providerPanel.includes("runtime-api"), false);
});

test("keeps Provider persistence feedback outside App", () => {
  const workbench = source("src/main.jsx");
  const controller = source("src/lib/provider-action-controller.js");
  assert.match(workbench, /createProviderActionController/);
  assert.equal(workbench.includes("const saveProvider = async"), false);
  assert.match(controller, /export function createProviderActionController/);
  assert.equal(controller.includes("runtime-api"), false);
});

test("keeps App model probing and health polling in a Provider hook", () => {
  const workbench = source("src/main.jsx");
  const actions = source("src/components/workbench/use-composer-model-actions.js");
  assert.match(workbench, /useComposerModelActions/);
  assert.equal(workbench.includes("const loadComposerModels = async"), false);
  assert.match(actions, /export function useComposerModelActions/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps AgentWorkspace navigation as an injected Workspace boundary", () => {
  const workbench = source("src/main.jsx");
  const navigation = source("src/lib/workspace-navigation.js");
  assert.match(workbench, /useAgentWorkspaceNavigation/);
  assert.equal(workbench.includes("const navigateWorkbench = async"), false);
  assert.match(navigation, /export async function navigateWorkspaceTarget/);
  assert.equal(navigation.includes("runtime-api"), false);
});

test("keeps AgentWorkspace navigation and terminal drafts in a Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const navigation = source("src/components/workbench/use-agent-workspace-navigation.js");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  assert.match(workbench, /useAgentWorkspaceNavigation/);
  assert.equal(workspace.includes("const prepareTerminalCommand ="), false);
  assert.equal(workspace.includes("const continueTaskInChat ="), false);
  assert.equal(workspace.includes("const openCurrentProgress ="), false);
  assert.match(navigation, /export function useAgentWorkspaceNavigation/);
  assert.match(navigation, /navigateWorkspaceTarget/);
  assert.equal(navigation.includes("runtime-api"), false);
});

test("keeps App project registry orchestration behind an injected Workspace controller", () => {
  const workbench = source("src/main.jsx");
  const actions = source("src/lib/workspace-registry-actions.js");
  assert.match(workbench, /createWorkspaceRegistryActions/);
  assert.equal(workbench.includes("const switchProject = async"), false);
  assert.match(actions, /export function createWorkspaceRegistryActions/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps App file selection behind an injected Workspace controller", () => {
  const workbench = source("src/main.jsx");
  const actions = source("src/lib/workspace-file-actions.js");
  assert.match(workbench, /createWorkspaceFileActions/);
  assert.equal(workbench.includes("const selectEngineeringFile = async"), false);
  assert.match(actions, /export function createWorkspaceFileActions/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps conversation Patch Apply orchestration outside AgentWorkspace", () => {
  const workbench = source("src/main.jsx");
  const patchApply = source("src/lib/conversation-patch-apply.js");
  assert.match(workbench, /applyPendingConversationPatch/);
  assert.equal(workbench.includes("const executePendingPatchApply = async"), false);
  assert.match(patchApply, /export async function applyPendingConversationPatch/);
  assert.equal(patchApply.includes("runtime-api"), false);
});

test("keeps AgentWorkspace request state and cancellation in a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const requestState = source("src/components/workbench/use-conversation-request-state.js");
  assert.match(workbench, /useConversationRequestState/);
  assert.equal(workbench.includes("const stopCurrentResponse = ()"), false);
  assert.match(requestState, /export function useConversationRequestState/);
  assert.equal(requestState.includes("runtime-api"), false);
});

test("keeps Conversation submission orchestration behind an injected hook", () => {
  const workbench = source("src/main.jsx");
  const submission = source("src/components/workbench/use-conversation-submission.js");
  assert.match(workbench, /useConversationSubmission/);
  assert.equal(workbench.includes("const submitTask = async"), false);
  assert.match(submission, /export function useConversationSubmission/);
  assert.match(submission, /providerProfileUpdater/);
  assert.match(submission, /isTauri: Boolean\(isTauri\)/);
  assert.equal(submission.includes("runtime-api"), false);
  assert.equal(submission.includes("desktop-conversation-client"), false);
});

test("keeps App conversation navigation and persistence behind a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const navigation = source("src/components/workbench/use-conversation-navigation.js");
  assert.match(workbench, /useConversationNavigation/);
  assert.equal(workbench.includes("const openTaskConversation = (taskId)"), false);
  assert.equal(workbench.includes("const selectConversation = (id)"), false);
  assert.equal(workbench.includes("const deleteConversation = (id)"), false);
  assert.match(navigation, /export function useConversationNavigation/);
  assert.match(navigation, /deleteConversationState/);
  assert.equal(navigation.includes("runtime-api"), false);
});

test("keeps goal and task context projection behind the Workspace context hook", () => {
  const workbench = source("src/main.jsx");
  const contextActions = source("src/components/workbench/use-workspace-context-actions.js");
  assert.match(workbench, /useWorkspaceContextActions/);
  assert.equal(workbench.includes("const resolveGoalTodoTask ="), false);
  assert.equal(workbench.includes("const sendGoalToChat ="), false);
  assert.match(contextActions, /export function useWorkspaceContextActions/);
  assert.equal(contextActions.includes("runtime-api"), false);
  assert.equal(contextActions.includes("window."), false);
});

test("keeps plan request lifecycle behind the Conversation/Execution hook", () => {
  const workbench = source("src/main.jsx");
  const planAction = source("src/components/workbench/use-plan-action.js");
  assert.match(workbench, /usePlanAction/);
  assert.equal(workbench.includes("const activePlanRequestRef"), false);
  assert.equal(workbench.includes("const generatePlan = async"), false);
  assert.match(planAction, /export function usePlanAction/);
  assert.match(planAction, /executeReadonlyPlanWorkflow/);
  assert.equal(planAction.includes("runtime-api"), false);
  assert.equal(planAction.includes("desktop-task-client"), false);
});

test("keeps Patch, Apply, verification, and handoff lifecycles behind Execution hook", () => {
  const workbench = source("src/main.jsx");
  const patchActions = source("src/components/workbench/use-patch-actions.js");
  assert.match(workbench, /usePatchActions/);
  assert.equal(workbench.includes("const executePatchDraft = async"), false);
  assert.equal(workbench.includes("const executePatchApply = async"), false);
  assert.match(patchActions, /export function usePatchActions/);
  assert.match(patchActions, /executePatchDraftWorkflow/);
  assert.match(patchActions, /executePatchApplyWorkflow/);
  assert.equal(patchActions.includes("runtime-api"), false);
});

test("keeps terminal check lifecycle behind the Terminal/Execution hook", () => {
  const workbench = source("src/main.jsx");
  const terminalCheck = source("src/components/workbench/use-terminal-check-action.js");
  assert.match(workbench, /useTerminalCheckAction/);
  assert.equal(workbench.includes("const runTerminalCheck = async"), false);
  assert.match(terminalCheck, /export function useTerminalCheckAction/);
  assert.equal(terminalCheck.includes("runtime-api"), false);
});

test("keeps governance task generation behind the Workspace task hook", () => {
  const workbench = source("src/main.jsx");
  const governance = source("src/components/workbench/use-governance-task-actions.js");
  assert.match(workbench, /useGovernanceTaskActions/);
  assert.equal(workbench.includes("const createGovernanceTask = async"), false);
  assert.equal(workbench.includes("const createDesignGovernanceTask = async"), false);
  assert.match(governance, /export function useGovernanceTaskActions/);
  assert.equal(governance.includes("runtime-api"), false);
  assert.equal(workbench.includes("legacyCreateGovernanceTask"), false);
  assert.equal(workbench.includes("legacyCreateDesignGovernanceTask"), false);
});

test("keeps Task persistence and state projection behind the Task hook", () => {
  const workbench = source("src/main.jsx");
  const persistence = source("src/components/workbench/use-task-persistence.js");
  assert.match(workbench, /useTaskPersistence/);
  assert.equal(workbench.includes("const setAndPersistTask = async"), false);
  assert.match(persistence, /export function useTaskPersistence/);
  assert.equal(persistence.includes("runtime-api"), false);
  assert.equal(persistence.includes("desktop-task-client"), false);
});

test("keeps registered conversation actions outside App", () => {
  const workbench = source("src/main.jsx");
  const controller = source("src/lib/conversation-action-controller.js");
  assert.match(workbench, /createConversationActionController/);
  assert.equal(workbench.includes("const runChatAction = async"), false);
  assert.match(controller, /export function createConversationActionController/);
  assert.equal(controller.includes("runtime-api"), false);
});

test("keeps App task lifecycle orchestration behind an injected Task controller", () => {
  const workbench = source("src/main.jsx");
  const controller = source("src/lib/task-lifecycle-controller.js");
  assert.match(workbench, /createTaskLifecycleController/);
  assert.equal(workbench.includes("const createManualTask = async"), false);
  assert.equal(workbench.includes("const removeTask = async"), false);
  assert.match(controller, /export function createTaskLifecycleController/);
  assert.equal(controller.includes("runtime-api"), false);
  assert.equal(controller.includes("desktop-task-client"), false);
});

test("keeps App guarded check orchestration behind an injected Execution controller", () => {
  const workbench = source("src/main.jsx");
  const controller = source("src/lib/execution-action-controller.js");
  assert.match(workbench, /createExecutionActionController/);
  assert.equal(workbench.includes("const executeGuardedCheck = async"), false);
  assert.match(controller, /export function createExecutionActionController/);
  assert.equal(controller.includes("runtime-api"), false);
});

test("keeps App terminal lifecycle behind an injected Terminal hook", () => {
  const workbench = source("src/main.jsx");
  const terminal = source("src/components/workbench/use-terminal-session.js");
  assert.match(workbench, /useTerminalSession\(\{/);
  assert.match(workbench, /terminalClient,/);
  assert.equal(workbench.includes('listen("terminal://output"'), false);
  assert.equal(workbench.includes("const startTerminalSession = async"), false);
  assert.equal(workbench.includes("const writeTerminalData = async"), false);
  assert.equal(workbench.includes("const closeTerminalSession = async"), false);
  assert.match(terminal, /export function useTerminalSession/);
  assert.match(terminal, /terminalClient\.startTerminalSession/);
  assert.match(terminal, /terminalClient\.writeTerminalSession/);
  assert.equal(terminal.includes("runtime-api"), false);
});

test("keeps TerminalDock rendering and xterm interaction outside AgentWorkspace", () => {
  const workbench = source("src/main.jsx");
  const tabs = source("src/components/workbench/agent-workspace-auxiliary-tabs.jsx");
  const terminalDock = source("src/components/workbench/terminal-dock.jsx");
  assert.match(workbench, /<AgentWorkspaceAuxiliaryTabs/);
  assert.match(tabs, /<TerminalDock/);
  assert.match(tabs, /React\.lazy\(\(\) => import\("\.\/terminal-dock"\)/);
  assert.equal(workbench.includes("function TerminalDock"), false);
  assert.equal(workbench.includes("@xterm/xterm"), false);
  assert.match(terminalDock, /export function TerminalDock/);
  assert.match(terminalDock, /new Terminal\(/);
  assert.match(terminalDock, /formatTerminalInputForPaste/);
  assert.equal(terminalDock.includes("desktop-task-client"), false);
});

test("keeps AgentWorkspace auxiliary tab branching outside its workspace container", () => {
  const workbench = source("src/main.jsx");
  const tabs = source("src/components/workbench/agent-workspace-auxiliary-tabs.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  assert.match(workbench, /<AgentWorkspaceAuxiliaryTabs/);
  assert.equal(workspace.includes('tab.kind === "terminal"'), false);
  assert.equal(workspace.includes('tab.kind === "trace"'), false);
  assert.match(tabs, /export function AgentWorkspaceAuxiliaryTabs/);
  assert.match(tabs, /<TerminalDock/);
  assert.equal(tabs.includes("runtime-api"), false);
});

test("keeps App workspace refresh lifecycle behind an injected Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const refresh = source("src/components/workbench/use-workspace-snapshot-refresh.js");
  assert.match(workbench, /useWorkspaceSnapshotRefresh\(\{/);
  assert.equal(workbench.includes("workspace://files-changed"), false);
  assert.equal(workbench.includes("const startWatcher = async"), false);
  assert.equal(workbench.includes("project-os:snapshot-refresh-requested"), false);
  assert.match(refresh, /export function useWorkspaceSnapshotRefresh/);
  assert.equal(refresh.includes("runtime-api"), false);
});

test("keeps persisted Conversation and Task loading behind the Workspace data sync hook", () => {
  const workbench = source("src/main.jsx");
  const sync = source("src/components/workbench/use-workspace-data-sync.js");
  assert.match(workbench, /import \{ useWorkspaceDataSync \} from "\.\/components\/workbench\/use-workspace-data-sync"/);
  assert.match(workbench, /useWorkspaceDataSync\(\{/);
  assert.equal(workbench.includes("listDesktopConversations()\n      .then((records) => {\n        if (!cancelled) setConversations"), false);
  assert.equal(workbench.includes("listDesktopTasks()\n      .then((records) => {\n        if (cancelled || !Array.isArray(records)) return"), false);
  assert.match(sync, /export function useWorkspaceDataSync/);
  assert.match(sync, /listDesktopConversations\(\)/);
  assert.match(sync, /listDesktopTasks\(\)/);
  assert.match(sync, /recoverConversationRuntime/);
  assert.equal(sync.includes("runtime-api"), false);
  assert.equal(sync.includes("desktop-conversation-client"), false);
  assert.equal(sync.includes("desktop-task-client"), false);
});

test("keeps Provider bootstrap and health projection behind the Provider data sync hook", () => {
  const workbench = source("src/main.jsx");
  const sync = source("src/components/workbench/use-provider-data-sync.js");
  assert.match(workbench, /import \{ useProviderDataSync \} from "\.\/components\/workbench\/use-provider-data-sync"/);
  assert.match(workbench, /useProviderDataSync\(\{/);
  assert.equal(workbench.includes("providerClient.getProviderStatus(fallbackProvider)"), false);
  assert.equal(workbench.includes("providerClient.getModelCatalog(fallbackModelCatalog)"), false);
  assert.equal(workbench.includes("providerClient.getModelHealth().catch"), false);
  assert.match(sync, /export function useProviderDataSync/);
  assert.match(sync, /getProviderStatus\(fallbackProvider\)/);
  assert.match(sync, /getModelCatalog\(fallbackModelCatalog\)/);
  assert.match(sync, /getModelHealth\(\)/);
  assert.equal(sync.includes("provider-client"), false);
  assert.equal(sync.includes("runtime-api"), false);
});

test("keeps AgentWorkspace conversation reset lifecycle in a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const reset = source("src/components/workbench/use-conversation-surface-reset.js");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  assert.match(workbench, /import \{ useConversationSurfaceReset \} from "\.\/components\/workbench\/use-conversation-surface-reset"/);
  assert.match(workspace, /useConversationSurfaceReset\(\{/);
  assert.equal(workspace.includes("resetConversationRequest();"), false);
  assert.equal(workspace.includes("resetWorkspaceTabs();"), false);
  assert.match(reset, /export function useConversationSurfaceReset/);
  assert.match(reset, /resetConversationRequest\(\)/);
  assert.match(reset, /resetWorkspaceTabs\(\)/);
  assert.equal(reset.includes("runtime-api"), false);
  assert.equal(reset.includes("desktop-conversation-client"), false);
});

test("keeps project-switch transient reset orchestration in the Workspace lifecycle hook", () => {
  const workbench = source("src/main.jsx");
  const reset = source("src/components/workbench/use-workspace-ephemeral-reset.js");
  assert.match(workbench, /import \{ useWorkspaceEphemeralReset \} from "\.\/components\/workbench\/use-workspace-ephemeral-reset"/);
  assert.match(workbench, /useWorkspaceEphemeralReset\(\{/);
  assert.equal(workbench.includes("setActiveConversationId(`conv-${Date.now()}`)"), false);
  assert.equal(workbench.includes("resetTerminalSessionState();"), false);
  assert.match(reset, /export function useWorkspaceEphemeralReset/);
  assert.match(reset, /setActiveConversationId\(`conv-\$\{Date\.now\(\)\}`\)/);
  assert.match(reset, /resetTerminalSessionState\(\)/);
  assert.match(reset, /listDesktopConversations\(\)/);
  assert.match(reset, /listDesktopTasks\(\)/);
  assert.equal(reset.includes("runtime-api"), false);
});

test("keeps the Workspace project file tree outside the ProjectSidebar container", () => {
  const workbench = source("src/main.jsx");
  const tree = source("src/components/workbench/project-file-tree.jsx");
  const sidebar = componentSource(workbench, "ProjectSidebar", "createTaskFromPlan");
  assert.match(workbench, /import \{ ProjectFileTree \} from "\.\/components\/workbench\/project-file-tree"/);
  assert.match(sidebar, /<ProjectFileTree/);
  assert.equal(sidebar.includes("const visibleRows ="), false);
  assert.equal(sidebar.includes("const isFolderOpen ="), false);
  assert.match(tree, /export function ProjectFileTree/);
  assert.match(tree, /const visibleRows =/);
  assert.equal(tree.includes("runtime-api"), false);
  assert.equal(tree.includes("workspace-file-client"), false);
});

test("keeps ProjectSidebar transient dialog state in a Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const sidebar = componentSource(workbench, "ProjectSidebar", "createTaskFromPlan");
  const state = source("src/components/workbench/use-project-sidebar-state.js");
  assert.match(workbench, /import \{ useProjectSidebarState \} from "\.\/components\/workbench\/use-project-sidebar-state"/);
  assert.match(sidebar, /useProjectSidebarState\(\{/);
  assert.equal(sidebar.includes("useState(null)"), false);
  assert.equal(sidebar.includes("setCapabilityLoadingId"), false);
  assert.match(state, /export function useProjectSidebarState/);
  assert.match(state, /submitRename/);
  assert.match(state, /enableCapability/);
  assert.equal(state.includes("runtime-api"), false);
});

test("keeps Workbench sidebar sizing and pointer resize in a layout hook", () => {
  const workbench = source("src/main.jsx");
  const layout = source("src/components/workbench/use-sidebar-layout.js");
  assert.match(workbench, /import \{ useSidebarLayout \} from "\.\/components\/workbench\/use-sidebar-layout"/);
  assert.match(workbench, /const \{ beginSidebarResize, leftWidth, rightWidth \} = useSidebarLayout\(\)/);
  assert.equal(workbench.includes("document.body.classList.add(\"isResizingSidebar\")"), false);
  assert.match(layout, /export function useSidebarLayout/);
  assert.match(layout, /pointermove/);
  assert.match(layout, /pointerup/);
  assert.equal(layout.includes("runtime-api"), false);
});

test("keeps Workspace capability enablement dialog outside ProjectSidebar", () => {
  const workbench = source("src/main.jsx");
  const sidebar = componentSource(workbench, "ProjectSidebar", "createTaskFromPlan");
  const dialog = source("src/components/workbench/project-capability-dialog.jsx");
  assert.match(workbench, /import \{ ProjectCapabilityDialog \} from "\.\/components\/workbench\/project-capability-dialog"/);
  assert.match(sidebar, /<ProjectCapabilityDialog/);
  assert.equal(sidebar.includes("workspaceCapabilityList"), false);
  assert.equal(sidebar.includes("recommendedModuleIds"), false);
  assert.match(dialog, /export function ProjectCapabilityDialog/);
  assert.match(dialog, /onEnable/);
  assert.match(dialog, /onSelectedModulesChange/);
  assert.equal(dialog.includes("runtime-api"), false);
});

test("keeps ProjectSidebar status and capability derivation in a pure Workspace view-model", () => {
  const workbench = source("src/main.jsx");
  const sidebar = componentSource(workbench, "ProjectSidebar", "createTaskFromPlan");
  const viewModel = source("src/lib/project-sidebar-view-model.js");
  assert.match(workbench, /discoverableProjectCapabilities/);
  assert.match(workbench, /projectRuntimeStatus/);
  assert.equal(sidebar.includes("const relatedTasks ="), false);
  assert.equal(sidebar.includes("const discoverableCapabilities = (snapshot"), false);
  assert.match(viewModel, /export function projectRuntimeStatus/);
  assert.match(viewModel, /export function discoverableProjectCapabilities/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("keeps ProjectSidebar clipboard delegation in an injected Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const sidebar = componentSource(workbench, "ProjectSidebar", "createTaskFromPlan");
  const clipboard = source("src/components/workbench/use-project-path-copy.js");
  assert.match(workbench, /import \{ useProjectPathCopy \} from "\.\/components\/workbench\/use-project-path-copy"/);
  assert.match(sidebar, /useProjectPathCopy\(\{/);
  assert.equal(sidebar.includes("document.addEventListener(\"click\""), false);
  assert.equal(sidebar.includes("document.execCommand(\"copy\")"), false);
  assert.match(clipboard, /export function useProjectPathCopy/);
  assert.match(clipboard, /data-copy-project-path/);
  assert.match(clipboard, /copyTextToSystemClipboard/);
  assert.equal(clipboard.includes("runtime-api"), false);
});

test("keeps AgentWorkspace Conversation and Task derivation in a pure view-model", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  const viewModel = source("src/lib/agent-workspace-view-model.js");
  assert.match(workbench, /buildAgentWorkspaceViewModel/);
  assert.match(workspace, /buildAgentWorkspaceViewModel\(\{/);
  assert.equal(workspace.includes("conversationRuntimeState({"), false);
  assert.equal(workspace.includes("taskPositionInGoal("), false);
  assert.match(viewModel, /export function buildAgentWorkspaceViewModel/);
  assert.match(viewModel, /conversationRuntimeState/);
  assert.match(viewModel, /tasksForWorkspaceGoal/);
  assert.equal(viewModel.includes("desktop-conversation-client"), false);
});

test("keeps App Workspace goal lifecycle behind an injected Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const goals = source("src/components/workbench/use-workspace-goal-actions.js");
  assert.match(workbench, /useWorkspaceGoalActions\(\{/);
  assert.equal(workbench.includes("const validateGoal = async"), false);
  assert.equal(workbench.includes("const confirmDecomposition = async"), false);
  assert.equal(workbench.includes("const updateGoal = async"), false);
  assert.match(goals, /export function useWorkspaceGoalActions/);
  assert.match(goals, /const updateGoal = async/);
  assert.equal(goals.includes("runtime-api"), false);
});

test("keeps engineering previews and Hermes status behind injected Workspace and Execution actions", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = componentSource(workbench, "EngineeringFileTab", "RightRail");
  const agentConfig = source("src/components/workbench/agent-config-surface-panel.jsx");
  assert.match(engineeringFile, /onReadEngineeringFile/);
  assert.match(engineeringFile, /onGetHermesExecutorStatus/);
  assert.equal(engineeringFile.includes("workspaceFileClient"), false);
  assert.equal(agentConfig.includes("executionClient"), false);
  assert.equal(agentConfig.includes("runtime-api"), false);
  assert.match(workbench, /onReadEngineeringFile=\{workspaceFileClient\.readEngineeringFile\}/);
  assert.match(workbench, /onGetHermesExecutorStatus=\{executionClient\.getHermesExecutorStatus\}/);
});

test("keeps EngineeringFileTab topic routing in a pure Workspace view-model", () => {
  const workbench = source("src/main.jsx");
  const routing = source("src/lib/engineering-topic-surface.js");
  const engineeringFile = componentSource(workbench, "EngineeringFileTab", "RightRail");
  assert.match(workbench, /resolveEngineeringTopicSurface/);
  assert.equal(engineeringFile.includes("const isCurrentGoalTopic ="), false);
  assert.match(routing, /export function resolveEngineeringTopicSurface/);
  assert.equal(routing.includes("runtime-api"), false);
});

test("keeps reusable Workspace file preview rendering outside topic surfaces", () => {
  const workbench = source("src/main.jsx");
  const preview = source("src/components/workbench/readonly-file-preview.jsx");
  const frame = source("src/components/workbench/engineering-topic-frame.jsx");
  assert.match(workbench, /<ReadonlyFilePreview file=\{governanceFile\}/);
  assert.match(workbench, /<ReadonlyFilePreview file=\{previewFile\}/);
  assert.match(frame, /<ReadonlyFilePreview description="关联工程文件只读预览" file=\{relatedFilePreview\}/);
  assert.match(workbench, /<ReadonlyFilePreview description=\{selectedEngineeringFile\.description\} file=\{selectedEngineeringFile\}/);
  assert.match(preview, /export function ReadonlyFilePreview/);
  assert.equal(preview.includes("runtime-api"), false);
  assert.equal(preview.includes("workspaceFileClient"), false);
});

test("keeps EngineeringFileTab topic frame outside surface composition", () => {
  const workbench = source("src/main.jsx");
  const frame = source("src/components/workbench/engineering-topic-frame.jsx");
  const composer = source("src/components/workbench/engineering-topic-surface-composer.jsx");
  const engineeringFile = componentSource(workbench, "EngineeringFileTab", "RightRail");
  assert.match(workbench, /import \{ EngineeringTopicFrame \} from "\.\/components\/workbench\/engineering-topic-frame"/);
  assert.match(workbench, /import \{ EngineeringTopicSurfaceComposer \} from "\.\/components\/workbench\/engineering-topic-surface-composer"/);
  assert.match(engineeringFile, /<EngineeringTopicFrame/);
  assert.match(engineeringFile, /<EngineeringTopicSurfaceComposer/);
  assert.equal(engineeringFile.includes("const topicBody = isOverviewTopic"), false);
  assert.equal(engineeringFile.includes('className="topicGovernanceMeta"'), false);
  assert.match(frame, /export function EngineeringTopicFrame/);
  assert.match(composer, /export function EngineeringTopicSurfaceComposer/);
  assert.equal(frame.includes("runtime-api"), false);
  assert.equal(frame.includes("workspaceFileClient"), false);
  assert.equal(composer.includes("runtime-api"), false);
  assert.equal(composer.includes("workspaceFileClient"), false);
});

test("keeps static Workspace memory and asset surfaces outside EngineeringFileTab", () => {
  const workbench = source("src/main.jsx");
  const surfaces = source("src/components/workbench/workspace-static-surfaces.jsx");
  assert.match(workbench, /AssetSurfacePanel/);
  assert.match(workbench, /MemorySurfacePanel/);
  assert.match(workbench, /from "\.\/components\/workbench\/workspace-static-surfaces"/);
  assert.equal(workbench.includes("function MemorySurfacePanel"), false);
  assert.equal(workbench.includes("function AssetSurfacePanel"), false);
  assert.match(surfaces, /export function MemorySurfacePanel/);
  assert.match(surfaces, /export function AssetSurfacePanel/);
  assert.equal(surfaces.includes("runtime-api"), false);
  assert.equal(surfaces.includes("workspaceFileClient"), false);
});

test("keeps static Workspace governance surfaces outside EngineeringFileTab", () => {
  const workbench = source("src/main.jsx");
  const surfaces = source("src/components/workbench/workspace-static-surfaces.jsx");
  assert.match(workbench, /GovernanceSurfacePanel/);
  for (const panel of ["CollaborationBoundaryPanel", "ExecutionPermissionsPanel", "DocumentationRulesPanel", "SystemArchitecturePanel", "DataContractsPanel", "CodeStructurePanel"]) {
    assert.equal(workbench.includes(`function ${panel}`), false);
  }
  assert.match(surfaces, /export function GovernanceSurfacePanel/);
  assert.equal(surfaces.includes("runtime-api"), false);
  assert.equal(surfaces.includes("workspaceFileClient"), false);
});

test("keeps every domain client behind the shared runtime adapter", () => {
  const expectedCommands = {
    "src/lib/desktop-task-client.js": ["save_desktop_task", "delete_desktop_task"],
    "src/lib/desktop-conversation-client.js": ["save_desktop_conversation", "chat_with_model"],
    "src/lib/execution-client.js": ["generate_readonly_plan", "apply_patch_draft", "run_guarded_check"],
    "src/lib/provider-client.js": ["save_provider_config", "test_provider_model_with_cache"],
    "src/lib/terminal-client.js": ["start_terminal_session", "write_terminal_session", "open_native_terminal"],
    "src/lib/workspace-goal-client.js": ["create_goal", "switch_active_goal"],
    "src/lib/workspace-registry-client.js": ["add_registry_project", "switch_registry_project"],
  };
  for (const [file, commands] of Object.entries(expectedCommands)) {
    const client = source(file);
    assert.match(client, /invokeRuntimeCommand|invokeTauriCommand|invokeWorkspaceOperation/, `${file} must use the shared runtime adapter`);
    for (const command of commands) assert.match(client, new RegExp(command), `${file} must own ${command}`);
  }
});

test("keeps the App three-column shell outside the lifecycle container", () => {
  const workbench = source("src/main.jsx");
  const shell = source("src/components/workbench/app-shell.jsx");
  const surface = source("src/components/workbench/app-workbench-surface.jsx");
  const app = componentSource(workbench, "App", "ActionFeedbackToast");
  assert.match(workbench, /import \{ AppWorkbenchSurface \} from "\.\/components\/workbench\/app-workbench-surface"/);
  assert.match(app, /<AppWorkbenchSurface/);
  assert.equal(app.includes('className="shell"'), false);
  assert.equal(app.includes("<TooltipProvider"), false);
  assert.match(shell, /export function AppShell/);
  assert.match(surface, /export function AppWorkbenchSurface/);
  assert.match(surface, /<AppShell/);
  assert.equal(shell.includes("runtime-api"), false);
  assert.equal(surface.includes("runtime-api"), false);
  assert.equal(shell.includes("desktop-task-client"), false);
});

test("keeps request progress in the conversation surface instead of duplicate global feedback", () => {
  const composer = source("src/components/workbench/chat-composer.jsx");
  const workbench = source("src/main.jsx");
  const requestState = source("src/components/workbench/use-conversation-request-state.js");
  const transcript = source("src/components/workbench/conversation-transcript.jsx");
  assert.match(composer, /\{modelLoading \? <span className="chatComposerSpinner"/);
  assert.equal(composer.includes("sending || modelLoading ? <span className=\"chatComposerSpinner\""), false);
  assert.match(workbench, /if \(feedback\.status === "running"\) return null;/);
  assert.match(requestState, /setStreamingReply\(\(current\) => `\$\{current\}\$\{text\}`\)/);
  assert.match(transcript, /conversationMessage-streaming/);
});

test("keeps RightRail shared display primitives outside the root Workbench module", () => {
  const workbench = source("src/main.jsx");
  const components = source("src/components/workbench/right-rail-components.jsx");
  const presentation = source("src/lib/task-presentation.js");
  assert.match(workbench, /import \{ GoalStatusIcon, GoalTaskItem, ProjectProfileItem, RailDisclosure \} from/);
  assert.equal(workbench.includes("function RailDisclosure"), false);
  assert.equal(workbench.includes("function GoalTaskItem"), false);
  assert.match(components, /export function RailDisclosure/);
  assert.match(components, /export function GoalTaskItem/);
  assert.match(components, /export function ProjectProfileItem/);
  assert.match(presentation, /export function taskGoalName/);
  assert.equal(components.includes("runtime-api"), false);
});

test("keeps App Workspace capability and Provider record actions in dedicated hooks", () => {
  const workbench = source("src/main.jsx");
  const capabilities = source("src/components/workbench/use-workspace-capability-actions.js");
  const providerRecord = source("src/components/workbench/use-provider-test-record.js");
  assert.match(workbench, /useWorkspaceCapabilityActions\(\{/);
  assert.match(workbench, /useProviderTestRecord\(\{/);
  assert.equal(workbench.includes("await workspaceCapabilityClient.updateProjectCapability"), false);
  assert.equal(workbench.includes("setComposerModelTests\(\(current\) =>"), false);
  assert.match(capabilities, /export function useWorkspaceCapabilityActions/);
  assert.match(providerRecord, /export function useProviderTestRecord/);
  assert.equal(capabilities.includes("runtime-api"), false);
  assert.equal(providerRecord.includes("runtime-api"), false);
});

test("keeps AgentWorkspace input and assistant action forwarding in a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const actions = source("src/components/workbench/use-agent-workspace-input-actions.js");
  assert.match(workbench, /import \{ useAgentWorkspaceInputActions \} from/);
  assert.match(workbench, /useAgentWorkspaceInputActions\(\{/);
  assert.equal(workbench.includes("event.clipboardData?.files"), false);
  assert.equal(workbench.includes("const turn = chatTurns.find"), false);
  assert.match(actions, /export function useAgentWorkspaceInputActions/);
  assert.match(actions, /handlePaste/);
  assert.match(actions, /handleAssistantUiAction/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps Provider composer model derivation outside App", () => {
  const workbench = source("src/main.jsx");
  const viewModel = source("src/components/workbench/use-provider-composer-view-model.js");
  assert.match(workbench, /useProviderComposerViewModel\(\{/);
  assert.equal(workbench.includes("const composerModelOptions = composerModels.length"), false);
  assert.equal(workbench.includes("Object.fromEntries(\n    composerModelOptions.map"), false);
  assert.match(viewModel, /export function useProviderComposerViewModel/);
  assert.match(viewModel, /composerModelAvailability/);
  assert.match(viewModel, /currentProviderHealth/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("keeps active Task projection inside the Task session boundary", () => {
  const workbench = source("src/main.jsx");
  const session = source("src/components/workbench/use-task-session.js");
  assert.match(workbench, /activeTaskId,\n    activeTask,/);
  assert.match(workbench, /<AgentWorkspace\n          snapshot=\{snapshot\}\n          activeTaskId=\{activeTaskId\}/);
  assert.equal(workbench.includes("const activeTask = tasks.find((task) => task.id === activeTaskId)"), false);
  assert.match(session, /const activeTask = tasks\.find/);
  assert.match(session, /activeTask,/);
});

test("injects goal creation into the AgentWorkspace task board boundary", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  assert.match(workspace, /onCreateGoal,/);
  assert.match(workbench, /onCreateTask=\{createManualTask\}\n          onCreateGoal=\{createGoal\}/);
});

test("keeps AgentWorkspace runtime selection injected from the App adapter boundary", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "statusLabel");
  assert.match(workspace, /isTauri,\n/);
  assert.equal(workspace.includes("isTauriRuntime()"), false);
  assert.match(workbench, /isTauri=\{isTauriRuntime\(\)\}/);
});

test("routes every submitted attachment cleanup through the Conversation resource boundary", () => {
  const submission = source("src/components/workbench/use-conversation-submission.js");
  const workbench = source("src/main.jsx");
  assert.match(submission, /clearAttachments/);
  assert.equal(submission.includes("setAttachments([])"), false);
  assert.match(workbench, /clearAttachments,\n    setChatLoading/);
});

test("keeps terminal and attachment retention budgets in one resource module", () => {
  const budget = source("src/lib/resource-budget.js");
  const terminal = source("src/components/workbench/use-terminal-session.js");
  const controller = source("src/lib/terminal-session-controller.js");
  assert.match(budget, /terminalTextLimit/);
  assert.match(budget, /attachmentMaxTotalBytes/);
  assert.match(terminal, /resourceBudget\.terminalChunkLimit/);
  assert.match(terminal, /resourceBudget\.terminalTextLimit/);
  assert.match(controller, /resourceBudget\.terminalLogLimit/);
});

test("collects bounded performance samples at startup, route, conversation, and terminal boundaries", () => {
  const workbench = source("src/main.jsx");
  const tabs = source("src/components/workbench/use-workspace-tabs.js");
  const persistence = source("src/components/workbench/use-conversation-persistence.js");
  const terminal = source("src/components/workbench/use-terminal-session.js");
  const patchActions = source("src/components/workbench/use-patch-actions.js");
  const executionActions = source("src/lib/execution-action-controller.js");
  const recorder = source("src/lib/performance-baseline.js");
  assert.match(workbench, /exposeDesktopPerformanceBaseline\(\)/);
  assert.match(workbench, /recordWorkbenchReady\(\)/);
  assert.match(tabs, /measureDesktopPerformance\("workspace-route"\)/);
  assert.match(persistence, /measureDesktopPerformance\("conversation-update"\)/);
  assert.match(terminal, /measureDesktopPerformance\("terminal-output"\)/);
  assert.match(patchActions, /measureDesktopPerformance\("patch-draft"/);
  assert.match(patchActions, /measureDesktopPerformance\("patch-apply"/);
  assert.match(executionActions, /measureDesktopPerformance\("guarded-check"/);
  assert.match(recorder, /maxSamples: 60/);
  assert.doesNotMatch(recorder, /text:|attachments:|content:/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = (relativePath) =>
  fs.readFileSync(path.join(desktopRoot, relativePath), "utf8");
const componentSource = (workbench, start, end) =>
  workbench.slice(
    workbench.indexOf(`function ${start}`),
    workbench.indexOf(`function ${end}`),
  );

test("keeps the Workbench shell away from direct runtime commands and the retired task workspace", () => {
  const workbench = source("src/main.jsx");
  assert.equal(workbench.includes("invokeRuntimeCommand"), false);
  assert.equal(workbench.includes("invokeTauriCommand"), false);
  assert.equal(workbench.includes("TaskWorkspace"), false);
  assert.equal(workbench.includes("open-task-workspace"), false);
  for (const hook of [
    "useWorkspaceSession",
    "useConversationSession",
    "useTaskSession",
    "useExecutionSession",
    "useProviderSession",
    "useTerminalSession",
  ]) {
    assert.match(workbench, new RegExp(`import \\{ ${hook} \\}`));
  }
});

test("keeps Workbench fallback contracts outside the entrypoint", () => {
  const workbench = source("src/main.jsx");
  const defaults = source("src/lib/workbench-defaults.js");
  assert.match(workbench, /from "\.\/lib\/workbench-defaults"/);
  for (const contract of [
    "fallbackSnapshot",
    "fallbackProvider",
    "fallbackModelCatalog",
    "planCards",
    "taskStatuses",
  ]) {
    assert.equal(workbench.includes(`const ${contract} =`), false);
    assert.match(defaults, new RegExp(`export const ${contract} =`));
  }
});

test("keeps Preview Workspace state projection outside the entrypoint", () => {
  const workbench = source("src/main.jsx");
  const bridge = source("src/lib/workspace-runtime-bridge.js");
  const client = source("src/lib/workspace-preview-client.js");
  assert.match(workbench, /from "\.\/lib\/workspace-runtime-bridge"/);
  assert.equal(workbench.includes("workspace-preview-client"), false);
  assert.equal(workbench.includes("async function loadPreviewWorkspaceSnapshot"), false);
  assert.equal(workbench.includes("async function loadPreviewJson"), false);
  assert.match(bridge, /from "\.\/workspace-preview-client\.js"/);
  assert.match(bridge, /export async function loadWorkspaceSnapshot/);
  assert.match(client, /export async function loadPreviewWorkspaceSnapshot/);
  assert.match(client, /export async function loadPreviewJson/);
  assert.match(client, /\.omnidesk\/data\/desktop-registry\.json/);
  assert.equal(client.includes(".project-os"), false);
});

test("keeps Workspace runtime transports outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const bridge = source("src/lib/workspace-runtime-bridge.js");
  assert.equal(workbench.includes("@tauri-apps/api/core"), false);
  assert.equal(workbench.includes("@tauri-apps/plugin-dialog"), false);
  assert.equal(workbench.includes("/__omnidesk/copy-text"), false);
  for (const action of ["loadWorkspaceSnapshot", "refreshWorkspaceFactsPreview", "copyTextToSystemClipboard", "pickProjectDirectory"]) {
    assert.doesNotMatch(workbench, new RegExp(`(?:async )?function ${action}\\(`));
    assert.match(bridge, new RegExp(`export async function ${action}\\(`));
  }
});

test("keeps the task detail surface outside the Workbench shell", () => {
  const workbench = source("src/main.jsx");
  const activeTask = source("src/components/workbench/active-task.jsx");
  assert.equal(workbench.includes("function ActiveTask"), false);
  assert.match(
    workbench,
    /import \{ ActiveTask \} from "\.\/components\/workbench\/active-task"/,
  );
  assert.match(activeTask, /export function ActiveTask/);
  assert.equal(activeTask.includes("runtime-api"), false);
  assert.equal(activeTask.includes("desktop-task-client"), false);
});

test("keeps current project progress rendering outside the Workbench shell", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const progress = source(
    "src/components/workbench/current-progress-panel.jsx",
  );
  assert.match(engineeringFile, /<CurrentProgressPanel/);
  assert.equal(workbench.includes("function CurrentProgressSlot"), false);
  assert.equal(workbench.includes("function CurrentProgressPanel"), false);
  assert.match(progress, /export function CurrentProgressPanel/);
  assert.match(progress, /buildProjectFactStore/);
  assert.match(progress, /compileCurrentProgressSlots/);
  assert.equal(progress.includes("runtime-api"), false);
});

test("keeps the cross-project dashboard outside the Workspace facts refresh boundary", () => {
  const workbench = source("src/main.jsx");
  const dashboard = source("src/components/workbench/workspace-dashboard.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const facts = engineeringFile;
  assert.match(workbench, /React\.lazy\(\(\) => import\("\.\/components\/workbench\/engineering-file-tab"\)/);
  assert.match(engineeringFile, /<WorkspaceDashboard/);
  assert.equal(workbench.includes('className="portfolioCommandBar"'), false);
  assert.equal(facts.includes("globalOverview"), false);
  assert.match(dashboard, /export function WorkspaceDashboard/);
  assert.match(dashboard, /onRequestProjectAccess/);
  assert.match(dashboard, /taskStatuses/);
  assert.equal(dashboard.includes("runtime-api"), false);
  assert.equal(dashboard.includes("desktop-task-client"), false);
});

test("keeps Workspace facts refresh and Slot rendering outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const facts = source("src/components/workbench/workspace-facts-preview.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  assert.match(engineeringFile, /<WorkspaceFactsPreview onNavigate=/);
  assert.doesNotMatch(workbench, /function WorkspaceFactsPreview\(/);
  assert.match(facts, /export function WorkspaceFactsPreview/);
  assert.match(facts, /onRefreshFacts/);
  assert.match(facts, /onNavigate/);
  assert.match(facts, /createProjectOverviewSlotRuntime/);
  assert.equal(facts.includes("runtime-api"), false);
});

test("keeps project runbook rendering outside the Workbench shell", () => {
  const workbench = source("src/main.jsx");
  const runbook = source("src/components/workbench/runbook-panel.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  assert.match(engineeringFile, /<RunbookPanel/);
  assert.equal(workbench.includes("function RunbookPanel"), false);
  assert.equal(workbench.includes("function RunbookSlot"), false);
  assert.match(runbook, /export function RunbookPanel/);
  assert.match(runbook, /onCopyCommand/);
  assert.match(runbook, /onOpenSource/);
  assert.equal(runbook.includes("runtime-api"), false);
});

test("keeps project risk rendering outside the Workbench shell", () => {
  const workbench = source("src/main.jsx");
  const riskBoundary = source(
    "src/components/workbench/risk-boundary-panel.jsx",
  );
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  assert.match(engineeringFile, /<RiskBoundaryPanel/);
  assert.equal(workbench.includes("function RiskBoundaryPanel"), false);
  assert.match(riskBoundary, /export function RiskBoundaryPanel/);
  assert.equal(riskBoundary.includes("runtime-api"), false);
});

test("keeps governance health surfaces outside the Workbench shell", () => {
  const workbench = source("src/main.jsx");
  const surfaces = source(
    "src/components/workbench/governance-health-sections.jsx",
  );
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  assert.match(engineeringFile, /<GovernanceFilesHealthSection/);
  assert.match(engineeringFile, /<DesignImplementationHealthSection/);
  assert.equal(workbench.includes("function GovernanceFilesHealthSection"), false);
  assert.equal(workbench.includes("function DesignImplementationHealthSection"), false);
  assert.match(surfaces, /export function GovernanceFilesHealthSection/);
  assert.match(surfaces, /export function DesignImplementationHealthSection/);
  assert.equal(surfaces.includes("runtime-api"), false);
  assert.equal(surfaces.includes("desktop-task-client"), false);
});

test("keeps task-context navigation injected instead of dispatching UI events", () => {
  const context = source(
    "src/components/workbench/task-conversation-context.jsx",
  );
  const lifecycle = source(
    "src/components/workbench/use-task-conversation-event.js",
  );
  const workbench = source("src/main.jsx");
  assert.equal(context.includes("omnidesk:open-task-conversation"), false);
  assert.equal(workbench.includes("omnidesk:open-task-conversation"), false);
  assert.match(context, /onPreviousTask/);
  assert.match(context, /onNextTask/);
  assert.match(lifecycle, /return \{ openTaskConversationWorkspace \}/);
});

test("keeps conversation rendering outside the Workbench request container", () => {
  const workbench = source("src/main.jsx");
  const canvas = source(
    "src/components/workbench/agent-workspace-conversation-canvas.jsx",
  );
  const transcript = source(
    "src/components/workbench/conversation-transcript.jsx",
  );
  assert.match(workbench, /<AgentWorkspaceConversationCanvas/);
  assert.equal(workbench.includes("function shouldShowAgentTimeline"), false);
  assert.match(canvas, /<ConversationTranscript/);
  assert.match(transcript, /export function ConversationTranscript/);
  assert.equal(transcript.includes("runtime-api"), false);
  assert.equal(transcript.includes("desktop-conversation-client"), false);
});

test("keeps the AgentWorkspace conversation canvas outside its workspace container", () => {
  const workbench = source("src/main.jsx");
  const canvas = source(
    "src/components/workbench/agent-workspace-conversation-canvas.jsx",
  );
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
  assert.match(workbench, /<AgentWorkspaceConversationCanvas/);
  assert.equal(workspace.includes('className="conversationStart"'), false);
  assert.match(canvas, /export function AgentWorkspaceConversationCanvas/);
  assert.match(canvas, /<ConversationTranscript/);
  assert.equal(canvas.includes("runtime-api"), false);
  assert.equal(canvas.includes("desktop-conversation-client"), false);
});

test("keeps conversation turn actions in a conversation hook", () => {
  const workbench = source("src/main.jsx");
  const actions = source(
    "src/components/workbench/use-conversation-turn-actions.js",
  );
  assert.match(workbench, /useConversationTurnActions/);
  assert.equal(
    workbench.includes("const handleConversationTurnAction = async"),
    false,
  );
  assert.match(actions, /export function useConversationTurnActions/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps AgentTopic task-board state and derived rows in a task hook", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const taskBoard = source(
    "src/components/workbench/use-agent-topic-task-board.js",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /useAgentTopicTaskBoard/);
  assert.equal(workbench.includes("buildTaskBoardViewModel"), false);
  assert.match(taskBoard, /useTaskBoardState/);
  assert.match(taskBoard, /buildTaskBoardViewModel/);
  assert.equal(taskBoard.includes("runtime-api"), false);
});

test("keeps Agent Run approvals and task presentation injected through the engineering topic boundary", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  assert.match(workspace, /agentRuns=\{agentRuns\}/);
  assert.match(workspace, /onApproveAgentRun=\{onApproveAgentRun\}/);
  assert.match(workspace, /onResumeAgentRun=\{onResumeAgentRun\}/);
  assert.match(workspace, /presentation=\{\{ agentTopicPresentation, dedicatedSurfaceByTopic, taskStatuses, workspaceRouteById \}\}/);
  assert.doesNotMatch(workbench, /function EngineeringFileTab\(/);
  assert.match(engineeringFile, /export function EngineeringFileTab/);
  assert.match(engineeringFile, /presentation=\{agentTopicPresentation\}/);
  assert.match(engineeringFile, /agentRuns=\{agentRuns\}/);
  assert.match(topic, /const boardState = useAgentTopicTaskBoard/);
  assert.equal(topic.includes("runtime-api"), false);
  assert.equal(engineeringFile.includes("runtime-api"), false);
});

test("keeps AgentTopic task mutations behind injected Task and Workspace actions", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const controller = source("src/lib/task-board-action-controller.js");
  const goalActions = source("src/lib/agent-topic-goal-actions.js");
  const taskActions = source(
    "src/components/workbench/use-agent-topic-task-actions.js",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /useAgentTopicTaskActions/);
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
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const taskBoard = source(
    "src/components/workbench/agent-topic-task-board.jsx",
  );
  const content = source(
    "src/components/workbench/agent-topic-panel-content.jsx",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /<AgentTopicPanelContent/);
  assert.match(content, /<AgentTopicTaskBoard/);
  assert.equal(workbench.includes('className="taskBoardToolbar"'), false);
  assert.match(taskBoard, /export function AgentTopicTaskBoard/);
  assert.equal(taskBoard.includes("runtime-api"), false);
  assert.equal(taskBoard.includes("desktop-task-client"), false);
});

test("keeps AgentTopic overview cards in a pure Task and Workspace presentation module", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const viewModel = source("src/lib/agent-topic-view-model.js");
  const cards = source("src/lib/agent-topic-cards.js");
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /buildAgentTopicViewModel/);
  assert.match(viewModel, /buildAgentTopicCards/);
  assert.equal(workbench.includes("const cardsByTopic"), false);
  assert.match(cards, /export function buildAgentTopicCards/);
  assert.equal(cards.includes("runtime-api"), false);
});

test("keeps AgentTopic capability aggregation in a pure view-model module", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const viewModel = source("src/lib/agent-topic-view-model.js");
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /buildAgentTopicViewModel/);
  assert.equal(workbench.includes("const assetDomains ="), false);
  assert.match(viewModel, /export function buildAgentTopicViewModel/);
  assert.match(viewModel, /export function canPreviewAgentTopicFile/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("keeps AgentTopic Agent configuration descriptions out of the task container", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const viewModel = source("src/lib/agent-topic-view-model.js");
  const config = source("src/lib/agent-topic-agent-config.js");
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /buildAgentTopicViewModel/);
  assert.match(viewModel, /agentConfigCapabilitySpec/);
  assert.equal(workbench.includes("const agentConfigSpecs"), false);
  assert.match(config, /export function agentConfigCapabilitySpec/);
  assert.equal(config.includes("runtime-api"), false);
});

test("keeps AgentTopic summary rendering outside the task action container", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const summary = source(
    "src/components/workbench/agent-topic-capability-summary.jsx",
  );
  const content = source(
    "src/components/workbench/agent-topic-panel-content.jsx",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /<AgentTopicPanelContent/);
  assert.match(content, /<AgentTopicCapabilitySummary/);
  assert.equal(workbench.includes('className="agentConfigCapability"'), false);
  assert.match(summary, /export function AgentTopicCapabilitySummary/);
  assert.equal(summary.includes("runtime-api"), false);
});

test("keeps controlled execution command rendering outside the AgentTopic container", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const commands = source(
    "src/components/workbench/controlled-commands-panel.jsx",
  );
  const content = source(
    "src/components/workbench/agent-topic-panel-content.jsx",
  );
  assert.match(content, /<ControlledCommandsPanel/);
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /<AgentTopicPanelContent/);
  assert.equal(topic.includes("agentControlledCommands"), false);
  assert.match(commands, /export function ControlledCommandsPanel/);
  assert.equal(commands.includes("runtime-api"), false);
});

test("keeps AgentTopic task dialogs outside the task action container", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const taskBoard = source(
    "src/components/workbench/agent-topic-task-board.jsx",
  );
  const dialogs = source(
    "src/components/workbench/agent-topic-task-dialogs.jsx",
  );
  const content = source(
    "src/components/workbench/agent-topic-panel-content.jsx",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /<AgentTopicPanelContent/);
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
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const detail = source("src/components/workbench/agent-topic-task-detail.jsx");
  const content = source(
    "src/components/workbench/agent-topic-panel-content.jsx",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /<AgentTopicPanelContent/);
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
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const topic = source("src/components/workbench/agent-topic-panel.jsx");
  const actions = source("src/lib/agent-topic-goal-actions.js");
  const taskActions = source(
    "src/components/workbench/use-agent-topic-task-actions.js",
  );
  assert.match(engineeringFile, /<AgentTopicPanel/);
  assert.match(topic, /useAgentTopicTaskActions/);
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
  assert.match(
    workbench,
    /React\.lazy\(\(\) => import\("\.\/components\/workbench\/provider-panel"\)/,
  );
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
  const actions = source(
    "src/components/workbench/use-composer-model-actions.js",
  );
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
  const navigation = source(
    "src/components/workbench/use-agent-workspace-navigation.js",
  );
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
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
  assert.equal(
    workbench.includes("const selectEngineeringFile = async"),
    false,
  );
  assert.match(actions, /export function createWorkspaceFileActions/);
  assert.equal(actions.includes("runtime-api"), false);
});

test("keeps conversation Patch Apply orchestration outside AgentWorkspace", () => {
  const workbench = source("src/main.jsx");
  const patchApply = source("src/lib/conversation-patch-apply.js");
  assert.match(workbench, /applyPendingConversationPatch/);
  assert.equal(
    workbench.includes("const executePendingPatchApply = async"),
    false,
  );
  assert.match(
    patchApply,
    /export async function applyPendingConversationPatch/,
  );
  assert.equal(patchApply.includes("runtime-api"), false);
});

test("keeps AgentWorkspace request state and cancellation in a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const requestState = source(
    "src/components/workbench/use-conversation-request-state.js",
  );
  assert.match(workbench, /useConversationRequestState/);
  assert.equal(workbench.includes("const stopCurrentResponse = ()"), false);
  assert.match(requestState, /export function useConversationRequestState/);
  assert.equal(requestState.includes("runtime-api"), false);
});

test("keeps Conversation submission orchestration behind an injected hook", () => {
  const workbench = source("src/main.jsx");
  const submission = source(
    "src/components/workbench/use-conversation-submission.js",
  );
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
  const navigation = source(
    "src/components/workbench/use-conversation-navigation.js",
  );
  assert.match(workbench, /useConversationNavigation/);
  assert.equal(
    workbench.includes("const openTaskConversation = (taskId)"),
    false,
  );
  assert.equal(workbench.includes("const selectConversation = (id)"), false);
  assert.equal(workbench.includes("const deleteConversation = (id)"), false);
  assert.match(navigation, /export function useConversationNavigation/);
  assert.match(navigation, /deleteConversationState/);
  assert.equal(navigation.includes("runtime-api"), false);
});

test("keeps goal and task context projection behind the Workspace context hook", () => {
  const workbench = source("src/main.jsx");
  const contextActions = source(
    "src/components/workbench/use-workspace-context-actions.js",
  );
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
  const terminalCheck = source(
    "src/components/workbench/use-terminal-check-action.js",
  );
  assert.match(workbench, /useTerminalCheckAction/);
  assert.equal(workbench.includes("const runTerminalCheck = async"), false);
  assert.match(terminalCheck, /export function useTerminalCheckAction/);
  assert.equal(terminalCheck.includes("runtime-api"), false);
});

test("keeps governance task generation behind the Workspace task hook", () => {
  const workbench = source("src/main.jsx");
  const governance = source(
    "src/components/workbench/use-governance-task-actions.js",
  );
  assert.match(workbench, /useGovernanceTaskActions/);
  assert.equal(workbench.includes("const createGovernanceTask = async"), false);
  assert.equal(
    workbench.includes("const createDesignGovernanceTask = async"),
    false,
  );
  assert.match(governance, /export function useGovernanceTaskActions/);
  assert.equal(governance.includes("runtime-api"), false);
  assert.equal(workbench.includes("legacyCreateGovernanceTask"), false);
  assert.equal(workbench.includes("legacyCreateDesignGovernanceTask"), false);
});

test("keeps Task persistence and state projection behind the Task hook", () => {
  const workbench = source("src/main.jsx");
  const persistence = source(
    "src/components/workbench/use-task-persistence.js",
  );
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
  assert.match(
    controller,
    /export function createConversationActionController/,
  );
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
  const tabs = source(
    "src/components/workbench/agent-workspace-auxiliary-tabs.jsx",
  );
  const terminalDock = source("src/components/workbench/terminal-dock.jsx");
  assert.match(workbench, /<AgentWorkspaceAuxiliaryTabs/);
  assert.match(tabs, /<TerminalDock/);
  assert.match(tabs, /React\.lazy\(\(\) => import\("\.\/terminal-dock"\)/);
  assert.match(tabs, /<TerminalModuleBoundary>/);
  assert.match(tabs, /OmniDesk terminal module error/);
  assert.equal(workbench.includes("function TerminalDock"), false);
  assert.equal(workbench.includes("@xterm/xterm"), false);
  assert.match(terminalDock, /export function TerminalDock/);
  assert.match(terminalDock, /new Terminal\(/);
  assert.match(terminalDock, /formatTerminalInputForPaste/);
  assert.equal(terminalDock.includes("desktop-task-client"), false);
});

test("keeps AgentWorkspace auxiliary tab branching outside its workspace container", () => {
  const workbench = source("src/main.jsx");
  const tabs = source(
    "src/components/workbench/agent-workspace-auxiliary-tabs.jsx",
  );
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
  assert.match(workbench, /<AgentWorkspaceAuxiliaryTabs/);
  assert.equal(workspace.includes('tab.kind === "terminal"'), false);
  assert.equal(workspace.includes('tab.kind === "trace"'), false);
  assert.match(tabs, /export function AgentWorkspaceAuxiliaryTabs/);
  assert.match(tabs, /<TerminalDock/);
  assert.equal(tabs.includes("runtime-api"), false);
});

test("keeps App workspace refresh lifecycle behind an injected Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const refresh = source(
    "src/components/workbench/use-workspace-snapshot-refresh.js",
  );
  assert.match(workbench, /useWorkspaceSnapshotRefresh\(\{/);
  assert.equal(workbench.includes("workspace://files-changed"), false);
  assert.equal(workbench.includes("const startWatcher = async"), false);
  assert.equal(
    workbench.includes("omnidesk:snapshot-refresh-requested"),
    false,
  );
  assert.match(refresh, /export function useWorkspaceSnapshotRefresh/);
  assert.equal(refresh.includes("runtime-api"), false);
});

test("keeps persisted Conversation and Task loading behind the Workspace data sync hook", () => {
  const workbench = source("src/main.jsx");
  const sync = source("src/components/workbench/use-workspace-data-sync.js");
  assert.match(
    workbench,
    /import \{ useWorkspaceDataSync \} from "\.\/components\/workbench\/use-workspace-data-sync"/,
  );
  assert.match(workbench, /useWorkspaceDataSync\(\{/);
  assert.equal(
    workbench.includes(
      "listDesktopConversations()\n      .then((records) => {\n        if (!cancelled) setConversations",
    ),
    false,
  );
  assert.equal(
    workbench.includes(
      "listDesktopTasks()\n      .then((records) => {\n        if (cancelled || !Array.isArray(records)) return",
    ),
    false,
  );
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
  assert.match(
    workbench,
    /import \{ useProviderDataSync \} from "\.\/components\/workbench\/use-provider-data-sync"/,
  );
  assert.match(workbench, /useProviderDataSync\(\{/);
  assert.equal(
    workbench.includes("providerClient.getProviderStatus(fallbackProvider)"),
    false,
  );
  assert.equal(
    workbench.includes("providerClient.getModelCatalog(fallbackModelCatalog)"),
    false,
  );
  assert.equal(
    workbench.includes("providerClient.getModelHealth().catch"),
    false,
  );
  assert.match(sync, /export function useProviderDataSync/);
  assert.match(sync, /getProviderStatus\(fallbackProvider\)/);
  assert.match(sync, /getModelCatalog\(fallbackModelCatalog\)/);
  assert.match(sync, /getModelHealth\(\)/);
  assert.equal(sync.includes("provider-client"), false);
  assert.equal(sync.includes("runtime-api"), false);
});

test("keeps fallback Workspace and Provider data behind the initial hydration gate", () => {
  const workbench = source("src/main.jsx");
  const workspaceSession = source("src/components/workbench/use-workspace-session.js");
  const providerSession = source("src/components/workbench/use-provider-session.js");
  const providerSync = source("src/components/workbench/use-provider-data-sync.js");
  assert.match(workbench, /if \(!workspaceReady \|\| !providerReady\)/);
  assert.match(workbench, /正在恢复工作区/);
  assert.match(workspaceSession, /setReady\(true\)/);
  assert.match(providerSession, /providerReady/);
  assert.match(providerSync, /setProviderReady\(true\)/);
});

test("keeps AgentWorkspace conversation reset lifecycle in a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const reset = source(
    "src/components/workbench/use-conversation-surface-reset.js",
  );
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
  assert.match(
    workbench,
    /import \{ useConversationSurfaceReset \} from "\.\/components\/workbench\/use-conversation-surface-reset"/,
  );
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
  const reset = source(
    "src/components/workbench/use-workspace-ephemeral-reset.js",
  );
  assert.match(
    workbench,
    /import \{ useWorkspaceEphemeralReset \} from "\.\/components\/workbench\/use-workspace-ephemeral-reset"/,
  );
  assert.match(workbench, /useWorkspaceEphemeralReset\(\{/);
  assert.equal(
    workbench.includes("setActiveConversationId(`conv-${Date.now()}`)"),
    false,
  );
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
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  assert.match(
    workbench,
    /import \{ ProjectSidebar \} from "\.\/components\/workbench\/project-sidebar"/,
  );
  assert.match(workbench, /<ProjectSidebar/);
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
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const state = source("src/components/workbench/use-project-sidebar-state.js");
  assert.equal(workbench.includes("function ProjectSidebar"), false);
  assert.match(
    sidebar,
    /import \{ useProjectSidebarState \} from "\.\/use-project-sidebar-state"/,
  );
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
  assert.match(
    workbench,
    /import \{ useSidebarLayout \} from "\.\/components\/workbench\/use-sidebar-layout"/,
  );
  assert.match(
    workbench,
    /const \{ beginSidebarResize, leftWidth, rightWidth \} = useSidebarLayout\(\)/,
  );
  assert.equal(
    workbench.includes('document.body.classList.add("isResizingSidebar")'),
    false,
  );
  assert.match(layout, /export function useSidebarLayout/);
  assert.match(layout, /pointermove/);
  assert.match(layout, /pointerup/);
  assert.equal(layout.includes("runtime-api"), false);
});

test("keeps Workspace capability enablement dialog outside ProjectSidebar", () => {
  const workbench = source("src/main.jsx");
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const dialog = source(
    "src/components/workbench/project-capability-dialog.jsx",
  );
  assert.match(workbench, /<ProjectSidebar/);
  assert.match(
    sidebar,
    /import \{ ProjectCapabilityDialog \} from "\.\/project-capability-dialog"/,
  );
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
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const viewModel = source("src/lib/project-sidebar-view-model.js");
  assert.match(workbench, /<ProjectSidebar/);
  assert.match(sidebar, /discoverableProjectCapabilities/);
  assert.match(sidebar, /projectRuntimeStatus/);
  assert.equal(sidebar.includes("const relatedTasks ="), false);
  assert.equal(
    sidebar.includes("const discoverableCapabilities = (snapshot"),
    false,
  );
  assert.match(viewModel, /export function projectRuntimeStatus/);
  assert.match(viewModel, /export function discoverableProjectCapabilities/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("keeps ProjectSidebar access-mode labels in a pure presentation module", () => {
  const workbench = source("src/main.jsx");
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const dialogs = source("src/components/workbench/project-access-dialogs.jsx");
  const presentation = source("src/lib/project-access-presentation.js");
  assert.match(workbench, /<ProjectSidebar/);
  assert.match(sidebar, /ProjectAccessDialogs/);
  assert.match(dialogs, /projectAccessChoices/);
  assert.equal(workbench.includes("每次确认后修改工程文件并运行验证。"), false);
  assert.match(presentation, /export const projectAccessChoices/);
  assert.match(presentation, /export function projectAccessPresentation/);
  assert.equal(presentation.includes("runtime-api"), false);
});

test("keeps ProjectSidebar access dialogs in an injected Workspace surface", () => {
  const workbench = source("src/main.jsx");
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const dialogs = source("src/components/workbench/project-access-dialogs.jsx");
  assert.match(
    workbench,
    /import \{ ProjectSidebar \} from "\.\/components\/workbench\/project-sidebar"/,
  );
  assert.match(sidebar, /<ProjectAccessDialogs/);
  assert.match(dialogs, /export function ProjectAccessDialogs/);
  assert.match(dialogs, /projectAccessPresentation/);
  assert.equal(dialogs.includes("runtime-api"), false);
});

test("keeps ProjectSidebar project rows in an injected Workspace surface", () => {
  const workbench = source("src/main.jsx");
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const list = source("src/components/workbench/project-list.jsx");
  assert.match(workbench, /<ProjectSidebar/);
  assert.match(sidebar, /<ProjectList/);
  assert.match(list, /export function ProjectList/);
  assert.match(list, /data-copy-project-path/);
  assert.equal(list.includes("runtime-api"), false);
});

test("keeps ProjectSidebar clipboard delegation in an injected Workspace hook", () => {
  const workbench = source("src/main.jsx");
  const sidebar = source("src/components/workbench/project-sidebar.jsx");
  const clipboard = source("src/components/workbench/use-project-path-copy.js");
  assert.match(
    sidebar,
    /import \{ useProjectPathCopy \} from "\.\/use-project-path-copy"/,
  );
  assert.match(sidebar, /useProjectPathCopy\(\{/);
  assert.equal(sidebar.includes('document.addEventListener("click"'), false);
  assert.equal(sidebar.includes('document.execCommand("copy")'), false);
  assert.match(clipboard, /export function useProjectPathCopy/);
  assert.match(clipboard, /data-copy-project-path/);
  assert.match(clipboard, /copyTextToSystemClipboard/);
  assert.equal(clipboard.includes("runtime-api"), false);
});

test("keeps AgentWorkspace Conversation and Task derivation in a pure view-model", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
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
  const goals = source(
    "src/components/workbench/use-workspace-goal-actions.js",
  );
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
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const agentConfig = source(
    "src/components/workbench/agent-config-surface-panel.jsx",
  );
  assert.match(engineeringFile, /onReadEngineeringFile/);
  assert.match(engineeringFile, /onGetHermesExecutorStatus/);
  assert.equal(engineeringFile.includes("workspaceFileClient"), false);
  assert.equal(agentConfig.includes("executionClient"), false);
  assert.equal(agentConfig.includes("runtime-api"), false);
  assert.match(
    workbench,
    /onReadEngineeringFile=\{workspaceFileClient\.readEngineeringFile\}/,
  );
  assert.match(
    workbench,
    /onGetHermesExecutorStatus=\{executionClient\.getHermesExecutorStatus\}/,
  );
});

test("keeps EngineeringFileTab topic routing in a pure Workspace view-model", () => {
  const workbench = source("src/main.jsx");
  const routing = source("src/lib/engineering-topic-surface.js");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  assert.match(engineeringFile, /resolveEngineeringTopicSurface/);
  assert.match(workbench, /workspaceRouteById/);
  assert.equal(engineeringFile.includes("const isCurrentGoalTopic ="), false);
  assert.match(routing, /export function resolveEngineeringTopicSurface/);
  assert.equal(routing.includes("runtime-api"), false);
});

test("injects governance task presentation from its shared domain module", () => {
  const workbench = source("src/main.jsx");
  const presentation = source("src/lib/governance-presentation.js");
  assert.match(workbench, /designImplementationTopics/);
  assert.match(workbench, /governanceFileHealthLabel/);
  assert.match(presentation, /export const designImplementationTopics/);
  assert.match(presentation, /export function governanceFileHealthLabel/);
});

test("keeps reusable Workspace file preview rendering outside topic surfaces", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const preview = source("src/components/workbench/readonly-file-preview.jsx");
  const frame = source("src/components/workbench/engineering-topic-frame.jsx");
  const governance = source(
    "src/components/workbench/governance-health-sections.jsx",
  );
  assert.match(governance, /<ReadonlyFilePreview file=\{governanceFile\}/);
  assert.match(governance, /<ReadonlyFilePreview file=\{previewFile\}/);
  assert.match(
    frame,
    /<ReadonlyFilePreview description="关联工程文件只读预览" file=\{relatedFilePreview\}/,
  );
  assert.match(
    engineeringFile,
    /<ReadonlyFilePreview description=\{selectedEngineeringFile\.description\} file=\{selectedEngineeringFile\}/,
  );
  assert.match(preview, /export function ReadonlyFilePreview/);
  assert.equal(preview.includes("runtime-api"), false);
  assert.equal(preview.includes("workspaceFileClient"), false);
});

test("keeps EngineeringFileTab topic frame outside surface composition", () => {
  const workbench = source("src/main.jsx");
  const frame = source("src/components/workbench/engineering-topic-frame.jsx");
  const composer = source(
    "src/components/workbench/engineering-topic-surface-composer.jsx",
  );
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  assert.match(engineeringFile, /import \{ EngineeringTopicFrame \}/);
  assert.match(engineeringFile, /import \{ EngineeringTopicSurfaceComposer \}/);
  assert.match(engineeringFile, /<EngineeringTopicFrame/);
  assert.match(engineeringFile, /<EngineeringTopicSurfaceComposer/);
  assert.equal(
    engineeringFile.includes("const topicBody = isOverviewTopic"),
    false,
  );
  assert.equal(
    engineeringFile.includes('className="topicGovernanceMeta"'),
    false,
  );
  assert.match(frame, /export function EngineeringTopicFrame/);
  assert.match(composer, /export function EngineeringTopicSurfaceComposer/);
  assert.equal(frame.includes("runtime-api"), false);
  assert.equal(frame.includes("workspaceFileClient"), false);
  assert.equal(composer.includes("runtime-api"), false);
  assert.equal(composer.includes("workspaceFileClient"), false);
});

test("keeps static Workspace memory and asset surfaces outside EngineeringFileTab", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const surfaces = source(
    "src/components/workbench/workspace-static-surfaces.jsx",
  );
  assert.match(engineeringFile, /AssetSurfacePanel/);
  assert.match(engineeringFile, /MemorySurfacePanel/);
  assert.match(
    engineeringFile,
    /from "\.\/workspace-static-surfaces"/,
  );
  assert.equal(workbench.includes("function MemorySurfacePanel"), false);
  assert.equal(workbench.includes("function AssetSurfacePanel"), false);
  assert.match(surfaces, /export function MemorySurfacePanel/);
  assert.match(surfaces, /export function AssetSurfacePanel/);
  assert.equal(surfaces.includes("runtime-api"), false);
  assert.equal(surfaces.includes("workspaceFileClient"), false);
});

test("keeps static Workspace governance surfaces outside EngineeringFileTab", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const surfaces = source(
    "src/components/workbench/workspace-static-surfaces.jsx",
  );
  assert.match(engineeringFile, /GovernanceSurfacePanel/);
  for (const panel of [
    "CollaborationBoundaryPanel",
    "ExecutionPermissionsPanel",
    "DocumentationRulesPanel",
    "SystemArchitecturePanel",
    "DataContractsPanel",
    "CodeStructurePanel",
  ]) {
    assert.equal(workbench.includes(`function ${panel}`), false);
  }
  assert.match(surfaces, /export function GovernanceSurfacePanel/);
  assert.equal(surfaces.includes("runtime-api"), false);
  assert.equal(surfaces.includes("workspaceFileClient"), false);
});

test("keeps every domain client behind the shared runtime adapter", () => {
  const expectedCommands = {
    "src/lib/desktop-task-client.js": [
      "save_desktop_task",
      "delete_desktop_task",
    ],
    "src/lib/desktop-conversation-client.js": [
      "save_desktop_conversation",
      "chat_with_model",
    ],
    "src/lib/execution-client.js": [
      "generate_readonly_plan",
      "apply_patch_draft",
      "run_guarded_check",
    ],
    "src/lib/provider-client.js": [
      "save_provider_config",
      "test_provider_model_with_cache",
    ],
    "src/lib/terminal-client.js": [
      "start_terminal_session",
      "write_terminal_session",
      "open_native_terminal",
    ],
    "src/lib/workspace-goal-client.js": ["create_goal", "switch_active_goal"],
    "src/lib/workspace-registry-client.js": [
      "add_registry_project",
      "switch_registry_project",
    ],
  };
  for (const [file, commands] of Object.entries(expectedCommands)) {
    const client = source(file);
    assert.match(
      client,
      /invokeRuntimeCommand|invokeTauriCommand|invokeWorkspaceOperation/,
      `${file} must use the shared runtime adapter`,
    );
    for (const command of commands)
      assert.match(client, new RegExp(command), `${file} must own ${command}`);
  }
});

test("keeps the App three-column shell outside the lifecycle container", () => {
  const workbench = source("src/main.jsx");
  const shell = source("src/components/workbench/app-shell.jsx");
  const surface = source("src/components/workbench/app-workbench-surface.jsx");
  const app = componentSource(workbench, "App", "ActionFeedbackToast");
  assert.match(
    workbench,
    /import \{ AppWorkbenchSurface \} from "\.\/components\/workbench\/app-workbench-surface"/,
  );
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
  const chatDock = source("src/components/workbench/chat-dock.jsx");
  const workbench = source("src/main.jsx");
  const requestState = source(
    "src/components/workbench/use-conversation-request-state.js",
  );
  const transcript = source(
    "src/components/workbench/conversation-transcript.jsx",
  );
  assert.match(
    composer,
    /\{modelLoading \? <span className="chatComposerSpinner"/,
  );
  assert.equal(
    composer.includes(
      'sending || modelLoading ? <span className="chatComposerSpinner"',
    ),
    false,
  );
  assert.match(workbench, /if \(feedback\.status === "running"\) return null;/);
  assert.match(
    requestState,
    /streamingReplyRef\.current \+= text/,
  );
  assert.match(requestState, /responseMode: partialReply \? "partial" : ""/);
  assert.match(transcript, /conversationMessage-streaming/);
  assert.equal(composer.includes("正在生成，可继续补充"), false);
  assert.equal(chatDock.includes("发送将重启"), false);
  assert.equal(chatDock.includes("输入“停止”可取消"), false);
});

test("shows a submitted message before loading optional project memory", () => {
  const submission = source(
    "src/components/workbench/use-conversation-submission.js",
  );
  const optimisticUpdate = submission.indexOf(
    "onChatTurnsChange([...requestBaseTurns, userTurn]);",
  );
  const memoryLoad = submission.indexOf("await getProjectMemory()");
  assert.notEqual(optimisticUpdate, -1);
  assert.notEqual(memoryLoad, -1);
  assert.ok(optimisticUpdate < memoryLoad);
});

test("does not replace a pending plan while the user is still revising it", () => {
  const submission = source(
    "src/components/workbench/use-conversation-submission.js",
  );
  assert.match(submission, /runtimeCommand\.decision === "revise"/);
  assert.match(submission, /!revisingPendingAction && shouldGenerateConversationPlan/);
});

test("keeps RightRail shared display primitives outside the root Workbench module", () => {
  const workbench = source("src/main.jsx");
  const rightRail = source("src/components/workbench/right-rail.jsx");
  const components = source(
    "src/components/workbench/right-rail-components.jsx",
  );
  const presentation = source("src/lib/task-presentation.js");
  assert.match(workbench, /import \{ RightRail \} from/);
  assert.match(rightRail, /import \{ RailDisclosure, GoalTaskItem, ProjectProfileItem \} from/);
  assert.equal(workbench.includes("function RailDisclosure"), false);
  assert.equal(workbench.includes("function GoalTaskItem"), false);
  assert.match(components, /export function RailDisclosure/);
  assert.match(components, /export function GoalTaskItem/);
  assert.match(components, /export function ProjectProfileItem/);
  assert.match(presentation, /export function taskGoalName/);
  assert.equal(components.includes("runtime-api"), false);
});

test("keeps RightRail goal and task projection in a pure view-model", () => {
  const workbench = source("src/main.jsx");
  const viewModel = source("src/lib/right-rail-view-model.js");
  const rightRail = source("src/components/workbench/right-rail.jsx");
  assert.match(workbench, /import \{ RightRail \} from/);
  assert.match(rightRail, /buildRightRailViewModel/);
  assert.equal(rightRail.includes("const activeGoalTaskIds"), false);
  assert.equal(rightRail.includes("const goalTodos ="), false);
  assert.match(viewModel, /export function buildRightRailViewModel/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("keeps App Workspace capability and Provider record actions in dedicated hooks", () => {
  const workbench = source("src/main.jsx");
  const capabilities = source(
    "src/components/workbench/use-workspace-capability-actions.js",
  );
  const providerRecord = source(
    "src/components/workbench/use-provider-test-record.js",
  );
  assert.match(workbench, /useWorkspaceCapabilityActions\(\{/);
  assert.match(workbench, /useProviderTestRecord\(\{/);
  assert.equal(
    workbench.includes(
      "await workspaceCapabilityClient.updateProjectCapability",
    ),
    false,
  );
  assert.equal(
    workbench.includes("setComposerModelTests\(\(current\) =>"),
    false,
  );
  assert.match(capabilities, /export function useWorkspaceCapabilityActions/);
  assert.match(providerRecord, /export function useProviderTestRecord/);
  assert.equal(capabilities.includes("runtime-api"), false);
  assert.equal(providerRecord.includes("runtime-api"), false);
});

test("keeps AgentWorkspace input and assistant action forwarding in a Conversation hook", () => {
  const workbench = source("src/main.jsx");
  const actions = source(
    "src/components/workbench/use-agent-workspace-input-actions.js",
  );
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
  const viewModel = source(
    "src/components/workbench/use-provider-composer-view-model.js",
  );
  assert.match(workbench, /useProviderComposerViewModel\(\{/);
  assert.equal(
    workbench.includes("const composerModelOptions = composerModels.length"),
    false,
  );
  assert.equal(
    workbench.includes("Object.fromEntries(\n    composerModelOptions.map"),
    false,
  );
  assert.match(viewModel, /export function useProviderComposerViewModel/);
  assert.match(viewModel, /composerModelAvailability/);
  assert.match(viewModel, /currentProviderHealth/);
  assert.equal(viewModel.includes("runtime-api"), false);
});

test("does not turn transient background probes into automatic Provider disconnects", () => {
  const actions = source("src/components/workbench/use-composer-model-actions.js");
  assert.equal(actions.includes("setInterval"), false);
  assert.match(actions, /if \(!composerModelTests\[key\]\?\.status\) void testComposerModel/);
});

test("keeps active Task projection inside the Task session boundary", () => {
  const workbench = source("src/main.jsx");
  const session = source("src/components/workbench/use-task-session.js");
  assert.match(workbench, /activeTaskId,\n    activeTask,/);
  assert.match(
    workbench,
    /<AgentWorkspace\n          snapshot=\{snapshot\}\n          activeTaskId=\{activeTaskId\}/,
  );
  assert.equal(
    workbench.includes(
      "const activeTask = tasks.find((task) => task.id === activeTaskId)",
    ),
    false,
  );
  assert.match(session, /const activeTask = tasks\.find/);
  assert.match(session, /activeTask,/);
});

test("injects goal creation into the AgentWorkspace task board boundary", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
  assert.match(workspace, /onCreateGoal,/);
  assert.match(
    workbench,
    /onCreateTask=\{createManualTask\}\n          onCreateGoal=\{createGoal\}/,
  );
});

test("keeps AgentWorkspace runtime selection injected from the App adapter boundary", () => {
  const workbench = source("src/main.jsx");
  const workspace = componentSource(workbench, "AgentWorkspace", "currentRuntimeSource");
  assert.match(workspace, /isTauri,\n/);
  assert.equal(workspace.includes("isTauriRuntime()"), false);
  assert.match(workbench, /isTauri=\{isTauriRuntime\(\)\}/);
});

test("routes every submitted attachment cleanup through the Conversation resource boundary", () => {
  const submission = source(
    "src/components/workbench/use-conversation-submission.js",
  );
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
  const persistence = source(
    "src/components/workbench/use-conversation-persistence.js",
  );
  const terminal = source("src/components/workbench/use-terminal-session.js");
  const patchActions = source("src/components/workbench/use-patch-actions.js");
  const executionActions = source("src/lib/execution-action-controller.js");
  const recorder = source("src/lib/performance-baseline.js");
  assert.match(workbench, /exposeDesktopPerformanceBaseline\(\)/);
  assert.match(workbench, /recordWorkbenchReady\(\)/);
  assert.match(tabs, /measureDesktopPerformance\("workspace-route"\)/);
  assert.match(
    persistence,
    /measureDesktopPerformance\("conversation-update"\)/,
  );
  assert.match(terminal, /measureDesktopPerformance\("terminal-output"\)/);
  assert.match(patchActions, /measureDesktopPerformance\("patch-draft"/);
  assert.match(patchActions, /measureDesktopPerformance\("patch-apply"/);
  assert.match(executionActions, /measureDesktopPerformance\("guarded-check"/);
  assert.match(recorder, /maxSamples: 60/);
  assert.doesNotMatch(recorder, /text:|attachments:|content:/);
});

test("keeps the style entrypoint as an ordered domain composition", () => {
  const entrypoint = source("src/styles.css");
  const theme = source("src/styles/theme.css");
  const workspace = source("src/styles/workspace.css");
  const conversation = source("src/styles/conversation.css");
  const terminal = source("src/styles/terminal.css");
  const providerRail = source("src/styles/provider-rail.css");
  assert.deepEqual(entrypoint.trim().split("\n"), [
    '@import "./styles/base.css";',
    '@import "./styles/theme.css";',
    '@import "./styles/workspace.css";',
    '@import "./styles/conversation.css";',
    '@import "./styles/terminal.css";',
    '@import "./styles/provider-rail.css";',
  ]);
  assert.match(theme, /--desktop-gray-950/);
  assert.match(workspace, /\.workspace \{/);
  assert.match(conversation, /\.conversation \{/);
  assert.match(terminal, /\.terminalDock \{/);
  assert.match(terminal, /\.goalStack \{/);
  assert.match(providerRail, /\.providerPanel \{/);
});

test("keeps pure chat routing outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const content = source("src-tauri/src/runtime/chat_content.rs");
  const stream = source("src-tauri/src/runtime/chat_stream.rs");
  const routing = source("src-tauri/src/runtime/chat_routing.rs");
  assert.doesNotMatch(app, /use crate::runtime::chat_routing/);
  assert.doesNotMatch(app, /fn is_task_like_message\(/);
  assert.match(content, /use crate::runtime::chat_routing/);
  assert.match(stream, /use crate::runtime::chat_routing/);
  assert.match(routing, /pub fn should_create_plan_for_message/);
  assert.match(routing, /#\[cfg\(test\)\]/);
});

test("keeps Provider chat transport and SSE result normalization outside Tauri commands", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const stream = source("src-tauri/src/runtime/chat_stream.rs");
  assert.doesNotMatch(app, /async fn generate_provider_chat\(/);
  assert.doesNotMatch(app, /consume_openai_sse_deltas/);
  assert.doesNotMatch(app, /streaming_reply_prefix/);
  assert.match(app, /generate_provider_chat, should_retry_provider_chat, ChatStreamError/);
  assert.match(stream, /pub async fn generate_provider_chat/);
  assert.match(stream, /post_streaming_chat_completion/);
  assert.match(stream, /FnMut\(String, usize\)/);
});

test("keeps native Provider Function Calling behind one capability owner", () => {
  const stream = source("src-tauri/src/runtime/chat_stream.rs");
  const tools = source("src-tauri/src/runtime/provider_tools.rs");
  const routing = source("src-tauri/src/runtime/chat_routing.rs");
  assert.match(stream, /use crate::runtime::provider_tools/);
  assert.match(stream, /ProviderToolMode::NativeFunctionCalling/);
  assert.match(tools, /pub fn provider_tool_mode/);
  assert.match(tools, /pub fn conversation_tool_definitions/);
  assert.match(tools, /additionalProperties/);
  assert.doesNotMatch(routing, /tool_choice|tool_calls|start_engineering_task/);
});

test("keeps ordinary chat deadlines in the Rust Runtime instead of a frontend wall-clock race", () => {
  const result = source("src/lib/conversation-chat-result.js");
  const requestState = source("src/components/workbench/use-conversation-request-state.js");
  const stream = source("src-tauri/src/runtime/chat_stream.rs");
  const app = source("src-tauri/src/runtime/app.rs");
  assert.doesNotMatch(result, /withTimeout|12000|Promise\.race/);
  assert.match(stream, /FIRST_RESPONSE_TIMEOUT/);
  assert.match(stream, /STREAM_IDLE_TIMEOUT/);
  assert.match(app, /Duration::from_secs\(300\)/);
  assert.match(app, /provider_status: "interrupted"/);
  assert.match(app, /provider_status: "timed-out"/);
  assert.match(requestState, /isRequestRunning\(activeRequestRef, payload\.requestId\)/);
});

test("keeps Provider status projection in the Provider runtime domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const provider = source("src-tauri/src/runtime/provider.rs");
  assert.match(app, /status as provider_status_projection/);
  assert.doesNotMatch(app, /struct ProviderProfileStatus/);
  assert.doesNotMatch(app, /fn provider_status_source\(/);
  assert.match(provider, /pub struct ProviderStatus/);
  assert.match(provider, /pub fn status<F>/);
  assert.match(provider, /pub fn status_source/);
  assert.match(provider, /status_projection_uses_credential_presence/);
});

test("keeps Provider profile mutation policy outside the Tauri command adapter", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const provider = source("src-tauri/src/runtime/provider.rs");
  assert.match(app, /profile_from_input\(/);
  assert.match(app, /save_provider_config_profile\(&existing, profile, input.enabled\)/);
  assert.match(app, /delete_provider_config_profile\(&existing, &input.profile_id\)/);
  assert.doesNotMatch(app, /每个连接必须使用独立的 Key 保存变量/);
  assert.doesNotMatch(app, /let profile_id = if input\.profile_id/);
  assert.match(provider, /pub fn profile_from_input/);
  assert.match(provider, /pub fn save_profile/);
  assert.match(provider, /pub fn delete_profile/);
  assert.match(provider, /profile_mutation_policy_keeps_keys_isolated/);
});

test("keeps Provider catalog probe transport outside the Tauri command adapter", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const provider = source("src-tauri/src/runtime/provider.rs");
  assert.match(app, /provider::probe_catalog_with_credential\(/);
  assert.doesNotMatch(app, /probe_model_catalog\(/);
  assert.doesNotMatch(app, /get_models\(api_base, &api_key, Duration::from_secs\(30\)\)/);
  assert.match(provider, /pub async fn probe_model_catalog/);
  assert.match(provider, /pub async fn probe_catalog_with_credential/);
  assert.match(provider, /model_catalog_probe_rejects_missing_connection_inputs/);
});

test("keeps Provider request preflight and failover in the Provider domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const provider = source("src-tauri/src/runtime/provider.rs");
  assert.match(app, /provider::prepare_for_request\(/);
  assert.match(app, /sync_hermes_runtime_config\(&result\.0\)/);
  assert.doesNotMatch(app, /ordered_profile_candidates\(configured\)/);
  assert.doesNotMatch(app, /fn record_provider_failure\(/);
  assert.doesNotMatch(app, /未找到可用 profile/);
  assert.match(provider, /pub async fn prepare_for_request/);
  assert.match(provider, /pub fn record_failure/);
  assert.match(provider, /preflight_switches_after_a_quota_failure_and_records_both_profiles/);
});

test("keeps Provider credential policy and Hermes config persistence outside Tauri commands", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const provider = source("src-tauri/src/runtime/provider.rs");
  assert.doesNotMatch(app, /API Key Env 只能使用大写字母/);
  assert.doesNotMatch(app, /async fn test_provider_config\(/);
  assert.doesNotMatch(app, /fn current_unix_timestamp\(/);
  assert.match(provider, /pub fn save_secret_and_enable/);
  assert.match(provider, /pub fn resolve_credential/);
  assert.match(provider, /pub async fn test_connection_with_credential/);
  assert.match(provider, /pub fn sync_hermes_runtime_config/);
});

test("keeps read-only planning outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const planning = source("src-tauri/src/runtime/planning.rs");
  const planCommand = app.slice(
    app.indexOf("async fn generate_readonly_plan("),
    app.indexOf("#[tauri::command]\nfn list_desktop_tasks"),
  );
  assert.match(app, /use crate::runtime::planning/);
  assert.match(app, /planning::generate_plan\(/);
  assert.doesNotMatch(app, /struct PlanContext/);
  assert.doesNotMatch(app, /fn build_local_readonly_plan\(/);
  assert.doesNotMatch(app, /fn generate_provider_plan\(/);
  assert.doesNotMatch(planCommand, /prepare_provider_for_request\(/);
  assert.doesNotMatch(planCommand, /record_failure\(/);
  assert.match(planning, /pub fn build_local_readonly_plan/);
  assert.match(planning, /pub async fn generate_plan/);
  assert.match(planning, /pub async fn generate_provider_plan/);
  assert.match(planning, /prepare_for_request\(/);
  assert.match(planning, /PROVIDER_FALLBACK/);
  assert.match(planning, /#\[cfg\(test\)\]/);
});

test("keeps image attachment input limits in the planning domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const planning = source("src-tauri/src/runtime/planning.rs");
  assert.match(app, /sanitize_image_attachments\(input\.attachments\)/);
  assert.equal(app.includes('mime_type.starts_with("image/")'), false);
  assert.equal(app.includes("4_000_000"), false);
  assert.match(planning, /pub fn sanitize_image_attachments/);
  assert.match(planning, /const MAX_IMAGE_ATTACHMENTS: usize = 4/);
  assert.match(planning, /const MAX_IMAGE_DATA_URL_BYTES: usize = 4_000_000/);
});

test("keeps the complete governed Patch Draft lifecycle in the Patch domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const patchDraft = source("src-tauri/src/runtime/patch_draft.rs");
  const draftCommand = app.slice(
    app.indexOf("async fn generate_patch_draft("),
    app.indexOf("#[tauri::command]\nfn apply_patch_draft"),
  );
  assert.match(app, /patch_draft::generate_draft\(/);
  assert.doesNotMatch(draftCommand, /prepare_provider_for_request\(/);
  assert.doesNotMatch(draftCommand, /generate_hermes_draft\(/);
  assert.doesNotMatch(draftCommand, /generate_provider_draft\(/);
  assert.doesNotMatch(draftCommand, /local_placeholder_draft\(/);
  assert.doesNotMatch(app, /fn generate_provider_patch_draft\(/);
  assert.doesNotMatch(app, /fn generate_hermes_structured_patch_draft\(/);
  assert.match(patchDraft, /pub async fn generate_draft\(/);
  assert.match(patchDraft, /pub async fn generate_provider_draft\(/);
  assert.match(patchDraft, /pub async fn generate_hermes_draft\(/);
  assert.match(patchDraft, /prepare_for_request\(/);
  assert.match(patchDraft, /DRAFT_RETRY/);
  assert.match(patchDraft, /HERMES_FALLBACK/);
  assert.match(patchDraft, /post_chat_completion\(/);
  assert.match(patchDraft, /normalize_hermes_unified_diff\(&draft\.diff, contexts\)/);
});

test("keeps local chat content outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const content = source("src-tauri/src/runtime/chat_content.rs");
  assert.match(app, /use crate::runtime::chat_content/);
  assert.doesNotMatch(app, /struct DialogueContextInput/);
  assert.doesNotMatch(app, /fn chat_reply_prompt\(/);
  assert.doesNotMatch(app, /fn local_chat_result\(/);
  assert.match(content, /pub fn chat_reply_prompt/);
  assert.doesNotMatch(content, /Return strict JSON only/);
  assert.match(content, /pub fn local_chat_result/);
  assert.match(content, /#\[cfg\(test\)\]/);
});

test("keeps accepted native Function Calls authoritative over compatibility keyword routing", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const chatCommand = app.slice(
    app.indexOf("async fn chat_with_model("),
    app.indexOf("#[tauri::command]\nfn cancel_runtime_request"),
  );
  assert.doesNotMatch(chatCommand, /should_create_plan_for_message/);
  assert.doesNotMatch(chatCommand, /result\.should_create_plan\s*=\s*false/);
});

test("keeps chat evidence projection outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const content = source("src-tauri/src/runtime/chat_content.rs");
  assert.doesNotMatch(app, /fn chat_project_evidence\(/);
  assert.doesNotMatch(app, /fn chat_references_for_message\(/);
  assert.doesNotMatch(app, /fn compact_json_items\(/);
  assert.match(content, /pub fn project_evidence/);
  assert.match(content, /pub fn references_for_message/);
});

test("keeps Workspace registry persistence outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const workspace = source("src-tauri/src/runtime/workspace.rs");
  assert.doesNotMatch(app, /fn load_or_seed_registry\(/);
  assert.doesNotMatch(app, /fn save_registry\(/);
  assert.doesNotMatch(app, /fn current_registry_project\(/);
  assert.doesNotMatch(app, /fn normalize_project_path\(/);
  assert.doesNotMatch(app, /fn project_id_from_path\(/);
  assert.doesNotMatch(app, /fn registry_projects\(/);
  assert.doesNotMatch(app, /fn project_task_summary\(/);
  assert.doesNotMatch(app, /fn project_health\(/);
  assert.match(workspace, /pub fn load_or_seed_registry/);
  assert.match(workspace, /pub fn save_registry/);
  assert.match(workspace, /pub fn current_registry_project/);
  assert.match(workspace, /pub fn normalize_project_path/);
  assert.match(workspace, /pub fn project_id_from_path/);
  assert.match(workspace, /pub fn registry_project_summaries/);
});

test("keeps Workspace registry mutations and path preview outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const workspace = source("src-tauri/src/runtime/workspace.rs");
  for (const helper of [
    "register_project",
    "preview_project_path",
    "switch_registry_project",
    "rename_registry_project",
    "relocate_registry_project",
    "remove_registry_project",
  ]) {
    assert.match(workspace, new RegExp(`pub fn ${helper}\\(`));
  }
  assert.match(app, /register_project\(&app_root, &mut registry, &input.path, &input.access_mode\)/);
  assert.match(app, /workspace::preview_project_path\(&input.path\)/);
  assert.match(app, /switch_workspace_project\(&app_root, &mut registry, &input.id\)/);
  assert.match(app, /rename_workspace_project\(&app_root, &mut registry, &input.id, &input.name\)/);
  assert.match(app, /relocate_workspace_project\(&app_root, &mut registry, &input.id, &input.path\)/);
  assert.match(app, /remove_workspace_project\(&app_root, &mut registry, &id\)/);
});

test("keeps Workspace facts projection outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const workspace = source("src-tauri/src/runtime/workspace.rs");
  assert.doesNotMatch(app, /fn build_workspace_facts_preview\(/);
  assert.match(workspace, /pub fn build_workspace_facts_preview/);
  assert.match(app, /workspace::build_workspace_facts_preview/);
});

test("keeps shared project name and stage projection in the Workspace domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const workspace = source("src-tauri/src/runtime/workspace.rs");
  assert.doesNotMatch(app, /let state = read_json\(root\.join\(STATE_PATH\)\);/);
  assert.match(app, /workspace::project_runtime_context\(&root, &current_project.name\)/);
  assert.match(workspace, /pub struct ProjectRuntimeContext/);
  assert.match(workspace, /pub fn project_runtime_context/);
});

test("keeps bounded engineering file previews in the Workspace domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const workspace = source("src-tauri/src/runtime/workspace.rs");
  assert.doesNotMatch(app, /struct EngineeringFilePreview/);
  assert.match(app, /workspace::read_engineering_file\(/);
  assert.match(workspace, /pub struct EngineeringFilePreview/);
  assert.match(workspace, /pub fn read_engineering_file/);
  assert.match(workspace, /MAX_PREVIEW_BYTES/);
});

test("keeps Workspace snapshot, queue, and run-record projection outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const workspace = source("src-tauri/src/runtime/workspace.rs");
  for (const helper of ["count_run_records", "recommendation_queue", "task_backlog_queue", "goal_stack_from_validation"]) {
    assert.doesNotMatch(app, new RegExp(`fn ${helper}\\(`));
  }
  assert.doesNotMatch(app, /struct WorkspaceSnapshot/);
  assert.match(app, /build_workspace_snapshot\(&root, &current_project, &registry\)/);
  assert.match(workspace, /pub fn count_run_records/);
  assert.match(workspace, /pub fn workspace_queue/);
  assert.match(workspace, /pub fn build_workspace_snapshot/);
  assert.match(workspace, /pub struct WorkspaceSnapshot/);
});

test("keeps terminal session, cache, and trace behavior outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const terminal = source("src-tauri/src/runtime/terminal.rs");
  assert.doesNotMatch(app, /native_pty_system/);
  assert.doesNotMatch(app, /fn normalized_session_id\(/);
  assert.doesNotMatch(app, /fn save_image\(/);
  assert.doesNotMatch(app, /fn record_native_trace\(/);
  assert.match(terminal, /pub fn start_session/);
  assert.match(terminal, /pub fn save_image/);
  assert.match(terminal, /pub fn record_native_trace/);
  assert.match(terminal, /#\[cfg\(test\)\]/);
});

test("keeps Workspace file watching outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const watcher = source("src-tauri/src/runtime/workspace_watcher.rs");
  assert.doesNotMatch(app, /struct WorkspaceWatcherState/);
  assert.doesNotMatch(app, /fn should_ignore_watch_path\(/);
  assert.doesNotMatch(app, /fn watch_event_should_refresh\(/);
  assert.match(app, /workspace_watcher::start\(app, state, PathBuf::from\(&current_project.path\)\)/);
  assert.match(watcher, /pub struct WorkspaceWatcherState/);
  assert.match(watcher, /pub fn should_ignore_path/);
  assert.match(watcher, /pub fn event_should_refresh/);
  assert.match(watcher, /workspace:\/\/files-changed/);
});

test("keeps Agent read-tool argument validation and dispatch in the Agent Tools domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const tools = source("src-tauri/src/runtime/agent_tools.rs");
  const hermesExecution = source(
    "src-tauri/src/runtime/hermes_execution.rs",
  );
  assert.doesNotMatch(app, /match input\.name\.trim\(\)/);
  assert.match(app, /agent_tools::execute_read_tool\(&root, &input.name, &input.arguments\)/);
  assert.doesNotMatch(app, /agent_tools::execute_hermes_read_tool\(root, name, &args\)/);
  assert.doesNotMatch(app, /fn hermes_read_tool_observation\(/);
  assert.match(tools, /pub fn execute_read_tool/);
  assert.match(tools, /pub fn execute_hermes_read_tool/);
  assert.match(tools, /Native Core 只接受已登记的只读 Agent Tool/);
  assert.match(hermesExecution, /execute_hermes_read_tool\(root, name, &args\)/);
});

test("keeps Hermes ACP child-process and structured-loop mechanics outside Tauri commands", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const hermesExecution = source(
    "src-tauri/src/runtime/hermes_execution.rs",
  );
  assert.match(app, /hermes_execution::\{run_structured_loop, HermesAgentLoopResult\}/);
  assert.match(app, /run_structured_loop\(/);
  assert.doesNotMatch(app, /fn run_hermes_acp_structured_loop\(/);
  assert.doesNotMatch(app, /fn run_hermes_acp_prompt\(/);
  assert.doesNotMatch(app, /fn generate_hermes_patch_draft\(/);
  assert.doesNotMatch(app, /HERMES_ACP: structured tool loop/);
  assert.match(hermesExecution, /pub fn run_structured_loop\(/);
  assert.match(hermesExecution, /Command::new\(program\)/);
  assert.match(hermesExecution, /execute_hermes_read_tool\(root, name, &args\)/);
  assert.match(hermesExecution, /validate_unified_diff_authorized/);
});

test("keeps Agent Run model-stage persistence outside the Hermes command adapter", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const runs = source("src-tauri/src/runtime/agent_runs.rs");
  const hermesCommand = app.slice(
    app.indexOf("async fn run_hermes_agent("),
    app.indexOf("#[tauri::command]\nfn get_provider_status"),
  );
  assert.match(app, /agent_runs::prepare_model_run\(/);
  assert.match(app, /agent_runs::settle_model_run\(/);
  assert.doesNotMatch(app, /Hermes 正在读取上下文并形成结果/);
  assert.doesNotMatch(app, /OmniDesk 已执行上一受控工具，结果如下/);
  assert.doesNotMatch(hermesCommand, /resume-approval/);
  assert.doesNotMatch(hermesCommand, /checkpoint\.next_action/);
  assert.match(runs, /pub fn prepare_model_run/);
  assert.match(runs, /pub fn settle_model_run/);
  assert.match(runs, /Agent Run 不属于当前项目，拒绝继续/);
  assert.match(runs, /Hermes 开始生成受控草稿/);
  assert.match(runs, /resume-approval/);
});

test("keeps goal identifier normalization in the Goals domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const goals = source("src-tauri/src/runtime/goals.rs");
  assert.doesNotMatch(app, /fn goal_id_from_title\(/);
  assert.match(app, /goals::id_from_title\(input.title.trim\(\), &now\)/);
  assert.match(goals, /pub fn id_from_title/);
});

test("keeps guarded check execution and audit evidence in the Execution domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const execution = source("src-tauri/src/runtime/execution.rs");
  assert.doesNotMatch(app, /struct GuardedCheckResult/);
  assert.match(app, /execution::run_guarded_check\(/);
  assert.match(execution, /pub struct GuardedCheckResult/);
  assert.match(execution, /pub fn run_guarded_check/);
  assert.match(execution, /append_audit\(/);
});

test("keeps approved Patch Apply validation, Git execution, and evidence in the Execution domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const execution = source("src-tauri/src/runtime/execution.rs");
  const applyCommand = app.slice(
    app.indexOf("fn apply_patch_draft("),
    app.indexOf("fn write_run_summary("),
  );
  assert.match(applyCommand, /execution::apply_patch_draft\(&root, &draft/);
  assert.doesNotMatch(applyCommand, /validate_apply_diff_paths\(diff\)/);
  assert.doesNotMatch(applyCommand, /validate_unified_diff_authorized\(diff/);
  assert.doesNotMatch(applyCommand, /run_git_apply\(root, diff/);
  assert.match(execution, /pub struct ApplyPatchResult/);
  assert.match(execution, /pub fn apply_patch_draft/);
  assert.match(execution, /validate_apply_diff_paths\(diff\)/);
  assert.match(execution, /validate_unified_diff_authorized\(diff, &allowed_files\)/);
  assert.match(execution, /run_git_apply\(root, diff, true\)/);
  assert.match(execution, /append_audit\(\s*root,\s*"patch-apply"/);
});

test("keeps goal-validation suite composition in the Goals domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const goals = source("src-tauri/src/runtime/goals.rs");
  const execution = source("src-tauri/src/runtime/execution.rs");
  assert.doesNotMatch(app, /let check_ids = \["web-build", "cargo-check", "runtime"\]/);
  assert.match(app, /goals::run_validation\(/);
  assert.match(goals, /pub fn run_validation/);
  assert.match(goals, /execute_guarded_check\(root, check_id\)/);
  assert.match(execution, /pub\(crate\) fn execute_guarded_check/);
});

test("keeps native recovery fixture construction in the Agent Run domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const runs = source("src-tauri/src/runtime/agent_runs.rs");
  assert.doesNotMatch(app, /Native WebDriver multi-file recovery fixture created/);
  assert.match(app, /agent_runs::seed_native_recovery_run\(&app_root, project.id, &timestamp\)/);
  assert.match(runs, /pub fn seed_native_recovery_run/);
  assert.match(runs, /"native-recovery-approval"/);
  assert.match(runs, /"docs\/TESTING\.md"/);
  assert.match(runs, /Do not execute tools/);
});

test("keeps approved-tool state transitions in the Agent Run domain", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const runs = source("src-tauri/src/runtime/agent_runs.rs");
  const execution = source("src-tauri/src/runtime/execution.rs");
  assert.match(app, /execution::execute_approved_agent_tool\(/);
  for (const transition of [
    "begin_approved_tool",
    "settle_approved_tool",
    "fail_approved_tool",
  ]) {
    assert.doesNotMatch(app, new RegExp(`agent_runs::${transition}\\(`));
    assert.match(execution, new RegExp(`agent_runs::${transition}\\(`));
    assert.match(runs, new RegExp(`pub fn ${transition}\\(`));
  }
  for (const ownedState of [
    "正在执行已批准工具",
    "已批准工具执行失败",
    "resume-apply-approval",
    "resume-check-approval",
    "tool-failed",
    "checkpoint.tool_result = Some",
  ]) {
    assert.equal(app.includes(ownedState), false);
  }
});

test("keeps system application launches and clipboard access outside the Tauri command assembly", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const integration = source("src-tauri/src/runtime/system_integration.rs");
  assert.doesNotMatch(app, /Command::new\("explorer"/);
  assert.doesNotMatch(app, /Command::new\("pbcopy"/);
  assert.match(app, /system_integration::open_project_folder/);
  assert.match(app, /system_integration::open_native_terminal/);
  assert.match(app, /system_integration::copy_text_to_clipboard/);
  assert.match(integration, /pub fn open_project_folder/);
  assert.match(integration, /pub fn open_native_terminal/);
  assert.match(integration, /pub fn copy_text_to_clipboard/);
  assert.match(integration, /fn require_directory/);
});

test("keeps state transaction recovery and namespace activation together", () => {
  const app = source("src-tauri/src/runtime/app.rs");
  const namespace = source("src-tauri/src/runtime/state_namespace.rs");
  assert.doesNotMatch(app, /fn recover_and_activate_runtime_state\(/);
  assert.doesNotMatch(app, /ensure_active_state_namespace\(root\)/);
  assert.match(app, /state_namespace::recover_and_activate_runtime_state/);
  assert.match(namespace, /pub fn recover_and_activate_runtime_state/);
  assert.match(namespace, /recover_incomplete_transactions\(\)\?/);
});

test("keeps task workflow presentation helpers outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const presentation = source("src/lib/task-workflow-presentation.js");
  assert.doesNotMatch(workbench, /function taskStatusLabel\(/);
  assert.doesNotMatch(workbench, /function checksForPlan\(/);
  assert.match(workbench, /task-workflow-presentation/);
  assert.match(presentation, /export function taskStatusLabel/);
  assert.match(presentation, /export function checksForPlan/);
});

test("keeps workflow status and verification semantics in one shared projection", () => {
  const workflow = source("src/lib/workflow-state.js");
  const taskBoard = source("src/lib/task-board-view-model.js");
  const taskExecution = source("src/lib/task-execution-mode.js");
  const conversation = source("src/components/workbench/conversation-transcript.jsx");
  const agentEvents = source("src/agent-runtime/events.js");
  const userForm = source("src/components/workbench/agent-user-form-card.jsx");
  const resultDialog = source("src/components/workbench/task-action-dialog.jsx");
  for (const consumer of [taskBoard, taskExecution, conversation, agentEvents, userForm, resultDialog]) {
    assert.match(consumer, /workflow-state/);
  }
  assert.match(workflow, /export function taskHasVerificationEvidence/);
  assert.match(workflow, /export function taskHasPassedVerification/);
  assert.doesNotMatch(taskBoard, /verificationSummary/);
  assert.doesNotMatch(taskExecution, /verificationSummary/);
  assert.doesNotMatch(conversation, />验收通过</);
});

test("keeps current-goal rendering and decomposition dialog outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const panel = source("src/components/workbench/current-goal-panel.jsx");
  assert.match(engineeringFile, /import \{ CurrentGoalPanel \} from "\.\/current-goal-panel"/);
  assert.doesNotMatch(workbench, /function currentGoalNextAction\(/);
  assert.doesNotMatch(workbench, /function CurrentGoalPanel\(/);
  assert.match(panel, /export function CurrentGoalPanel/);
  assert.match(panel, /resolveWorkspaceGoal/);
  assert.equal(panel.includes("runtime-api"), false);
});

test("keeps goal validation and local-state presentation outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const engineeringFile = source("src/components/workbench/engineering-file-tab.jsx");
  const panels = source(
    "src/components/workbench/goal-validation-panels.jsx",
  );
  for (const name of [
    "AcceptanceCriteriaPanel",
    "GoalHistoryPanel",
    "ValidationReportPanel",
    "RunRecordsPanel",
    "LocalProjectStatePanel",
    "RuleSourceButtons",
  ]) {
    assert.match(engineeringFile, new RegExp(`<${name}`));
    assert.doesNotMatch(workbench, new RegExp(`function ${name}\\(`));
    assert.match(panels, new RegExp(`export function ${name}`));
  }
  assert.match(panels, /resolveWorkspaceGoal/);
  assert.match(panels, /displayStateRelativePath/);
  assert.equal(panels.includes("runtime-api"), false);
  assert.equal(panels.includes("desktop-task-client"), false);
});

test("keeps preview chat projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const projection = source("src/lib/preview-chat-projection.js");
  assert.doesNotMatch(workbench, /function previewChatResult\(/);
  assert.doesNotMatch(workbench, /function loadingLabelForMessageKind\(/);
  assert.doesNotMatch(workbench, /function loadingEventsForMessageKind\(/);
  assert.doesNotMatch(workbench, /function localStatusReply\(/);
  assert.doesNotMatch(workbench, /function conversationDiagnosticForResult\(/);
  assert.match(workbench, /preview-chat-projection/);
  assert.match(projection, /export function previewChatResult/);
  assert.match(projection, /export function loadingEventsForMessageKind/);
  assert.match(projection, /export function agentEventsForMessageKind/);
  assert.match(projection, /export function localStatusReply/);
  assert.match(projection, /export function conversationDiagnosticForResult/);
  assert.equal(projection.includes("runtime-api"), false);
});

test("keeps provider model presentation outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const presentation = source("src/lib/provider-presentation.js");
  for (const helper of ["compactModelLabel", "providerModelKey", "modelAvailabilityKey", "providerModelHealth", "catalogModelsForProvider"]) {
    assert.doesNotMatch(workbench, new RegExp(`function ${helper}\\(`));
    assert.match(presentation, new RegExp(`export function ${helper}`));
  }
  assert.equal(presentation.includes("runtime-api"), false);
});

test("keeps conversation list preview projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const list = source("src/lib/conversation-list.js");
  assert.doesNotMatch(workbench, /function visibleConversationPreview\(/);
  assert.doesNotMatch(workbench, /function isLowSignalConversationText\(/);
  assert.match(workbench, /visibleConversationPreview/);
  assert.match(list, /export function visibleConversationPreview/);
  assert.match(list, /export function isLowSignalConversationText/);
  assert.equal(list.includes("runtime-api"), false);
});

test("keeps goal and task projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const presentation = source("src/lib/goal-presentation.js");
  for (const helper of ["goalStatusLabel", "goalValidationStatusFromActiveGoal", "goalMetaFromStatus", "goalStatusLabelText", "compactGoalTitle", "progressFromTodos", "taskDisplayStatus", "snapshotQueueTodos", "projectProfileItems", "taskSubtasks"]) {
    assert.doesNotMatch(workbench, new RegExp(`function ${helper}\\(`));
    assert.match(presentation, new RegExp(`export function ${helper}`));
  }
  assert.equal(presentation.includes("runtime-api"), false);
});

test("keeps workspace tab projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const presentation = source("src/lib/workspace-tab-presentation.js");
  for (const helper of ["workspaceFileTabId", "workspaceFileTabTitle", "topicPayloadFromOutline"]) {
    assert.doesNotMatch(workbench, new RegExp(`function ${helper}\\(`));
    assert.match(presentation, new RegExp(`export function ${helper}`));
  }
  assert.equal(presentation.includes("runtime-api"), false);
});

test("keeps governance presentation outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const presentation = source("src/lib/governance-presentation.js");
  for (const helper of ["statusLabel", "actionLabel", "governanceFileStatusLabel", "governanceFileHealthLabel", "governanceFileHealthSummary", "governanceStatusSummaryText"]) {
    assert.doesNotMatch(workbench, new RegExp(`function ${helper}\\(`));
    assert.match(presentation, new RegExp(`export function ${helper}`));
  }
  assert.equal(presentation.includes("runtime-api"), false);
});

test("keeps Preview project profile projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const previewClient = source("src/lib/workspace-preview-client.js");
  const presentation = source("src/lib/project-profile-presentation.js");
  assert.doesNotMatch(workbench, /function profileFieldText\(/);
  assert.doesNotMatch(workbench, /function previewProjectProfile\(/);
  assert.doesNotMatch(workbench, /project-profile-presentation/);
  assert.match(previewClient, /from "\.\/project-profile-presentation\.js"/);
  assert.match(previewClient, /previewProjectProfile\(/);
  assert.match(presentation, /export function profileFieldText/);
  assert.match(presentation, /export function previewProjectProfile/);
  assert.equal(presentation.includes("runtime-api"), false);
});

test("keeps task record creation outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const factory = source("src/lib/task-record-factory.js");
  assert.doesNotMatch(workbench, /function createTaskFromPlan\(/);
  assert.match(workbench, /task-record-factory/);
  assert.match(factory, /export function createTaskFromPlan/);
  assert.equal(factory.includes("runtime-api"), false);
});

test("keeps Preview planning projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const projection = source("src/lib/preview-chat-projection.js");
  assert.doesNotMatch(workbench, /function buildPreviewPlan\(/);
  assert.match(workbench, /buildPreviewPlan/);
  assert.match(projection, /export function buildPreviewPlan/);
  assert.equal(projection.includes("runtime-api"), false);
});

test("keeps conversation message projection outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const projection = source("src/lib/conversation-message-projection.js");
  for (const helper of ["isActionRequestMessage", "actionPromptsForMessage", "profilePatchesFromMessage"]) {
    assert.doesNotMatch(workbench, new RegExp(`function ${helper}\\(`));
    assert.match(projection, new RegExp(`export function ${helper}`));
  }
  assert.equal(projection.includes("runtime-api"), false);
});

test("keeps Workspace refresh-failure persistence outside the Workbench entrypoint", () => {
  const workbench = source("src/main.jsx");
  const store = source("src/lib/workspace-fact-refresh-store.js");
  const facts = source("src/components/workbench/workspace-facts-preview.jsx");
  assert.doesNotMatch(workbench, /function factRefreshFailureStorageKey\(/);
  assert.match(facts, /workspace-fact-refresh-store/);
  assert.match(store, /export function writeFactRefreshFailure/);
});

test("keeps the Workbench capability catalog and topic surfaces outside the entrypoint", () => {
  const workbench = source("src/main.jsx");
  const catalog = source("src/lib/workbench-catalog.js");
  assert.match(workbench, /workbench-catalog/);
  assert.doesNotMatch(workbench, /const dedicatedSurfaceByTopic/);
  assert.doesNotMatch(workbench, /const capabilityLabels/);
  assert.match(catalog, /export const dedicatedSurfaceByTopic/);
  assert.match(catalog, /export const capabilityLabels/);
  assert.match(catalog, /export const chatStarterPrompts/);
  assert.equal(catalog.includes("runtime-api"), false);
});

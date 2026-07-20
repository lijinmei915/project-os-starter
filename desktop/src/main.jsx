import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { open as openTauriDialog } from "@tauri-apps/plugin-dialog";
import { Activity, AlertTriangle, ArrowLeftRight, ArrowRight, ArrowUpDown, Bot, Brain, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardList, Clock3, Copy, Eraser, ExternalLink, FileText, Filter, Loader2, MessageSquare, MoreVertical, Package, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Play, Plus, RotateCcw, Server, ShieldAlert, ShieldCheck, Square, TerminalSquare, X } from "lucide-react";
import { ChatDock } from "./components/workbench/chat-dock";
import { AppWorkbenchSurface } from "./components/workbench/app-workbench-surface";
import { GoalStatusIcon, GoalTaskItem, ProjectProfileItem, RailDisclosure } from "./components/workbench/right-rail-components";
import { ActiveTask } from "./components/workbench/active-task";
import { AgentWorkspaceConversationCanvas } from "./components/workbench/agent-workspace-conversation-canvas";
import { AgentWorkspaceAuxiliaryTabs } from "./components/workbench/agent-workspace-auxiliary-tabs";
import { PatchDraft, ReadonlyPlan } from "./components/workbench/plan-views";
import { AgentProcessingStatus } from "./components/workbench/conversation";
import { ConversationHistoryItem } from "./components/workbench/conversation-history-item";
import { groupConversations } from "./lib/conversation-list";
import { ComponentGovernancePanel } from "./components/workbench/component-governance-panel";
import { ProviderPanel } from "./components/workbench/provider-panel";
import { ProjectOverviewHeader, ProjectOverviewSectionSlot, ProjectOverviewSlotRenderer } from "./components/workbench/project-overview-renderer";
import { TopBar } from "./components/workbench/top-bar";
import { StatusBar } from "./components/workbench/status-bar";
import { TaskCard } from "./components/workbench/task-card";
import { TaskConversationContext } from "./components/workbench/task-conversation-context";
import { TaskQueueItem, TaskRailDetail } from "./components/workbench/task-rail";
import { useAgentTopicTaskBoard } from "./components/workbench/use-agent-topic-task-board";
import { useAgentTopicTaskActions } from "./components/workbench/use-agent-topic-task-actions";
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
import { TokenGovernancePanel } from "./components/workbench/token-governance-panel";
import { AgentTopicPanelContent } from "./components/workbench/agent-topic-panel-content";
import { AgentConfigSurfacePanel } from "./components/workbench/agent-config-surface-panel";
import { ReadonlyFilePreview } from "./components/workbench/readonly-file-preview";
import { EngineeringTopicFrame } from "./components/workbench/engineering-topic-frame";
import { EngineeringTopicSurfaceComposer } from "./components/workbench/engineering-topic-surface-composer";
import { AssetSurfacePanel, GovernanceSurfacePanel, MemorySurfacePanel } from "./components/workbench/workspace-static-surfaces";
import { WorkspaceTree } from "./components/workbench/workspace-tree";
import { ProjectFileTree } from "./components/workbench/project-file-tree";
import { ProjectCapabilityDialog } from "./components/workbench/project-capability-dialog";
import { useProjectSidebarState } from "./components/workbench/use-project-sidebar-state";
import { useSidebarLayout } from "./components/workbench/use-sidebar-layout";
import { useProjectPathCopy } from "./components/workbench/use-project-path-copy";
import { useWorkspaceCapabilityActions } from "./components/workbench/use-workspace-capability-actions";
import { useProviderTestRecord } from "./components/workbench/use-provider-test-record";
import { useAgentWorkspaceInputActions } from "./components/workbench/use-agent-workspace-input-actions";
import { useProviderComposerViewModel } from "./components/workbench/use-provider-composer-view-model";
import { WorkspaceTabStrip } from "./components/workbench/workspace-tab-strip";
import { OverviewPageHeader, OverviewSection, OverviewTagList } from "./components/workbench/overview-section";
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
import { projectGovernanceOutline, workspaceOutlineForCapabilities } from "./workspace-outline";
import { workspaceRouteById } from "./workspace-route-registry";
import { collapseDuplicateOpenTasks, taskGoalName, taskProgressSummary, taskUpdatedLabel } from "./lib/task-presentation";
import { stageGoalCandidateFromMessage } from "./lib/stage-goal-candidate";
import { resolvedStageGoalTurn } from "./lib/stage-goal-turn";
import { assistantUiPocEnabled } from "./lib/assistant-ui-adapter";
import { groupTasksByGoal, sortTasksForGoal } from "./lib/task-goal-groups";
import { buildAgentWorkspaceViewModel } from "./lib/agent-workspace-view-model";
import * as providerClient from "./lib/provider-client";
import { activeProviderProfileName } from "./lib/provider-presentation";
import { taskConversationAction, taskNextAction } from "./lib/task-next-action";
import { taskContinuationPrompt } from "./lib/task-conversation-prompt";
import { taskCardPrimaryAction } from "./lib/task-card-action";
import { discoverableProjectCapabilities, projectRuntimeStatus } from "./lib/project-sidebar-view-model";
import { buildAgentTopicViewModel, canPreviewAgentTopicFile } from "./lib/agent-topic-view-model";
import { displayStateRelativePath } from "./lib/state-namespace";
import { applyPendingConversationPatch } from "./lib/conversation-patch-apply";
import { createProviderActionController } from "./lib/provider-action-controller";
import { createConversationActionController } from "./lib/conversation-action-controller";
import { createTaskLifecycleController } from "./lib/task-lifecycle-controller";
import { createExecutionActionController } from "./lib/execution-action-controller";
import { createWorkspaceRegistryActions } from "./lib/workspace-registry-actions";
import { createWorkspaceFileActions } from "./lib/workspace-file-actions";
import { resolveEngineeringTopicSurface } from "./lib/engineering-topic-surface";
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
import { actionFromAssistantCommitment, actionFromAssistantRecommendation, buildChatRequestContext, buildConversationRecord, contextualizeUserMessage, isDialogueActionRequest, mergeConversationRecords } from "./lib/conversation-record";
import { taskIdForRequest } from "./lib/request-lifecycle";
import { resolveWorkspaceContext, resolveWorkspaceGoal } from "./lib/workspace-context";
import { conversationStates, executeRegisteredConversationAction, guardedCheckCapabilities, guardedCheckCapability, migrateConversationRecord, normalizeConversationReferences, normalizeConversationTurns, planProgressEvents, projectExecutionEvent, recoverConversationRuntime } from "./conversation-runtime";
import { buildProjectFactStore, diffProjectFactStores } from "./fact-store";
import { createProjectOverviewSlotRuntime } from "./project-overview-slot-runtime";
import { capabilityManifestSignature } from "./capability-policy";
import { exposeDesktopPerformanceBaseline, recordWorkbenchReady } from "./lib/performance-baseline";
import projectOverviewContract from "../../schemas/project-overview-contract.v0.1.json";
import projectRunbookContract from "../../schemas/project-runbook-contract.v0.1.json";
import { compileRunbookSlots } from "./runbook-slot-runtime";
import projectProgressContract from "../../schemas/project-progress-contract.v0.1.json";
import { compileCurrentProgressSlots } from "./current-progress-slot-runtime";
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

const fallbackSnapshot = {
  projectName: "project-os-starter",
  projectCapabilities: { capabilities: [] },
  currentProjectId: "current",
  currentProjectPath: "/Users/heqiao/Desktop/Claude练习/project-starter-pack",
  phase: "stabilizing",
  stage: "Project OS Console 内核收口期 / Desktop v0.1 方向确认期",
  fileCount: 0,
  docsCount: 0,
  recommendationCount: 0,
  runCount: 0,
  projects: [
    {
      id: "current",
      name: "project-os-starter",
      path: "/Users/heqiao/Desktop/Claude练习/project-starter-pack",
      phase: "stabilizing",
      isCurrent: true,
    },
  ],
  tree: [
    { label: "project-os-starter", depth: 0, kind: "folder" },
    { label: "docs", depth: 1, kind: "folder" },
    { label: "ARCHITECTURE.md", depth: 2, kind: "file" },
    { label: "desktop", depth: 1, kind: "folder" },
    { label: "main.jsx", depth: 2, kind: "file" },
    { label: "PROJECT.md", depth: 1, kind: "file" },
    { label: "HANDOFF.md", depth: 1, kind: "file" },
  ],
  queue: [
    {
      title: "打磨输入区和生成状态体验",
      status: "planned",
      body: "发送、停止、继续补充、语音和附件状态统一。",
      tone: "accent",
    },
    {
      title: "优化执行反馈和阶段状态",
      status: "planned",
      body: "把正在思考拆成理解、计划、改动、检查、整理结果。",
      tone: "accent",
    },
    {
      title: "梳理右侧目标任务项目档案结构",
      status: "planned",
      body: "目标、任务、对话、项目档案分清楚，减少重复。",
      tone: "accent",
    },
    {
      title: "优化多 API 配置和新建状态",
      status: "planned",
      body: "区分新建、编辑、已保存和启用，必填项更清楚。",
      tone: "neutral",
    },
    {
      title: "提升桌面应用完整感",
      status: "planned",
      body: "统一名称、图标、启动、版本和服务状态。",
      tone: "neutral",
    },
    {
      title: "打通治理文件和项目体验",
      status: "planned",
      body: "从文档和对话动态维护项目档案、目标、任务和上下文。",
      tone: "neutral",
    },
  ],
  memory: [
    {
      marker: "Δ",
      title: "已学习方向",
      body: "用户希望 Project OS 成为长期使用的本地 AI 工作台。",
      muted: false,
    },
    {
      marker: "Σ",
      title: "知识扩展",
      body: "桌面端采用 Tauri + Local Agent Core，不复制完整 IDE。",
      muted: true,
    },
  ],
  projectProfile: {
    intro: "",
    longTermGoal: "",
    targetUsers: "",
    useCases: "",
    userPreferences: "",
    missingFields: ["项目简介", "长期目标", "目标用户", "使用场景", "用户偏好"],
  },
  workspaceFacts: null,
  trace: [
    "BOOT: browser preview fallback.",
    "INDEX: waiting for Tauri Local Agent Core.",
    "GUARD: write actions require diff review.",
  ],
  goalValidation: {
    criteria: [],
  },
  goalValidationReport: {
    status: "missing",
    checks: [],
  },
  goalSignoffHistory: {
    entries: [],
  },
  goals: {
    schemaVersion: "project-os.goals.v0.1",
    activeGoalId: "desktop-v0.1-direction-confirmation",
    goals: [
      {
        id: "desktop-v0.1-direction-confirmation",
        title: "Project OS Console 内核收口期 / Desktop v0.1 方向确认期",
        projectName: "project-os-starter",
        status: "done",
        validationStatus: "passed",
        summary: "Desktop v0.1 目标验收已通过并确认完成。",
        taskIds: [],
      },
    ],
  },
};

const fallbackPlan = null;

const taskStatuses = {
  planned: "planned",
  waitingApproval: "waiting approval",
  repairPending: "repair pending",
  waitingRepairApproval: "waiting repair approval",
  repairFailed: "repair failed",
  running: "running",
  done: "done",
  failed: "failed",
};

function buildPreviewPlan(input, snapshot) {
  const task = safeDisplayText(input?.task, "未命名任务").trim() || "未命名任务";
  return {
    task,
    projectName: snapshot.projectName,
    mode: "plan",
    summary: `我会先围绕「${task}」理清范围，再给出最小下一步。`,
    steps: [
      "确认用户真正想解决的问题。",
      "读取当前项目状态和交接记录。",
      "列出最小可执行改动和风险。",
      "用户确认后再进入具体改动和检查。",
    ],
    filesToRead: ["PROJECT.md", "HANDOFF.md", "AGENTS.md"],
    candidateChanges: ["先不写文件，只形成下一步建议。"],
    checks: ["npm --prefix desktop test"],
    guardrails: ["不自动写文件。", "不自动运行命令。"],
    trace: ["PREVIEW: browser-only local plan."],
  };
}

const fallbackProvider = {
  provider: "openai-compatible",
  model: "gpt-5.4-mini",
  apiBase: "https://api.openai.com/v1",
  apiKeyEnv: "OPENAI_API_KEY",
  enabled: false,
  hasApiKey: false,
  activeProfileId: "",
  profiles: [],
};

const planCards = [
  {
    title: "优化界面",
    body: "把某个页面、按钮或配置流程改得更小白。",
  },
  {
    title: "新增功能",
    body: "描述你想加的能力，我会先给计划和改动预览。",
  },
  {
    title: "修复问题",
    body: "贴现象或截图，我会帮你定位并生成修改建议。",
  },
];

const fallbackModelCatalog = {
  schemaVersion: "project-os.model-catalog.v0.1",
  providers: [
  {
    id: "openai",
    label: "OpenAI",
    note: "OpenAI 官方账号",
    website: "https://platform.openai.com",
    provider: "openai-compatible",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1-mini"],
    apiBase: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    note: "DeepSeek 官方账号",
    website: "https://platform.deepseek.com",
    provider: "openai-compatible",
    models: ["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    apiBase: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  {
    id: "qwen",
    label: "Qwen",
    note: "阿里百炼 / DashScope",
    website: "https://dashscope.aliyun.com",
    provider: "openai-compatible",
    models: ["qwen3.7-max", "qwen3.7-plus", "qwen3.6-flash", "qwen-plus"],
    apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
  },
  {
    id: "gateway",
    label: "Gateway",
    note: "公司或团队统一中转",
    website: "https://your-gateway.example",
    provider: "openai-compatible",
    models: ["your-model"],
    apiBase: "https://your-gateway.example/v1",
    apiKeyEnv: "LLM_GATEWAY_API_KEY",
  },
  ],
};

async function loadWorkspaceSnapshot() {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/workspace-snapshot");
    if (response.ok) return response.json();
    return loadPreviewWorkspaceSnapshot();
  }

  return tauriInvoke("get_workspace_snapshot");
}

async function refreshWorkspaceFactsPreview() {
  if (!isTauriRuntime()) {
    const snapshot = await loadWorkspaceSnapshot();
    const report = snapshot?.workspaceFacts || null;
    return report ? { ...report, generatedAt: new Date().toISOString() } : report;
  }

  return tauriInvoke("refresh_workspace_facts_preview");
}

function factRefreshFailureStorageKey(projectKey) {
  return `project-os:fact-refresh-failure:${encodeURIComponent(projectKey || "current-project")}`;
}

function readFactRefreshFailure(projectKey) {
  try {
    return JSON.parse(window.localStorage.getItem(factRefreshFailureStorageKey(projectKey)) || "null");
  } catch {
    return null;
  }
}

function writeFactRefreshFailure(projectKey, failure) {
  try {
    const previous = readFactRefreshFailure(projectKey);
    window.localStorage.setItem(factRefreshFailureStorageKey(projectKey), JSON.stringify({
      ...failure,
      attemptedAt: new Date().toISOString(),
      retryCount: previous?.signature === failure.signature ? Number(previous.retryCount || 0) + 1 : 1,
    }));
  } catch {
    // Refresh recovery remains available for this session when storage is unavailable.
  }
}

function clearFactRefreshFailure(projectKey) {
  try {
    window.localStorage.removeItem(factRefreshFailureStorageKey(projectKey));
  } catch {
    // Storage cleanup failure must not turn a successful refresh into an error.
  }
}

async function createWorkspaceGoal(input) {
  return workspaceGoalClient.createWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

async function updateWorkspaceGoal(input) {
  return workspaceGoalClient.updateWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

async function archiveWorkspaceGoal(id) {
  return workspaceGoalClient.archiveWorkspaceGoal({ id, loadWorkspaceSnapshot });
}

async function restoreWorkspaceGoal(id) {
  return workspaceGoalClient.restoreWorkspaceGoal({ id, loadWorkspaceSnapshot });
}

async function mergeWorkspaceGoal(sourceId, targetId) {
  return workspaceGoalClient.mergeWorkspaceGoal({ sourceId, targetId, loadWorkspaceSnapshot });
}

async function switchWorkspaceGoal(input) {
  return workspaceGoalClient.switchWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

async function confirmWorkspaceGoal(input) {
  return workspaceGoalClient.confirmWorkspaceGoal({ input, loadWorkspaceSnapshot });
}

async function confirmGoalDecomposition(input) {
  return workspaceGoalClient.confirmGoalDecomposition({ input, loadWorkspaceSnapshot });
}

async function copyTextToSystemClipboard(text) {
  const canUseDevClipboard =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

  if (!canUseDevClipboard && isTauriRuntime()) {
    await tauriInvoke("copy_text_to_clipboard", { text });
    return { ok: true };
  }

  const response = await fetch("/__project-os/copy-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "复制失败。");
  }
  return payload;
}

async function loadPreviewWorkspaceSnapshot() {
  try {
    const response = await fetch("/__project-os/workspace-snapshot");
    if (response.ok) {
      return {
        ...fallbackSnapshot,
        ...(await response.json()),
      };
    }
  } catch {
    // Older dev servers fall back to static preview files.
  }
  const backlog = await loadPreviewJson("/.project-os/task-backlog.json", {
    items: fallbackSnapshot.queue,
  });
  const goalValidation = await loadPreviewJson("/.project-os/goal-validation.json", {
    criteria: [],
  });
  const goalValidationReport = await loadPreviewJson("/.project-os/goal-validation-report.json", {
    status: "missing",
    checks: [],
  });
  const goalSignoffHistory = await loadPreviewJson("/.project-os/goal-signoff-history.json", {
    entries: [],
  });
  const goals = await loadPreviewJson("/.project-os/goals.json", fallbackSnapshot.goals);
  const registry = await loadPreviewJson("/.project-os/desktop-registry.json", {
    currentProjectId: fallbackSnapshot.currentProjectId,
    projects: fallbackSnapshot.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      phase: project.phase,
    })),
  });
  const registryProjects = Array.isArray(registry.projects) ? registry.projects : [];
  const currentProject = registryProjects.find((project) => project.id === registry.currentProjectId) || registryProjects[0] || fallbackSnapshot.projects[0];
  const projectProfileFile = await loadPreviewJson("/.project-os/project-profile.json", null);
  const projectProfile = previewProjectProfile(projectProfileFile);
  const workspaceFacts = await loadPreviewJson("/.project-os/workspace-facts.json", null);
  const projectCapabilities = await loadPreviewJson("/.project-os/project-capabilities.json", { capabilities: [] });
  const queue = Array.isArray(backlog.items) && backlog.items.length
    ? backlog.items.map((item) => ({
        id: item.id,
        title: item.title || "未命名任务",
        status: item.status || taskStatuses.planned,
        body: item.body || "",
        goalId: item.goalId || "",
        tone: item.tone || "neutral",
      }))
    : fallbackSnapshot.queue;
  return {
    ...fallbackSnapshot,
    currentProjectId: currentProject?.id || fallbackSnapshot.currentProjectId,
    currentProjectPath: currentProject?.path || fallbackSnapshot.currentProjectPath,
    projectName: currentProject?.name || fallbackSnapshot.projectName,
    phase: currentProject?.phase || fallbackSnapshot.phase,
    projects: registryProjects.length ? registryProjects.map((project) => ({
      id: project.id,
      isCurrent: project.id === (currentProject?.id || registry.currentProjectId),
      name: project.name,
      path: project.path,
      phase: project.phase || "stabilizing",
      accessMode: project.accessMode || "browse",
    })) : fallbackSnapshot.projects,
    queue,
    goalValidation,
    goalValidationReport,
    goalSignoffHistory,
    goals,
    projectProfile,
    workspaceFacts,
    projectCapabilities,
  };
}

function profileFieldText(profile, key) {
  const value = profile?.fields?.[key]?.value;
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  if (typeof value === "string") return value.trim();
  return "";
}

function previewProjectProfile(profile) {
  if (!profile?.fields) return fallbackSnapshot.projectProfile;
  const overview = profileFieldText(profile, "identity.summary") || profileFieldText(profile, "identity.uniqueDescription");
  const next = {
    overview,
    phaseSummary: profileFieldText(profile, "identity.lifecycle"),
    architectureSummary: profileFieldText(profile, "engineering.architecture"),
    checkCommands: profileFieldText(profile, "engineering.testing"),
    collaborationRules: profileFieldText(profile, "governance.permissions") || profileFieldText(profile, "user.communicationStyle"),
    intro: overview,
    longTermGoal: profileFieldText(profile, "product.longTermGoal"),
    targetUsers: profileFieldText(profile, "product.targetUsers"),
    useCases: profileFieldText(profile, "product.useCases"),
    userPreferences: profileFieldText(profile, "user.globalPreferences") || profileFieldText(profile, "user.communicationStyle"),
  };
  const missingFields = [
    ["项目概览", next.overview],
    ["当前阶段", next.phaseSummary],
    ["技术架构", next.architectureSummary],
    ["检查命令", next.checkCommands],
    ["协作规则", next.collaborationRules],
  ].filter(([, value]) => !value).map(([label]) => label);
  return { ...next, missingFields };
}

async function loadPreviewJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return { ...fallback, ...(await response.json()) };
  } catch {
    return fallback;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function pickProjectDirectory() {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式暂不支持系统目录选择器");
  }

  return openTauriDialog({
    directory: true,
    multiple: false,
    title: "新建或选择要加入 OmniDesk 的项目目录",
  });
}

const capabilityLabels = {
  goals: "目标管理",
  rules: "工作规则",
  "design-implementation": "设计实现",
  "validation-delivery": "验证交付",
  "knowledge-memory": "知识记忆",
  "agent-configuration": "Agent 配置",
};

const capabilityDescriptions = {
  goals: "管理项目目标、验收标准和历史记录。",
  rules: "维护 AI 协作、权限和文档规则。",
  "design-implementation": "组织架构、数据契约、界面规范和实现结构。",
  "validation-delivery": "管理检查项、验收报告和运行记录。",
  "knowledge-memory": "沉淀项目事实、偏好、决策和会话摘要。",
  "agent-configuration": "配置模型连接、工具白名单和技能。",
};
const workspaceModuleLabels = {
  "system-architecture": "系统架构", "data-contracts": "数据契约", "ui-standards": "界面规范", "code-structure": "实现结构",
  "validation-checks": "检查项", "validation-report": "验收报告", "run-records": "运行记录",
  "model-connections": "模型连接", "tool-allowlist": "工具白名单", "security-boundary": "安全边界", "project-runbook": "启动方式"
};
const dedicatedSurfaceByTopic = Object.freeze({
  "acceptance-criteria": "acceptance-criteria",
  "collaboration-boundary": "collaboration-boundary",
  "current-goal": "current-goal",
  "documentation-rules": "documentation-rules",
  "execution-permissions": "execution-permissions",
  "goal-history": "goal-history",
  "system-architecture": "system-architecture",
  "data-contracts": "data-contracts",
  "code-structure": "code-structure",
  "validation-checks": "validation-checks",
  "validation-report": "validation-report",
  "run-records": "run-records",
  "handoff-records": "handoff-records",
  "decision-records": "decision-records",
  "lessons-learned": "lessons-learned",
  "task-list": "task-execution", "execution-terminal": "task-execution", "execution-results": "task-execution",
  "project-facts": "memory-surface", "user-preferences": "memory-surface", "long-term-memory": "memory-surface", "conversation-summary": "memory-surface",
  "engineering-files": "asset-surface", "governance-files": "asset-surface", "report-artifacts": "asset-surface", "schema-assets": "asset-surface",
  "model-connections": "agent-config-surface", "tool-allowlist": "agent-config-surface", "security-boundary": "agent-config-surface",
  "project-progress": "current-progress",
  "project-risks": "risk-boundary",
  "project-runbook": "runbook",
  "local-project-state": "local-project-state",
});

function ProjectSidebar({ collapsed, copyTextToSystemClipboard, onResizeStart, onToggleCollapsed, snapshot, tasks = [], projectActivities = {}, planLoading, terminalRunningId, onSwitchProject, onPickProject, onOpenProjectFolder, onRelocateProject, onRenameProject, onRemoveProject, onSelectEngineeringFile, onUpdateCapability, onProjectActionError, onProjectActivitySeen, onProjectPathCopied, projectActionError, selectedEngineeringFile }) {
  const {
    accessDialogOpen, accessSettingsProject, capabilityDialogOpen, capabilityLoadingId, confirmControlledProjectAccess, confirmProjectAccess, connectedProjectAccess, controlledConfirmOpen, dismissCapability, enableCapability, openExistingProject, openProjectAccessSettings,
    fileTreeExpanded, openRenameDialog, projectsOpen, renameName, renameProject,
    projectScan, revokeProjectWriteAccess, scanDetailsOpen, selectedProjectAccessMode, selectedModulesByCapability, setAccessSettingsProject, setCapabilityDialogOpen, setFileTreeExpanded, setProjectAccessDialogOpen,
    setControlledConfirmOpen, setScanDetailsOpen, setSelectedProjectAccessMode,
    setName, setProjectsOpen, setRenameProject, setSidebarView, setSelectedModulesByCapability,
    sidebarView, startProjectAccess, submitRename, changeProjectAccess,
  } = useProjectSidebarState({ onPickProject, onPreviewProject: workspaceRegistryClient.previewWorkspaceProject, onRenameProject, onSwitchProject, onUpdateCapability, projects: snapshot.projects });

  useProjectPathCopy({ copyTextToSystemClipboard, onProjectActionError, onProjectPathCopied });

  useEffect(() => {
    window.addEventListener("project-os:request-project-access", startProjectAccess);
    return () => window.removeEventListener("project-os:request-project-access", startProjectAccess);
  }, [startProjectAccess]);

  const projectStatus = (project) => projectRuntimeStatus(project, { planLoading, projectActivities, taskStatuses, tasks, terminalRunningId });
  const discoverableCapabilities = discoverableProjectCapabilities(snapshot, capabilityLabels);
  const recommendationCount = discoverableCapabilities.filter((capability) => capability.status !== "available").length;

  if (collapsed) {
    return (
      <aside className="left left-collapsed" aria-label="左侧工作区已折叠">
        <div className="collapsedRail">
          <Tooltip content="项目">
            <button className="collapsedRailItem active" type="button" onClick={onToggleCollapsed} aria-label="项目">
              <Package strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="项目流程">
            <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label="项目流程">
              <ClipboardList strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="记忆">
            <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label="记忆">
              <Brain strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="展开工作区">
            <Button className="railToggleButton sideCornerButton" size="icon" variant="ghost" type="button" onClick={onToggleCollapsed} aria-label="展开工作区">
              <PanelLeftOpen strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="left">
      <div className="leftScroll">
        <button
          className={`uiSectionTitle leftRailSection workbenchRootLink${selectedEngineeringFile?.path === "workbench-overview" ? " active" : ""}`}
          type="button"
          onClick={() => onSelectEngineeringFile?.({
            description: "跨项目状态与下一步入口。",
            group: "工作台",
            id: "workbench-overview",
            path: "workbench-overview",
            title: "工作台",
            virtual: true,
          })}
        >
          <Activity strokeWidth={1.8} aria-hidden="true" />
          <span>工作台</span>
        </button>
        <SectionGroup
          className="leftRailSection projectRailSection"
            title="项目"
            meta={snapshot.projects.length}
            open={projectsOpen}
            onToggle={() => setProjectsOpen((value) => !value)}
            toggleLabel={projectsOpen ? "收起项目" : "展开项目"}
            actions={(
              <Tooltip content="添加项目">
                <button className="sectionIconAction projectAddHeaderButton" type="button" onClick={startProjectAccess} aria-label="添加项目">
                  <Plus strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          >
            <div className="projectList" aria-label="已接入项目">
              {snapshot.projects.map((project) => (
                <div className="projectRowWrap" key={project.id}>
                  <button
                    className={`projectRow${project.isCurrent ? " active" : ""}`}
                    type="button"
                    onClick={() => {
                      onProjectActivitySeen?.(project.id);
                      onSwitchProject(project.id);
                    }}
                    aria-label={`切换到项目 ${project.name}`}
                    aria-current={project.isCurrent ? "true" : undefined}
                  >
                    {(() => {
                      const runtimeStatus = projectStatus(project);
                      return runtimeStatus.tone ? (
                        <span
                          className={`projectStatusDot projectStatusDot-${runtimeStatus.tone}`}
                          title={runtimeStatus.label}
                          aria-label={runtimeStatus.label}
                        />
                      ) : <span className="projectStatusDot projectStatusDot-empty" aria-hidden="true" />;
                    })()}
                    <span className="projectRowText">
                      <strong title={project.name}>{project.name}</strong>
                      <span title={project.path}>{project.path}</span>
                    </span>
                  </button>
                  <div className="projectRowActions" role="group" aria-label={`${project.name} 项目操作`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="projectMenuButton" type="button" aria-label={`项目菜单：${project.name}`}>
                          <MoreVertical strokeWidth={2.25} aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => onOpenProjectFolder(project.id)}>查看本地文件</DropdownMenuItem>
                        <button className="uiDropdownItem" type="button" data-copy-project-path={project.path}>
                          复制路径
                        </button>
                        <DropdownMenuItem onSelect={() => onRelocateProject(project.id)}>重新定位路径</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openRenameDialog(project)}>修改显示名称</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openProjectAccessSettings(project)}>接入权限</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="dangerMenuItem" onSelect={() => onRemoveProject(project.id)}>
                          从工作台移除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          {projectActionError ? <div className="projectError">{projectActionError}</div> : null}
        </SectionGroup>
        <Dialog open={Boolean(renameProject)} onOpenChange={(open) => {
          if (!open) {
            setRenameProject(null);
            setName("");
          }
        }}>
          <DialogContent
            title="修改显示名称"
            description="这里只修改 OmniDesk 工作台里的显示名称，不会重命名本地文件夹。"
          >
            <form className="projectRenameForm" onSubmit={submitRename}>
              <Field label="项目名称" htmlFor="project-rename-input">
                <Input
                  autoFocus
                  id="project-rename-input"
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="输入项目名称"
                  value={renameName}
                />
              </Field>
              <div className="projectRenameActions">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">取消</Button>
                </DialogClose>
                <Button disabled={!renameName.trim()} type="submit" variant="primary">保存</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={accessDialogOpen} onOpenChange={setProjectAccessDialogOpen}>
          <DialogContent title={connectedProjectAccess ? "项目已接入" : projectScan?.existingProject ? `“${projectScan.project?.name || "项目"}”已接入` : projectScan?.project?.name ? `接入“${projectScan.project.name}”` : "接入项目"} description={connectedProjectAccess ? `“${connectedProjectAccess.name}”已成为当前项目。` : projectScan?.existingProject ? `当前权限：${projectScan.existingProject.accessMode === "controlled" ? "允许受控修改" : projectScan.existingProject.accessMode === "governed" ? "接入治理" : "仅浏览"}。` : "请选择接入权限。"}>
            {connectedProjectAccess ? <div className="projectConnectedResult"><div className="projectAccessSettingsSummary"><strong>{connectedProjectAccess.accessMode === "controlled" ? "允许受控修改" : connectedProjectAccess.accessMode === "governed" ? "接入治理" : "仅浏览"}</strong><span>{connectedProjectAccess.accessMode === "controlled" ? "确认后可修改工程文件并运行验证。" : connectedProjectAccess.accessMode === "governed" ? "可写入项目治理记录，不修改工程文件。" : "只读取、扫描并生成建议。"}</span></div><div className="projectConnectedActions"><Button onClick={() => { setProjectAccessDialogOpen(false); onSelectEngineeringFile?.({ description: "项目名称、用途和阶段。", group: "项目流程", id: "project-identity", path: "project-identity", title: "项目概览", virtual: true }); }} type="button" variant="primary">查看项目概览</Button><Button onClick={() => { setProjectAccessDialogOpen(false); window.dispatchEvent(new Event("project-os:open-conversation")); }} type="button" variant="outline">发起项目讨论</Button></div></div> : <>
            {projectScan?.loading ? <Notice variant="muted">正在检查项目。</Notice> : projectScan?.error ? <Notice variant="danger">{projectScan.error}</Notice> : projectScan ? <div className="projectScanResult"><div className="projectScanConclusion"><strong>检查完成</strong><span>请选择接入权限。</span></div></div> : null}
            {projectScan?.existingProject ? null : <fieldset className="projectAccessFieldset" disabled={projectScan?.loading || Boolean(projectScan?.error) || !projectScan}>
              <legend>选择接入权限</legend>
              <div className="projectAccessChoices" role="group" aria-label="选择接入权限">
                {[['browse', '仅浏览', '只读取、扫描并生成建议。'], ['governed', '接入治理', '允许写入项目治理记录。'], ['controlled', '允许受控修改', '每次确认后修改工程文件并运行验证。']].map(([mode, title, description]) => <button aria-pressed={selectedProjectAccessMode === mode} className={`projectAccessChoice${selectedProjectAccessMode === mode ? " selected" : ""}`} key={mode} onClick={() => setSelectedProjectAccessMode(mode)} type="button"><span className="projectAccessChoiceTitle">{title}</span><small>{description}</small></button>)}
              </div>
            </fieldset>}
            <div className="projectAccessActions">
              <DialogClose asChild><Button type="button" variant="ghost">取消</Button></DialogClose>
              {projectScan?.existingProject ? <Button onClick={openExistingProject} type="button" variant="primary">{projectScan.existingProject.isCurrent ? "继续使用此项目" : "切换到此项目"}</Button> : <Button disabled={projectScan?.loading || Boolean(projectScan?.error) || !projectScan} onClick={() => selectedProjectAccessMode === "controlled" ? setControlledConfirmOpen(true) : confirmProjectAccess(selectedProjectAccessMode)} type="button" variant="primary">{selectedProjectAccessMode === "browse" ? "以仅浏览方式接入" : selectedProjectAccessMode === "governed" ? "接入并管理记录" : "接入并允许受控修改"}</Button>}
            </div>
            </>}
          </DialogContent>
        </Dialog>
        <Dialog open={controlledConfirmOpen} onOpenChange={setControlledConfirmOpen}>
          <DialogContent title="允许受控修改？" description="之后每次修改工程文件前都会展示变更，并等待你的确认。">
            <Notice variant="info">这项权限允许应用已确认的文件修改并运行验证；不会自动提交或发布。</Notice>
            <div className="projectRenameActions">
              <DialogClose asChild><Button type="button" variant="ghost">返回</Button></DialogClose>
              <Button onClick={confirmControlledProjectAccess} type="button" variant="primary">确认并接入</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(accessSettingsProject)} onOpenChange={(open) => { if (!open) setAccessSettingsProject(null); }}>
          <DialogContent title="接入权限" description={accessSettingsProject ? `“${accessSettingsProject.name}”当前允许的操作范围。` : "查看项目接入权限。"}>
            {accessSettingsProject ? <div className="projectAccessSettingsSummary"><strong>{accessSettingsProject.accessMode === "controlled" ? "允许受控修改" : accessSettingsProject.accessMode === "governed" ? "接入治理" : "仅浏览"}</strong><span>{accessSettingsProject.accessMode === "controlled" ? "确认后可修改工程文件并运行验证。" : accessSettingsProject.accessMode === "governed" ? "可写入项目治理记录，不修改工程文件。" : "只读取、扫描并生成建议。"}</span></div> : null}
            <div className="projectRenameActions">
              <DialogClose asChild><Button type="button" variant="ghost">关闭</Button></DialogClose>
              {accessSettingsProject ? <>
                {accessSettingsProject.accessMode !== "browse" ? <Button onClick={() => changeProjectAccess("browse")} type="button" variant="outline">改为仅浏览</Button> : null}
                {accessSettingsProject.accessMode !== "governed" ? <Button onClick={() => changeProjectAccess("governed")} type="button" variant="outline">改为接入治理</Button> : null}
                {accessSettingsProject.accessMode !== "controlled" ? <Button onClick={() => changeProjectAccess("controlled")} type="button" variant="outline">允许受控修改</Button> : null}
              </> : null}
            </div>
          </DialogContent>
        </Dialog>

        {sidebarView === "workspace" ? (
          <>
            <WorkspaceTree
            actions={(
              <Tooltip content={recommendationCount ? `更多能力，${recommendationCount} 项建议` : "更多能力"}>
                <Button className="sectionIconAction" size="icon" variant="ghost" type="button" onClick={() => setCapabilityDialogOpen(true)} aria-label="更多能力">
                  <Plus aria-hidden="true" size={15} />
                </Button>
              </Tooltip>
            )}
            inlineAction={(
              <Tooltip content="切换到项目文件">
                <button
                  className="sectionInlineSwitch"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSidebarView("files");
                  }}
                  aria-label="切换到项目文件"
                >
                  <ArrowLeftRight strokeWidth={1.5} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
            activeTopicPath={selectedEngineeringFile?.path}
            onSelectTopic={onSelectEngineeringFile}
            outline={workspaceOutlineForCapabilities(
              projectGovernanceOutline
                .filter((node) => node.id !== "workbench-overview")
                .map((node) => node.id === "project-governance"
                  ? { ...node, children: (node.children || []).filter((child) => child.id !== "define-goal") }
                  : node),
              snapshot?.projectCapabilities,
            )}
            sectionTitle="工作区"
            snapshot={snapshot}
            />
            <ProjectCapabilityDialog
              capabilities={discoverableCapabilities}
              descriptions={capabilityDescriptions}
              labels={capabilityLabels}
              loadingId={capabilityLoadingId}
              moduleLabels={workspaceModuleLabels}
              onDismiss={dismissCapability}
              onEnable={enableCapability}
              onOpenChange={setCapabilityDialogOpen}
              onSelectedModulesChange={(capabilityId, candidates, checked, moduleId) => setSelectedModulesByCapability((current) => ({
                ...current,
                [capabilityId]: checked ? [...new Set([...(current[capabilityId] || candidates), moduleId])] : (current[capabilityId] || candidates).filter((id) => id !== moduleId),
              }))}
              open={capabilityDialogOpen}
              selectedModulesByCapability={selectedModulesByCapability}
              snapshot={snapshot}
            />
          </>
        ) : (
          <SectionGroup
              className="leftRailSection"
              title="项目文件"
              open
              onToggle={() => setSidebarView("workspace")}
              inlineAction={(
                <Tooltip content="切换到工作区">
                  <button
                    className="sectionInlineSwitch"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSidebarView("workspace");
                    }}
                    aria-label="切换到工作区"
                  >
                    <ArrowLeftRight strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </Tooltip>
              )}
              actions={(
                <Tooltip content={fileTreeExpanded ? "收起全部子项" : "展开全部子项"}>
                  <Button
                    className="sectionIconAction"
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => setFileTreeExpanded((value) => !value)}
                    aria-label={fileTreeExpanded ? "收起全部子项" : "展开全部子项"}
                  >
                    {fileTreeExpanded
                      ? <ChevronsDownUp strokeWidth={1.75} aria-hidden="true" />
                      : <ChevronsUpDown strokeWidth={1.75} aria-hidden="true" />}
                  </Button>
                </Tooltip>
              )}
              toggleLabel="切换到工作区"
            >
            <ProjectFileTree
              activePath={selectedEngineeringFile?.path}
              expanded={fileTreeExpanded}
              snapshot={snapshot}
              onSelectFile={onSelectEngineeringFile}
            />
          </SectionGroup>
        )}
      </div>
      <Tooltip content="折叠工作区">
        <Button className="sideCornerButton sideCornerButton-left" size="icon" variant="ghost" type="button" onClick={onToggleCollapsed} aria-label="折叠工作区">
          <PanelLeftClose strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>
      <div className="sidebarResizer sidebarResizer-left" role="separator" aria-label="拖拽调整左侧宽度" onPointerDown={onResizeStart} />
    </aside>
  );
}

function createTaskFromPlan(plan, taskText, snapshot, options = {}) {
  const title = taskText?.trim() || plan?.summary || "未命名任务";
  const activeGoal = activeGoalFromSnapshot(snapshot);
  const fallbackId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const id = taskIdForRequest(options.requestId, fallbackId);

  return {
    id,
    title: title.length > 48 ? `${title.slice(0, 48)}...` : title,
    status: taskStatuses.planned,
    createdAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    projectId: snapshot.currentProjectId || "",
    conversationId: options.conversationId || "",
    requestId: options.requestId || "",
    requestTrace: options.requestId ? {
      outcome: "pending",
      requestId: options.requestId,
      startedAt: options.startedAt || new Date().toISOString(),
      taskId: id,
    } : null,
    goalId: activeGoal?.id || "",
    goalTitle: activeGoal?.shortTitle || activeGoal?.title || "",
    projectName: snapshot.projectName,
    projectPath: snapshot.currentProjectPath || "",
    plan,
    runs: [],
  };
}

function taskStatusLabel(status) {
  return {
    [taskStatuses.planned]: "待确认",
    [taskStatuses.waitingApproval]: "已确认",
    [taskStatuses.running]: "进行中",
    [taskStatuses.done]: "已完成",
    [taskStatuses.failed]: "失败",
    [taskStatuses.repairPending]: "待修复",
    [taskStatuses.waitingRepairApproval]: "待确认修复",
    [taskStatuses.repairFailed]: "修复失败",
  }[status] || status || "待确认";
}

function checksForPlan(plan) {
  const checks = Array.isArray(plan?.checks) ? plan.checks : [];
  return guardedCheckCapabilities.filter((check) =>
    checks.some((item) => item.includes(check.command) || item.includes(check.id) || item.includes(check.label))
  );
}

function previewChatResult(message, hasAttachments, snapshot = {}, tasks = [], dialogueContext = {}) {
  const normalized = message.trim().replace(/[。！？!?,，\s]/g, "").toLowerCase();
  const lowerMessage = message.toLowerCase();
  const explicitTask = [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
    "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
    "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
    "直接修", "直接改", "直接做", "你来处理", "你自己处理",
  ].some((keyword) => lowerMessage.includes(keyword));
  const greeting = ["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(normalized);
  const questionLike = [
    "为什么", "怎么", "哪些", "还有哪些", "是什么", "吗", "呢", "看一下", "看看",
    "检查当前项目还有哪些风险", "有哪些风险",
  ].some((keyword) => message.includes(keyword));
  const shouldCreatePlan = explicitTask || (hasAttachments && !questionLike);
  const currentTopic = dialogueContext?.currentTopic || message;
  const riskLike = message.includes("风险") || lowerMessage.includes("risk") || currentTopic.includes("风险");
  const statusLike = /状态|进度|下一步|总结|概况|现在/.test(message);
  const developLike = /开发|改代码|实现|任务|执行|patch|检查|构建|验证/.test(lowerMessage);
  const visibleTasks = Array.isArray(tasks) ? tasks.filter((task) => !isNoiseTask(task)) : [];
  const activeTasks = visibleTasks.filter((task) => ![taskStatuses.done, taskStatuses.failed].includes(task.status));
  const failedTasks = visibleTasks.filter((task) => task.status === taskStatuses.failed);
  const doneTasks = visibleTasks.filter((task) => task.status === taskStatuses.done);
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const validationStatus = snapshot?.goalValidationReport?.status || "待生成";
  const changedFiles = snapshot?.workspaceFacts?.git?.changedFiles || snapshot?.git?.changedFiles || [];
  const projectName = snapshot?.projectName || snapshot?.workspaceFacts?.project?.name || "当前项目";
  const phase = phaseLabel(snapshot?.phase || snapshot?.workspaceFacts?.project?.lifecycle || "stabilizing");
  const currentFocus = activeTasks[0]?.title || activeGoal?.shortTitle || activeGoal?.title || "把工作台能力继续接到真实项目治理闭环";
  const nextAction = failedTasks.length
    ? `优先处理 ${failedTasks.length} 个失败任务，再继续推进当前开发任务。`
    : activeTasks.length
      ? `先推进「${activeTasks[0].title}」，完成后运行基础检查。`
      : "先从当前目标创建一个小任务，再进入 Patch、验证和交接闭环。";
  const statusReply = `${projectName} 处在「${phase}」阶段，当前焦点是「${currentFocus}」；下一步建议：${nextAction}`;
  const developReply = `开发流程建议按四步走：先把需求生成任务计划，再看 Patch 草案，确认后应用改动，最后运行检查并沉淀交接。当前任务 ${visibleTasks.length} 个，已完成 ${doneTasks.length} 个，验收状态为 ${validationStatus}。`;
  const followUpReply = dialogueContext?.expectedNextAction === "recommend-next"
    ? `建议按这个顺序处理：先推进「${currentFocus}」；然后运行目标验收并处理失败项；最后审阅剩余 Git 变更，确认是否可以交付。`
    : dialogueContext?.expectedNextAction === "decide-next"
      ? `我判断先推进「${currentFocus}」。它是当前最直接的阻塞点，完成后立即运行目标验收，再决定是否处理其他风险。`
      : "";
  const references = riskLike
    ? [
      { kind: "file", label: "项目状态", target: "PROJECT.md" },
      { kind: "file", label: "任务清单", target: ".project-os/task-backlog.json" },
    ]
    : statusLike
      ? [
        { kind: "file", label: "项目状态", target: "PROJECT.md" },
        { kind: "file", label: "当前交接", target: "HANDOFF.md" },
      ]
      : developLike
        ? [{ kind: "file", label: "任务清单", target: ".project-os/task-backlog.json" }]
        : [];
  return {
    intent: shouldCreatePlan ? "task" : questionLike ? "question" : "chat",
    reply: shouldCreatePlan
      ? "可以，我整理成一个可执行计划。"
      : followUpReply
        ? followUpReply
      : greeting
        ? "你好，我在。"
        : riskLike
          ? `当前可确认的风险有三项：还有 ${activeTasks.length} 个活跃或待确认任务；Git 工作区有 ${changedFiles.length} 个变更文件；目标验收状态为 ${validationStatus}。建议先处理失败或进行中的任务，再运行目标验收，最后确认剩余 Git 变更是否属于本轮交付。`
          : statusLike
            ? statusReply
            : developLike
              ? developReply
              : "我可以直接回答项目问题；如果你说“帮我改/实现/优化”，我会先生成任务计划，再进入受控开发流程。",
    references,
    shouldCreatePlan,
  };
}

function loadingLabelForMessageKind(kind) {
  return {
    "connection-status": "检查连接状态",
    "model-status": "读取模型状态",
    "project-inspect": "检查项目风险",
    "project-status": "整理项目状态",
    question: "组织回答",
    "stage-goal": "识别阶段目标",
    chat: "组织回答",
    task: "整理计划",
  }[kind] || "组织回答";
}

function loadingEventsForMessageKind(kind) {
  if (kind === "project-inspect") {
    return [
      { label: "读取项目状态", status: "current" },
      { label: "检查风险线索", status: "pending" },
      { label: "汇总回答", status: "pending" },
    ];
  }
  if (kind === "project-status") {
    return [
      { label: "读取项目状态", status: "current" },
      { label: "整理进度", status: "pending" },
    ];
  }
  if (kind === "model-status" || kind === "connection-status") {
    return [
      { label: "读取连接配置", status: "current" },
      { label: "查看健康状态", status: "pending" },
    ];
  }
  if (kind === "task") {
    return planProgressEvents("understand");
  }
  return [
    { label: "读取上下文", status: "current" },
    { label: "组织回答", status: "pending" },
  ];
}

function agentEventsForMessageKind(kind, chatResult) {
  const events = [];
  if (kind === "project-inspect") {
    events.push(createAgentEvent("context", "done", "读取项目状态", "已结合当前项目阶段、目标、任务和治理记录。"));
    events.push(createAgentEvent("check", "done", "检查风险线索", "优先查看交接膨胀、执行状态、模型连接和验证反馈。"));
    events.push(createAgentEvent("result", "done", "汇总风险回答", "已把结果整理成可读回复。"));
  } else if (kind === "project-status") {
    events.push(createAgentEvent("context", "done", "读取项目状态", "已读取当前项目、目标、任务和验收状态。"));
    events.push(createAgentEvent("result", "done", "整理项目状态", "已生成当前状态摘要。"));
  } else if (kind === "model-status") {
    events.push(createAgentEvent("context", "done", "读取模型配置", "已读取当前连接、模型名称和健康状态。"));
  } else if (kind === "connection-status") {
    events.push(createAgentEvent("context", "done", "读取连接状态", "已读取当前模型连接健康状态。"));
  } else if (kind === "question" || kind === "chat") {
    events.push(createAgentEvent("thinking", "done", "组织回答", "已按当前对话上下文生成回复。"));
  }
  if (chatResult?.providerStatus && chatResult.providerStatus !== "available") {
    events.push(createAgentEvent("error", "failed", "模型连接未接通", chatResult.providerError || "Provider 暂时不可用，已切换为本地上下文回复。"));
  }
  return events;
}

function localStatusReply({ kind, provider, providerHealth, snapshot, tasks }) {
  const modelName = provider?.model || "未选择模型";
  const connectionName = activeProviderProfileName(provider) || "当前连接";
  const healthStatus = providerHealth?.status || "unknown";
  if (kind === "model-status") {
    if (!provider?.enabled) return `当前没有启用模型连接。已配置模型是 ${modelName}，但对话会先使用本地项目上下文。`;
    if (healthStatus === "available") return `当前使用的模型是 ${modelName}，连接为「${connectionName}」，状态可用。`;
    if (healthStatus === "quota-exhausted") return `当前连接「${connectionName}」额度不足，系统会尝试已保存的其它可用连接；暂时无法切换时我会先用本地上下文回答。`;
    if (healthStatus === "authentication-failed") return `当前连接「${connectionName}」认证失败，请检查 Key；我会先用本地上下文回答。`;
    if (healthStatus === "model-unavailable") return `当前连接「${connectionName}」不支持模型 ${modelName}，请切换模型或连接。`;
    if (healthStatus === "network-unavailable") return `当前连接「${connectionName}」网络暂时不可用，我会先用本地上下文回答。`;
    if (healthStatus === "unavailable") return `当前配置的模型是 ${modelName}，连接为「${connectionName}」，但刚才检测不可用。我会先用本地上下文回答。`;
    return `当前配置的模型是 ${modelName}，连接为「${connectionName}」。可用性还在检测中，我会先按本地上下文回答。`;
  }
  if (kind === "connection-status") {
    if (healthStatus === "available") return `模型连接现在是可用状态：${modelName}。`;
    if (healthStatus === "quota-exhausted") return `模型连接额度不足：${modelName}。系统会尝试已保存的可用连接。`;
    if (healthStatus === "authentication-failed") return `模型连接认证失败：${modelName}。请检查当前连接的 Key。`;
    if (healthStatus === "model-unavailable") return `当前连接不支持模型：${modelName}。请切换模型或连接。`;
    if (healthStatus === "network-unavailable") return `模型连接网络异常：${modelName}。恢复前会继续使用本地上下文。`;
    if (healthStatus === "unavailable") return `模型连接还没恢复：${modelName} 当前不可用。你可以刷新模型连接；在此之前我会继续用本地上下文回答。`;
    return `我不能直接判断整台机器的网络，但当前模型连接还没有明确可用结果。你可以刷新顶部连接状态，或继续问项目问题。`;
  }
  return previewChatResult("", false, snapshot, tasks).reply;
}

function conversationDiagnosticForResult(chatResult, providerHealth) {
  if (!chatResult?.providerStatus || chatResult.providerStatus === "available") return null;
  return {
    label: "模型连接未接通",
    message: "当前回复使用本地上下文生成。可在顶部连接状态里刷新模型，或继续直接提问。",
    detail: chatResult.providerError || providerHealth?.message || "",
  };
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

function isActionRequestMessage(message, hasAttachments = false) {
  return isDialogueActionRequest(safeDisplayText(message), hasAttachments);
}

function actionPromptsForMessage(message, intent) {
  const text = safeDisplayText(message).trim();
  if (!text) return [];
  if (intent !== "task") {
    const actions = [];
    if (/状态|进度|下一步|总结|概况|现在/.test(text)) {
      actions.push({ id: "open-topic", label: "查看当前进度", target: "project-progress" });
    }
    if (/风险|检查|验证|报告/.test(text)) {
      actions.push({ id: "open-topic", label: "查看风险与验收", target: text.includes("风险") ? "project-risks" : "validation-report" });
    }
    if (/开发|任务|执行|patch|改代码|实现/.test(text.toLowerCase())) {
      actions.push({ id: "open-topic", label: "查看任务", target: "task-list" });
    }
    return actions.slice(0, 2);
  }
  return [
    {
      id: "generate-plan",
      label: "生成计划",
      task: text,
    },
  ];
}

function profilePatchesFromMessage(message) {
  const text = safeDisplayText(message).trim();
  if (!text) return [];
  const patches = [];
  const pushPatch = (key, value, confidence = 0.75) => {
    patches.push({
      key,
      value,
      status: "user_confirmed",
      source: "conversation",
      confidence,
      notes: text,
    });
  };

  if (/技术小白|不懂技术|非技术|小白/.test(text)) {
    pushPatch("user.skillLevel", text, 0.85);
    pushPatch("product.targetUsers", ["技术小白"], 0.7);
  }
  if (/目标用户|用户画像|面向|给.*用/.test(text)) {
    pushPatch("product.targetUsers", text, 0.75);
  }
  if (/长期目标|最终|北极星|愿景/.test(text)) {
    pushPatch("product.longTermGoal", text, 0.75);
  }
  if (/使用场景|场景|什么时候|接手|启动|持续/.test(text)) {
    pushPatch("product.useCases", text, 0.7);
  }
  if (/不要|别|少|希望|偏好|喜欢|不喜欢|自然|主流/.test(text)) {
    pushPatch("user.globalPreferences", text, 0.8);
  }

  return patches;
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

function cleanConversationText(value) {
  return safeDisplayText(value)
    .replace(/\s+/g, " ")
    .replace(/生成计划$/g, "")
    .trim();
}

function compactConversationText(value, maxLength) {
  const text = cleanConversationText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function compactModelLabel(model) {
  const text = String(model || "").trim();
  if (!text) return "模型";
  const gptVersion = text.match(/^gpt[-_]?(\d+(?:\.\d+)?)/i);
  if (gptVersion) return gptVersion[1];
  const version = text.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
  if (version) return version[1];
  return text;
}

function providerModelKey(provider) {
  return [provider?.apiBase || "", provider?.apiKeyEnv || "", provider?.activeProfileId || provider?.profileId || ""].join("|");
}

function modelAvailabilityKey(provider, model) {
  return [provider?.apiBase || "", provider?.apiKeyEnv || "", model || ""].join("|");
}

function providerModelHealth(provider, availability = {}) {
  if (!provider?.enabled || !provider?.model) {
    return { label: "Not work", status: "unavailable" };
  }
  const entry = availability[provider.model];
  if (entry?.status === "available") {
    return { label: "Work", status: "available", message: entry.message || "" };
  }
  if (entry?.status === "quota-exhausted") {
    return { label: "Quota exhausted", status: "quota-exhausted", message: entry.message || "当前连接额度不足" };
  }
  if (["unavailable", "authentication-failed", "model-unavailable", "network-unavailable"].includes(entry?.status)) {
    return { label: "Not work", status: entry.status, message: entry.message || "" };
  }
  return { label: "Checking", status: "unknown" };
}

function catalogModelsForProvider(provider, modelCatalog) {
  const providers = Array.isArray(modelCatalog?.providers) ? modelCatalog.providers : [];
  const preset =
    providers.find((item) => item.apiBase === provider?.apiBase && item.apiKeyEnv === provider?.apiKeyEnv) ||
    providers.find((item) => item.id === provider?.profileId || item.id === provider?.activeProfileId);
  const models = Array.isArray(preset?.models) ? preset.models.filter(Boolean) : [];
  const current = provider?.model ? [provider.model] : [];
  return Array.from(new Set([...models, ...current]));
}

function visibleConversationPreview(conversation) {
  const title = cleanConversationText(conversation?.title);
  const preview = cleanConversationText(conversation?.preview);
  if (!preview || preview === title || isLowSignalConversationText(preview)) return "";
  return compactConversationText(preview, 34);
}

function isLowSignalConversationText(text) {
  const normalized = cleanConversationText(text).replace(/[。！？!?,，\s]/g, "").toLowerCase();
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(normalized)) return true;
  return [
    "我在",
    "已创建执行计划",
    "已生成执行前计划",
    "我先直接回答",
    "模型对话暂时不可用",
    "浏览器预览",
  ].some((phrase) => text.includes(phrase));
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

function goalStatusLabel(todos, fallbackPhase) {
  if (!todos.length) return phaseLabel(fallbackPhase);
  if (todos.every((todo) => todo.status === taskStatuses.done)) return "待验证";
  if (todos.some((todo) => todo.status === taskStatuses.failed)) return "需处理";
  if (todos.some((todo) => todo.status === taskStatuses.running)) return "进行中";
  if (todos.some((todo) => todo.status === taskStatuses.waitingApproval)) return "待确认";
  if (todos.some((todo) => todo.status === taskStatuses.planned)) return "推进中";
  return phaseLabel(fallbackPhase);
}

function activeGoalFromSnapshot(snapshot) {
  return resolveWorkspaceGoal(snapshot);
}

function goalValidationStatusFromActiveGoal(activeGoal, validationGoal, validationReportStatus) {
  if (activeGoal?.status === "done") return "signed-off";
  if (activeGoal?.status === "pending-confirm") return "verified";
  if (activeGoal?.status === "failed") return "validation-failed";
  const validationBelongsToActiveGoal = Boolean(activeGoal?.id && validationGoal?.id === activeGoal.id);
  if (!validationBelongsToActiveGoal) return "";
  return validationGoal?.status || (validationReportStatus === "passed" ? "verified" : "");
}

function goalMetaFromStatus(status, validationReportStatus, todos, phase) {
  if (status === "signed-off" || status === "done") return "已完成";
  if (status === "draft" || status === "planned") return "待确认";
  if (status === "verified" || status === "pending-confirm" || validationReportStatus === "passed") return "待确认";
  if (status === "validation-failed" || status === "failed" || validationReportStatus === "failed") return "验收失败";
  return goalStatusLabel(todos, phase);
}

function goalStatusLabelText(status) {
  return {
    active: "进行中",
    draft: "待确认",
    planned: "待拆解",
    "pending-confirm": "待确认",
    done: "已完成",
    failed: "需处理",
    queued: "待开始",
    paused: "暂停",
  }[status] || status || "进行中";
}

function compactGoalTitle(title) {
  const normalized = safeDisplayText(title, "当前目标")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
  if (normalized.length <= 18) return normalized;
  const parts = normalized.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
  const usefulPart = parts.find((part) => part.length <= 18) || parts[parts.length - 1];
  if (usefulPart && usefulPart.length <= 18) return usefulPart;
  return `${normalized.slice(0, 16)}...`;
}

function progressFromTodos(todos) {
  if (!todos.length) return 0;
  const score = todos.reduce((total, todo) => {
    if (todo.status === taskStatuses.done) return total + 1;
    if (todo.displayStatus === taskStatuses.running || todo.displayStatus === taskStatuses.waitingApproval) return total + 0.5;
    return total;
  }, 0);
  return Math.round((score / todos.length) * 100);
}

function taskDisplayStatus(task, { activeTaskId = "", planLoading = false, terminalRunningId = "" } = {}) {
  if (!task) return "";
  const isLiveRunning = task.id === terminalRunningId || (planLoading && task.id === activeTaskId);
  if (task.status === taskStatuses.running && !isLiveRunning) return taskStatuses.planned;
  return task.status;
}

function snapshotQueueTodos(snapshot) {
  return (snapshot.queue || [])
    .filter((item) => !isNoiseTask(item))
    .map((item, index) => ({
      description: item.body || item.projectName || "",
      goalId: item.goalId || "",
      id: item.id || `snapshot-queue-${index}`,
      status: item.status || taskStatuses.planned,
      title: item.title || "未命名任务",
    }));
}

function projectProfileItems(snapshot) {
  const profile = snapshot.projectProfile || {};
  const missingFields = new Set(profile.missingFields || []);
  const workbenchItems = [
    {
      title: "项目概览",
      body: profile.overview || profile.intro,
    },
    {
      title: "当前阶段",
      body: profile.phaseSummary || snapshot.stage || snapshot.phase,
    },
    {
      title: "技术架构",
      body: profile.architectureSummary,
    },
    {
      title: "检查命令",
      body: profile.checkCommands,
    },
    {
      title: "协作规则",
      body: profile.collaborationRules || profile.userPreferences,
    },
  ];
  const legacyItems = [
    {
      title: "项目简介",
      body: profile.intro,
    },
    {
      title: "长期目标",
      body: profile.longTermGoal,
    },
    {
      title: "目标用户",
      body: profile.targetUsers,
    },
    {
      title: "使用场景",
      body: profile.useCases,
    },
    {
      title: "用户偏好",
      body: profile.userPreferences,
    },
  ];
  const items = workbenchItems.some((item) => item.body) ? workbenchItems : legacyItems;
  return items.map((item) => ({
    ...item,
    missing: missingFields.has(item.title) || !item.body,
  }));
}

function taskSubtasks(task) {
  const steps = Array.isArray(task?.plan?.steps) ? task.plan.steps : [];
  if (steps.length) {
    return steps.map((step, index) => ({
      id: `${task.id || task.title}-step-${index}`,
      status: index === 0 && task.status === taskStatuses.done ? taskStatuses.done : task.status,
      title: step,
    }));
  }

  if (task?.description) {
    return [{
      id: `${task.id || task.title}-summary`,
      status: task.status,
      title: task.description,
    }];
  }

  return [];
}

const chatStarterPrompts = [
  "检查当前项目还有哪些风险",
  "整理下一步任务并生成计划",
  "查看最近改动并准备审查",
  "运行一轮基础检查",
];

function workspaceFileTabId(file) {
  if (file?.virtual) return `route:${file.routeId || file.id || file.path || "preview"}`;
  return `file:${file?.path || file?.preview?.path || file?.topic?.title || "preview"}`;
}

function workspaceFileTabTitle(file) {
  if (file?.id === "workbench-overview" || file?.path === "workbench-overview") return "工作台";
  return file?.preview?.name || file?.topic?.title || (file?.virtual ? file.title : "") || file?.path || "文件";
}

function topicPayloadFromOutline(targetId) {
  const targetRoute = workspaceRouteById(targetId);
  if (!targetRoute) return null;
  const payload = (entry, group, fallbacks = {}) => ({
    description: entry.description,
    group,
    governanceRole: entry.governanceRole || fallbacks.governanceRole,
    id: targetRoute.id,
    maturity: entry.maturity || fallbacks.maturity,
    nextAction: entry.nextAction || fallbacks.nextAction,
    path: targetRoute.path,
    relatedFiles: entry.relatedFiles || entry.files || [],
    routeId: targetRoute.id,
    routePath: targetRoute.path,
    statusSource: entry.statusSource || fallbacks.statusSource,
    surface: targetRoute.surface,
    title: entry.title,
    updatesWhen: entry.updatesWhen || fallbacks.updatesWhen,
    virtual: true,
  });
  for (const node of projectGovernanceOutline) {
    if (node.routeId === targetId) {
      return payload(node, node.title);
    }
    for (const child of node.children || []) {
      if (child.routeId === targetId) {
        return payload(child, child.title || node.title, node);
      }
      for (const item of child.items || []) {
        if (item.routeId === targetId) {
          return payload(item, child.title || node.title, {
            governanceRole: child.governanceRole || node.governanceRole,
            maturity: child.maturity || node.maturity,
            nextAction: child.nextAction || node.nextAction,
            statusSource: child.statusSource || node.statusSource,
            updatesWhen: child.updatesWhen || node.updatesWhen,
          });
        }
      }
    }
    for (const item of node.items || []) {
      if (item.routeId === targetId) {
        return payload(item, node.title, node);
      }
    }
  }
  return null;
}

function AgentWorkspace({
  agentRuns = [],
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
  onResumeAgentRun,
}) {
  const [taskInput, setTaskInput] = useState("");
  const { addImageFiles, attachmentError, attachments, clearAttachments, removeAttachment } = useChatAttachments({ readFileAsDataUrl });
  const boardState = useAgentTopicTaskBoard({
    activeTaskId,
    activeTask,
    isNoiseTask,
    snapshot,
    statuses: taskStatuses,
    tasks,
  });
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
  const isConversationEmpty = !chatTurns.length && !activeTask && !readonlyPlan && !loading && !error && !pendingTurn && !chatLoading;
  const useAssistantUiPoc = assistantUiPocEnabled(window.location.search);
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
        assistantUi={useAssistantUiPoc ? <React.Suspense fallback={<AgentProcessingStatus label="载入对话 POC" running />}><AssistantUiConversationPoc isRunning={chatLoading || Boolean(pendingTurn)} onAction={handleAssistantUiAction} turns={chatTurns} /></React.Suspense> : null}
        chatLoading={chatLoading}
        chatLoadingEvents={chatLoadingEvents}
        chatLoadingLabel={chatLoadingLabel}
        chatStartedAt={chatStartedAt}
        conversationState={conversationRuntime.state}
        error={error}
        isEmpty={isConversationEmpty}
        loading={loading}
        onTurnAction={(action, turn) => handleConversationTurnAction(action, turn, { projectExecution: true })}
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
                selectedEngineeringFile={tab.file}
                snapshot={snapshot}
                tasks={tasks}
                provider={provider}
                composerModelAvailability={composerModelAvailability}
                runnerLoadingId={runnerLoadingId}
                patchLoading={patchLoading}
                applyLoading={applyLoading}
                handoffLoading={handoffLoading}
                onGeneratePatchDraft={onGeneratePatchDraft}
                onApplyPatchDraft={onApplyPatchDraft}
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
                onGetHermesExecutorStatus={onGetHermesExecutorStatus}
              /></TabsContent>}
        tabs={workspaceTabs}
        terminal={{ activeSessionId: activeTerminalSessionId, chunks: terminalChunks, draftRequest: terminalDraftRequest, error: terminalError, logs: terminalLogs, onCloseTerminalSession, onNewTerminalSession, onOpenNativeTerminal, onRestartTerminalSession, onResizeTerminalSession, onRunCheck: onRunTerminalCheck, onSaveTerminalImage, onSelectTerminalSession, onWriteTerminalData, runningId: terminalRunningId, session: terminalSession, sessions: terminalSessions, text: terminalText }}
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
              statusLabel={taskStatusLabel(activeTask.status)}
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

function statusLabel(status) {
  return {
    confirmed: "已确认",
    inferred: "推断",
    missing: "缺失",
    stale: "需更新",
    conflict: "冲突",
    draft: "草稿",
    "needs-review": "待审阅",
    connected: "已接入",
    "preview-managed": "预览治理",
    "ready-to-confirm": "已接入",
    blocked: "受阻",
  }[status] || status || "未知";
}

function actionLabel(action) {
  return {
    "auto-managed": "自动治理",
    "preview-only": "仅预览",
    "confirm-workspace": "已自动接入",
    "keep-readonly": "仅预览",
    "request-more-info": "需要补充信息",
    "block-workspace": "暂不建议接入",
  }[action] || action || "建议";
}

function governanceFileStatusLabel(status) {
  return {
    found: "已识别",
    missing: "缺失",
    changed: "有变更",
    stale: "可能过期",
    generated: "生成记录",
    ignored: "规则",
  }[status] || status || "未知";
}

function governanceFileHealthLabel(status) {
  return {
    found: "正常",
    missing: "缺失",
    changed: "有本地变更",
    stale: "可能过期",
    generated: "生成产物",
    ignored: "规则/目录",
  }[status] || "待确认";
}

function governanceFileHealthSummary(domains = []) {
  const counts = { found: 0, missing: 0, changed: 0, stale: 0, generated: 0, ignored: 0, total: 0 };
  domains.forEach((domain) => {
    const files = Array.isArray(domain.files) ? domain.files : [];
    const fileStatuses = Array.isArray(domain.fileStatuses)
      ? domain.fileStatuses
      : files.map((file) => ({
        path: file,
        previewable: !file.includes("*") && !file.endsWith("/"),
        status: file.includes("*") || file.endsWith("/") ? "ignored" : "found",
      }));
    fileStatuses.forEach((file) => {
      const status = file.status || "found";
      counts[status] = (counts[status] || 0) + 1;
      counts.total += 1;
    });
  });
  const riskCount = counts.missing + counts.changed + counts.stale;
  return {
    ...counts,
    riskCount,
    status: riskCount ? "watch" : "healthy",
    label: riskCount ? `${riskCount} 项需关注` : "治理文件正常",
  };
}

function governanceStatusSummaryText(summary, fallbackCount = 0) {
  if (!summary) return `${fallbackCount} 个文件`;
  return [
    summary.found ? `${summary.found} found` : "",
    summary.changed ? `${summary.changed} changed` : "",
    summary.missing ? `${summary.missing} missing` : "",
    summary.generated ? `${summary.generated} generated` : "",
    summary.ignored ? `${summary.ignored} ignored` : "",
  ].filter(Boolean).join(" / ") || `${fallbackCount} 个文件`;
}

function GovernanceFilesHealthSection({ onCreateGovernanceTask, onReadEngineeringFile, report }) {
  const [openDomainId, setOpenDomainId] = useState("");
  const [governanceFile, setGovernanceFile] = useState(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState("");
  const governanceDomains = Array.isArray(report?.governanceDomains) ? report.governanceDomains : [];
  const health = governanceFileHealthSummary(governanceDomains);
  const fileStatusesForDomain = (domain) => {
    const files = Array.isArray(domain.files) ? domain.files : [];
    return Array.isArray(domain.fileStatuses)
      ? domain.fileStatuses
      : files.map((file) => ({
        path: file,
        previewable: !file.includes("*") && !file.endsWith("/"),
        status: file.includes("*") || file.endsWith("/") ? "ignored" : "found",
      }));
  };
  const selectStatusFilter = (status) => {
    const nextStatus = activeStatusFilter === status ? "" : status;
    setActiveStatusFilter(nextStatus);
    setGovernanceFile(null);
    if (!nextStatus) return;
    const firstDomain = governanceDomains.find((domain) =>
      fileStatusesForDomain(domain).some((file) => (file.status || "found") === nextStatus)
    );
    if (firstDomain) setOpenDomainId(firstDomain.id);
  };
  const actionHints = [
    health.missing ? `先补 ${health.missing} 个缺失文件` : "",
    health.changed ? `再审阅 ${health.changed} 个本地变更` : "",
    health.stale ? `复查 ${health.stale} 个可能过期文件` : "",
    health.ignored ? `${health.ignored} 个规则/目录通常只需确认边界` : "",
  ].filter(Boolean);
  const selectedFileStatuses = governanceDomains.flatMap((domain) =>
    fileStatusesForDomain(domain)
      .filter((file) => !activeStatusFilter || (file.status || "found") === activeStatusFilter)
      .map((file) => ({
        domainId: domain.id,
        domainTitle: domain.title,
        path: file.path || file,
        previewable: file.previewable,
        status: file.status || "found",
      }))
  );
  const canCreateTask = ["missing", "changed", "stale"].includes(activeStatusFilter) && selectedFileStatuses.length > 0;
  const createTaskLabel = {
    changed: "生成审阅任务",
    missing: "生成补齐任务",
    stale: "生成同步任务",
  }[activeStatusFilter] || "生成处理任务";
  const previewGovernanceFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) {
      setGovernanceFile({
        error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。",
        path,
      });
      return;
    }
    setGovernanceFile({ loading: true, path });
    try {
      const preview = await onReadEngineeringFile(path);
      setGovernanceFile({ path, preview });
    } catch (err) {
      setGovernanceFile({
        error: err instanceof Error ? err.message : String(err),
        path,
      });
    }
  };

  return (
    <section className="workspaceGovernanceFiles">
      <header>
        <div>
          <strong>治理文件健康状态</strong>
          <p>按治理域查看真实文件状态，优先处理缺失、过期和本地变更。</p>
        </div>
        <Badge>{health.label}</Badge>
      </header>
      <div className="workspaceGovernanceHealthGrid">
        {[
          ["found", "正常"],
          ["changed", "有本地变更"],
          ["missing", "缺失"],
          ["stale", "可能过期"],
          ["generated", "生成产物"],
          ["ignored", "规则/目录"],
        ].map(([status, label]) => (
          <button
            className={`workspaceGovernanceHealthCard status-${status}${activeStatusFilter === status ? " active" : ""}`}
            disabled={!health[status]}
            key={status}
            type="button"
            onClick={() => selectStatusFilter(status)}
          >
            <span>{label}</span>
            <strong>{health[status] || 0}</strong>
          </button>
        ))}
      </div>
      <div className="workspaceGovernanceActions">
        <div>
          <strong>建议处理顺序</strong>
          <p>{actionHints.length ? actionHints.join("，") : "当前治理文件状态稳定，保持同步即可。"}</p>
        </div>
        {activeStatusFilter ? (
          <div className="workspaceGovernanceActionButtons">
            {canCreateTask ? (
              <Button
                size="sm"
                variant="primary"
                type="button"
                onClick={() => onCreateGovernanceTask?.({
                  files: selectedFileStatuses,
                  status: activeStatusFilter,
                })}
              >
                {createTaskLabel}
              </Button>
            ) : null}
            <Button size="sm" variant="subtle" type="button" onClick={() => setActiveStatusFilter("")}>
              查看全部
            </Button>
          </div>
        ) : null}
      </div>
      <div className="workspaceGovernanceDomainRows">
        {governanceDomains.map((domain) => {
          const fileStatuses = fileStatusesForDomain(domain);
          const visibleFileStatuses = activeStatusFilter
            ? fileStatuses.filter((file) => (file.status || "found") === activeStatusFilter)
            : fileStatuses;
          if (activeStatusFilter && !visibleFileStatuses.length) return null;
          const isOpen = openDomainId === domain.id;
          return (
            <div className="workspaceGovernanceDomain" key={domain.id || domain.title}>
              <button
                className="workspaceGovernanceDomainButton"
                type="button"
                onClick={() => setOpenDomainId(isOpen ? "" : domain.id)}
              >
                <span>{domain.title}</span>
                  <small>{governanceStatusSummaryText(domain.statusSummary, fileStatuses.length)}</small>
                </button>
                {isOpen ? (
                  <div className="workspaceGovernanceFileList">
                  {visibleFileStatuses.map((file) => {
                    const path = file.path || file;
                    const isPreviewable = file.previewable ?? (!path.includes("*") && !path.endsWith("/"));
                    return (
                      <button
                        className={`workspaceGovernanceFile status-${file.status || "found"}${governanceFile?.path === path ? " active" : ""}`}
                        disabled={!isPreviewable}
                        key={path}
                        type="button"
                        onClick={() => previewGovernanceFile(path)}
                      >
                        <span>{path}</span>
                        <small>{governanceFileHealthLabel(file.status)}</small>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <ReadonlyFilePreview file={governanceFile} />
    </section>
  );
}

const designImplementationTopics = {
  "system-architecture": {
    files: ["docs/ARCHITECTURE.md"],
    task: "审阅系统架构",
  },
  "data-contracts": {
    files: ["schemas/", "docs/data/"],
    task: "审阅数据契约",
  },
  "ui-standards": {
    files: ["docs/DESIGN_STANDARDS.md", "desktop/src/styles.css"],
    task: "审阅界面规范",
  },
  "code-structure": {
    files: ["docs/ARCHITECTURE.md", "desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"],
    task: "审阅实现结构",
  },
};

function DesignImplementationHealthSection({ onCreateDesignGovernanceTask, onReadEngineeringFile, report, topic }) {
  const [activeStatusFilter, setActiveStatusFilter] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const designDomain = (Array.isArray(report?.governanceDomains) ? report.governanceDomains : [])
    .find((domain) => domain.id === "design-implementation" || domain.title === "设计实现");
  const allFiles = Array.isArray(designDomain?.fileStatuses) ? designDomain.fileStatuses : [];
  const topicConfig = designImplementationTopics[topic?.id] || null;
  const topicFiles = topicConfig
    ? allFiles.filter((file) => topicConfig.files.some((pattern) => {
      const path = file.path || "";
      return pattern.endsWith("/") ? path.startsWith(pattern) : path === pattern;
    }))
    : allFiles;
  const visibleFiles = activeStatusFilter
    ? topicFiles.filter((file) => (file.status || "found") === activeStatusFilter)
    : topicFiles;
  const health = governanceFileHealthSummary([{ fileStatuses: topicFiles }]);
  const riskFiles = topicFiles.filter((file) => ["missing", "changed", "stale"].includes(file.status || "found"));
  const actionableFiles = activeStatusFilter
    ? visibleFiles.filter((file) => ["missing", "changed", "stale"].includes(file.status || "found"))
    : riskFiles;
  const actionHint = riskFiles.length
    ? `发现 ${riskFiles.length} 个需要确认的设计实现资产，建议生成治理任务进入 Patch / 验证闭环。`
    : "当前设计实现资产状态稳定，后续可继续接入一致性检查。";
  const previewDesignFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) {
      setPreviewFile({ error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。", path });
      return;
    }
    setPreviewFile({ loading: true, path });
    try {
      const preview = await onReadEngineeringFile(path);
      setPreviewFile({ path, preview });
    } catch (err) {
      setPreviewFile({ error: err instanceof Error ? err.message : String(err), path });
    }
  };

  return (
    <section className="workspaceGovernanceFiles">
      <header>
        <div>
          <strong>设计实现健康状态</strong>
          <p>把架构、契约、界面规范和实现结构接到同一套治理任务闭环。</p>
        </div>
        <Badge>{health.riskCount ? `${health.riskCount} 项需确认` : "设计实现稳定"}</Badge>
      </header>
      <div className="workspaceGovernanceHealthGrid">
        {[
          ["found", "正常"],
          ["changed", "有本地变更"],
          ["missing", "缺失"],
          ["stale", "可能过期"],
        ].map(([status, label]) => (
          <button
            className={`workspaceGovernanceHealthCard status-${status}${activeStatusFilter === status ? " active" : ""}`}
            disabled={!health[status]}
            key={status}
            type="button"
            onClick={() => setActiveStatusFilter(activeStatusFilter === status ? "" : status)}
          >
            <span>{label}</span>
            <strong>{health[status] || 0}</strong>
          </button>
        ))}
      </div>
      <div className="workspaceGovernanceActions">
        <div>
          <strong>建议动作</strong>
          <p>{actionHint}</p>
        </div>
        <div className="workspaceGovernanceActionButtons">
          <Button
            disabled={!actionableFiles.length}
            size="sm"
            variant="primary"
            type="button"
            onClick={() => onCreateDesignGovernanceTask?.({
              files: actionableFiles.map((file) => ({
                ...file,
                domainTitle: designDomain?.title || "设计实现",
              })),
              topic,
            })}
          >
            生成治理任务
          </Button>
          {activeStatusFilter ? (
            <Button size="sm" variant="subtle" type="button" onClick={() => setActiveStatusFilter("")}>
              查看全部
            </Button>
          ) : null}
        </div>
      </div>
      <div className="workspaceGovernanceFileList">
        {visibleFiles.length ? visibleFiles.map((file) => {
          const path = file.path || file;
          const isPreviewable = file.previewable ?? (!path.includes("*") && !path.endsWith("/"));
          return (
            <button
              className={`workspaceGovernanceFile status-${file.status || "found"}${previewFile?.path === path ? " active" : ""}`}
              disabled={!isPreviewable}
              key={path}
              type="button"
              onClick={() => previewDesignFile(path)}
            >
              <span>{path}</span>
              <small>{governanceFileHealthLabel(file.status)}</small>
            </button>
          );
        }) : (
          <Notice variant="info">当前入口还没有匹配到设计实现资产。</Notice>
        )}
      </div>
      <ReadonlyFilePreview file={previewFile} />
    </section>
  );
}

function CurrentProgressSlot({ model, onNavigate, onOpenSource }) {
  const updatedAt = model.evidence.updatedAt
    ? new Date(model.evidence.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const validationMeta = model.validation.meta && model.validation.meta !== "--"
    ? `更新于 ${new Date(model.validation.meta).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : model.validation.meta;
  const acceptanceValue = model.acceptance.kind === "missing-required"
    ? <Badge variant="warning">{model.acceptance.label}</Badge>
    : <strong>{model.acceptance.label}</strong>;
  const acceptanceContent = <div className="currentProgressOverviewItem">{acceptanceValue}<span>{model.acceptance.meta}</span></div>;
  const validationValue = model.validation.kind === "empty"
    ? <strong>{model.validation.label}</strong>
    : <Badge>{model.validation.label}</Badge>;
  const nextActionItems = [
    {
      id: `next-${model.nextAction.id}`,
      content: (
        <div className="currentProgressOverviewItem">
          <strong>{model.nextAction.title}</strong>
          <span>{model.nextAction.meta}</span>
        </div>
      ),
      onClick: () => onNavigate?.(model.nextAction.routeId),
    },
  ];
  return (
    <section className="workspaceFacts projectOverviewSurface currentProgressBoard">
      <OverviewPageHeader
        title="项目进展"
        description={model.summary}
        meta={<span>{updatedAt ? `更新于 ${updatedAt}` : "随项目事实自动更新"}</span>}
        sources={<div className="overviewSourceButtons">{model.evidence.files.slice(0, 5).map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
      />
      <OverviewSection
        title="项目位置"
        subtitle="项目目标与当前阶段目标"
        items={[
          {
            id: "project-goal",
            label: "项目目标",
            content: model.projectGoal,
          },
          {
            id: "milestone",
            label: "当前里程碑",
            content: model.milestone,
          },
          {
            id: "goal",
            label: "当前阶段目标",
            content: (
              <div className="currentProgressOverviewItem">
                <strong>{model.goal.title}</strong>
                <Badge>{model.goal.status}</Badge>
              </div>
            ),
            onClick: () => onNavigate?.(model.goal.routeId),
          },
        ]}
      />
      <OverviewSection
        title="目标阶段"
        subtitle={model.stage.label}
        items={[
          {
            id: "stage",
            content: (
              <div className="projectProgressStages" aria-label={`当前项目目标阶段：${model.stage.label}`}>
                {model.stage.steps.map((step) => (
                  <div className="projectProgressStage" data-state={step.state} key={step.id}>
                    <span aria-hidden="true" />
                    <strong>{step.label}</strong>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
      <OverviewSection
        title="验收与风险"
        subtitle="项目级判断依据"
        items={[
          {
            id: "acceptance",
            label: "验收标准",
            content: acceptanceContent,
            onClick: model.acceptance.kind === "ready" ? () => onNavigate?.(model.acceptance.routeId) : undefined,
          },
          {
            id: "validation",
            label: "最近验收",
            content: <div className="currentProgressOverviewItem">{validationValue}<span>{validationMeta}</span></div>,
            onClick: () => onNavigate?.(model.validation.routeId),
          },
          {
            id: "risks",
            label: "项目风险",
            content: <div className="currentProgressOverviewItem"><strong>{model.risks.count} 项</strong><span>{model.risks.meta}</span></div>,
            onClick: () => onNavigate?.(model.risks.routeId),
          },
        ]}
      />
      <OverviewSection
        title="下一步"
        subtitle="项目级唯一建议"
        items={nextActionItems}
      />
    </section>
  );
}

function CurrentProgressPanel({ onNavigate, onOpenSource, report, snapshot, tasks = [] }) {
  const store = buildProjectFactStore({ report, snapshot, tasks });
  const descriptors = compileCurrentProgressSlots({ capabilityManifest: snapshot?.projectCapabilities, components: { CurrentProgressSlot }, contract: projectProgressContract, store });
  return descriptors.map((descriptor) => <descriptor.component key={descriptor.id} model={descriptor.props} onNavigate={onNavigate} onOpenSource={onOpenSource} />);
}

function currentGoalNextAction(goal) {
  if (!goal) return { detail: "先建立一个可验收的当前目标。", routeId: "current-goal", title: "建立当前目标" };
  if (goal.status === "draft") return { detail: "确认范围后，才能进入任务拆解。", routeId: "current-goal", title: "确认当前目标" };
  if (goal.status === "planned") return { detail: "先生成并确认任务拆解草案，再进入任务执行。", routeId: "current-goal", title: "生成任务拆解" };
  if (goal.status === "pending-confirm") return { detail: "验收已结束，确认完成前请先核对验收标准。", routeId: "acceptance-criteria", title: "核对验收标准" };
  if (goal.status === "failed") return { detail: "先处理验收失败项，再重新判断目标状态。", routeId: "validation-report", title: "处理验收失败项" };
  if (goal.status === "done") return { detail: "当前目标已完成，后续记录归入目标历史。", routeId: "goal-history", title: "查看目标历史" };
  return { detail: "在任务中推进关联任务，完成后进入验收标准判断。", routeId: "task-list", title: "继续推进关联任务" };
}

function CurrentGoalPanel({ decomposingGoal, onConfirmDecomposition, onGenerateDecomposition, onNavigate, onOpenSource, snapshot }) {
  const [decompositionOpen, setDecompositionOpen] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [draftError, setDraftError] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const goal = activeGoalFromSnapshot(snapshot || {});
  const updatedAt = goal?.updatedAt || goal?.confirmedAt || goal?.createdAt;
  const updatedLabel = updatedAt
    ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "尚未记录更新时间";
  const status = goal ? goalStatusLabelText(goal.status) : "待建立";
  const nextAction = currentGoalNextAction(goal);
  const sources = [".project-os/goals.json", "PROJECT.md", "HANDOFF.md"];
  return (
    <section className="overviewSurface currentGoalSurface">
      <OverviewPageHeader
        title="当前阶段目标"
        description="集中查看当前项目目标下的阶段目标、范围边界与唯一下一步。"
        meta={<span>{updatedLabel}</span>}
        sources={<div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
        status={<Badge>{status}</Badge>}
      />
      <OverviewSection
        title="目标定义"
        subtitle="本阶段要达成什么"
        actions={<Button size="sm" type="button" variant="ghost" onClick={() => onNavigate?.("acceptance-criteria")}>查看验收标准</Button>}
        items={[{ id: "goal-title", label: "目标", content: goal?.title || "尚未建立当前目标" }]}
      />
      <OverviewSection
        title="范围边界"
        subtitle="本目标覆盖什么"
        items={[{ id: "goal-scope", content: goal?.summary || "尚未填写目标范围说明。" }]}
      />
      <OverviewSection
        title="下一步"
        subtitle="由当前目标状态决定"
        items={[{
          id: "goal-next-action",
          content: <div className="currentProgressOverviewItem"><strong>{nextAction.title}</strong><span>{nextAction.detail}</span>{goal?.status === "planned" ? <Button size="sm" type="button" variant="ghost" onClick={() => setDecompositionOpen(true)}>查看拆解草案<ArrowRight aria-hidden="true" size={14} /></Button> : null}</div>,
          onClick: goal?.status === "planned" ? undefined : () => onNavigate?.(nextAction.routeId),
        }]}
      />
      <Dialog open={decompositionOpen} onOpenChange={setDecompositionOpen}>
        <DialogContent title="任务拆解" description="只有模型成功生成草案后，才能确认并写入任务。">
          {draftItems.length ? <div className="goalHistoryList">{draftItems.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div> : <Notice variant="info">尚未生成草案。模型不可用或调用失败时不会创建任务。</Notice>}
          {draftError ? <Notice variant="danger">{draftError}</Notice> : null}
          <div className="goalConfirmActions">
            <DialogClose asChild><Button size="sm" type="button" variant="default">取消</Button></DialogClose>
            {!draftItems.length ? <Button size="sm" type="button" variant="primary" disabled={generatingDraft} onClick={async () => {
              setGeneratingDraft(true); setDraftError("");
              try { setDraftItems(await onGenerateDecomposition?.(goal) || []); } catch (error) { setDraftError(error instanceof Error ? error.message : String(error)); } finally { setGeneratingDraft(false); }
            }}>{generatingDraft ? "生成中" : "生成模型草案"}</Button> : <Button size="sm" type="button" variant="primary" disabled={decomposingGoal} onClick={async () => {
              const completed = await onConfirmDecomposition?.(goal, draftItems);
              if (completed) setDecompositionOpen(false);
            }}>{decomposingGoal ? "确认中" : "确认拆解"}</Button>
            }
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function goalValidationStatusLabel(status) {
  return {
    passed: "已通过",
    failed: "未通过",
    running: "验收中",
    missing: "尚未验收",
  }[status] || "尚未验收";
}

function AcceptanceCriteriaPanel({ onNavigate, onOpenSource, snapshot }) {
  const validation = snapshot?.goalValidation || {};
  const report = snapshot?.goalValidationReport || {};
  const criteria = Array.isArray(validation.criteria) ? validation.criteria : [];
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const goal = validation.goal || activeGoal;
  const criteriaMatchCurrentGoal = Boolean(activeGoal?.id && validation.goal?.id === activeGoal.id);
  const criteriaNeedRelinking = Boolean(criteria.length && activeGoal?.id && !criteriaMatchCurrentGoal);
  const updatedAt = validation.updatedAt || report.generatedAt;
  const updatedLabel = updatedAt
    ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "尚未记录验收时间";
  const reportStatus = goalValidationStatusLabel(report.status || "missing");
  const sources = [".project-os/goal-validation.json", "docs/TESTING.md"];
  return (
    <section className="overviewSurface acceptanceCriteriaSurface">
      <OverviewPageHeader
        title="验收标准"
        description="集中定义当前目标完成时必须满足的判断条件。"
        meta={<span>{updatedLabel}</span>}
        sources={<div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
        status={<Badge variant={criteriaNeedRelinking ? "warning" : criteria.length ? "success" : "neutral"}>{criteriaNeedRelinking ? "需处理" : criteria.length ? "已登记" : "待确认"}</Badge>}
      />
      <OverviewSection
        title="关联目标"
        subtitle="这些条件判断哪个目标是否完成"
        actions={<Button size="sm" type="button" variant="ghost" onClick={() => onNavigate?.("current-goal")}>查看当前目标</Button>}
        items={[{ id: "validation-goal", label: "目标", content: goal?.title || "尚未关联目标" }]}
      />
      <OverviewSection
        title="完成判断"
        subtitle={criteria.length ? `${criteria.length} 项必须满足的条件` : "尚未登记完成判断"}
        items={[{
          id: "criteria",
          content: criteria.length ? <div className="acceptanceCriteriaList">{criteriaNeedRelinking ? <Notice variant="warning">现有标准关联的是“{goal?.title || "其他目标"}”，当前目标“{activeGoal?.title || "未命名目标"}”仍缺少验收标准。</Notice> : null}{criteria.map((criterion) => <article key={criterion.id || criterion.title}><div><strong>{criterion.title || "未命名条件"}</strong>{criterion.required ? <Badge>必需</Badge> : null}</div><p>{criterion.body || "未填写判断说明。"}</p></article>)}</div> : <Notice variant="info">尚未为当前目标登记验收标准。</Notice>,
        }]}
      />
      <OverviewSection
        title="当前结论"
        subtitle="执行证据和检查详情归验收报告"
        actions={<Button size="sm" type="button" variant="ghost" onClick={() => onNavigate?.("validation-report")}>查看验收报告</Button>}
        items={[{ id: "report-status", label: "验收状态", content: <Badge>{reportStatus}</Badge> }]}
      />
    </section>
  );
}

function GoalHistoryPanel({ onOpenSource, snapshot }) {
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const completedGoals = goals.filter((goal) => goal.status === "done");
  const signoffHistory = Array.isArray(snapshot?.goalSignoffHistory?.entries) ? snapshot.goalSignoffHistory.entries : [];
  const updatedAt = snapshot?.goalSignoffHistory?.updatedAt || snapshot?.goals?.updatedAt;
  const updatedLabel = updatedAt
    ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "尚未记录完成时间";
  const sources = [".project-os/goals.json", ".project-os/goal-signoff-history.json"];
  return (
    <section className="overviewSurface goalHistorySurface">
      <OverviewPageHeader
        title="目标历史"
        description="保留已经完成目标及其完成确认记录，便于回看和追溯。"
        meta={<span>{updatedLabel}</span>}
        sources={<div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
        status={<Badge status={completedGoals.length ? "done" : "waiting"}>{completedGoals.length ? "已完成" : "尚未记录"}</Badge>}
      />
      <OverviewSection
        title="已完成目标"
        subtitle={completedGoals.length ? `${completedGoals.length} 个已完成目标` : "尚无已完成目标"}
        items={[{
          id: "completed-goals",
          content: completedGoals.length ? <div className="goalHistoryList">{completedGoals.map((goal) => <article key={goal.id}><div><strong>{goal.title || "未命名目标"}</strong><Badge>已完成</Badge></div><p>{goal.summary || "未记录目标说明。"}</p></article>)}</div> : <Notice variant="info">完成后的目标会在这里保留历史记录。</Notice>,
        }]}
      />
      <OverviewSection
        title="完成确认"
        subtitle="确认结果来自验收完成记录"
        items={[{
          id: "signoff-history",
          content: signoffHistory.length ? <div className="goalHistoryList">{signoffHistory.map((entry, index) => <article key={`${entry.goalId || entry.goalTitle}-${entry.signedOffAt || index}`}><div><strong>{entry.goalTitle || "未命名目标"}</strong><Badge>{goalValidationStatusLabel(entry.reportStatus)}</Badge></div><p>{entry.signedOffAt ? `确认于 ${new Date(entry.signedOffAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "未记录确认时间"}</p></article>)}</div> : <Notice variant="info">完成确认后会在这里沉淀可追溯记录。</Notice>,
        }]}
      />
    </section>
  );
}

function RuleSourceButtons({ onOpenSource, sources }) {
  return (
    <div className="overviewSourceButtons">
      {sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{displayStateRelativePath(source)}</span></button>)}
    </div>
  );
}

function ValidationReportPanel({ onOpenSource, snapshot }) {
  const report = snapshot?.goalValidationReport || {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const passed = checks.filter((check) => check?.success).length;
  const status = goalValidationStatusLabel(report.status || "missing");
  const sources = [".project-os/goal-validation-report.json", ".project-os/reports/ai-project-report.json"];
  return (
    <section className="overviewSurface validationReportSurface">
      <OverviewPageHeader
        title="验收报告"
        description="给出当前目标最近一次验收的结论、检查结果和后续处理方向。"
        meta={<span>{report.generatedAt ? `更新于 ${new Date(report.generatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "尚未生成验收报告"}</span>}
        sources={<RuleSourceButtons onOpenSource={onOpenSource} sources={sources} />}
        status={<Badge>{status}</Badge>}
      />
      <OverviewSection
        title="当前结论"
        subtitle="只呈现当前目标的验收判断"
        items={[{ id: "validation-conclusion", content: report.summary || (checks.length ? `最近验收 ${status}。` : "尚未运行当前目标的验收。") }]}
      />
      <OverviewSection
        title="检查结果"
        subtitle={checks.length ? `${passed}/${checks.length} 项通过` : "尚无检查结果"}
        items={[{ id: "validation-check-results", content: checks.length ? <OverviewTagList items={checks.map((check) => `${check.success ? "通过" : "失败"} · ${check.label || check.id || "未命名检查"}`)} /> : <Notice variant="info">运行验收后，这里会显示每项检查的结论。</Notice> }]}
      />
      <OverviewSection
        title="后续处理"
        subtitle="失败与运行细节由对应页面承接"
        items={[{ id: "validation-follow-up", content: report.status === "failed" ? "存在未通过检查。请在任务执行中处理失败项，再重新验收。" : "完整报告产物归工程资产，单次运行过程归运行记录。" }]}
      />
    </section>
  );
}

function RunRecordsPanel({ onOpenSource, snapshot }) {
  const runCount = Number(snapshot?.runCount || 0);
  const report = snapshot?.goalValidationReport || {};
  const sources = [".project-os/runs/desktop-summary.md", ".project-os/goal-validation-report.json"];
  return (
    <section className="overviewSurface runRecordsSurface">
      <OverviewPageHeader
        title="运行记录"
        description="保留检查、扫描和受控执行的历史证据，供后续追溯。"
        meta={<span>{report.generatedAt ? `最近验收于 ${new Date(report.generatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "尚未记录最近运行"}</span>}
        sources={<RuleSourceButtons onOpenSource={onOpenSource} sources={sources} />}
        status={<Badge>{runCount ? "已登记" : "待确认"}</Badge>}
      />
      <OverviewSection
        title="执行历史"
        subtitle="已沉淀的本地运行次数"
        items={[{ id: "run-history", content: runCount ? `当前项目已记录 ${runCount} 次运行。` : "尚未发现可展示的本地运行记录。" }]}
      />
      <OverviewSection
        title="可追溯证据"
        subtitle="每次运行关联结果和上下文"
        items={[{ id: "run-evidence", content: "运行记录保留目标、检查命令、输出摘要和最终状态；验收结论仍以验收报告为准。" }]}
      />
      <OverviewSection
        title="保留边界"
        subtitle="历史产物按本地策略自动清理"
        items={[{ id: "run-retention", content: "运行历史属于本地治理产物；清理策略由 Project OS 配置维护，交接只沉淀仍与当前项目决策相关的结果。" }]}
      />
    </section>
  );
}

function RiskBoundaryPanel({ onOpenSource, report, snapshot }) {
  const boundary = report?.summary?.riskBoundary || report?.project?.riskBoundary || {};
  const summaryRisks = Array.isArray(report?.findings?.risks) ? report.findings.risks : [];
  const profileRisks = Array.isArray(snapshot?.projectProfile?.fields?.["memory.risks"]?.value)
    ? snapshot.projectProfile.fields["memory.risks"].value.map((body) => ({ body, severity: "medium", title: "项目约束" }))
    : [];
  const risks = (summaryRisks.length ? summaryRisks : profileRisks).slice(0, 3);
  const sources = [...new Set([...(boundary.sources || []), ...risks.flatMap((risk) => risk.sources || [])])].slice(0, 5);
  const status = risks.length ? "需关注" : "暂无项目风险";

  return (
    <section className="overviewSurface riskBoundarySurface">
      <OverviewPageHeader
        description={boundary.body || "集中查看会影响项目推进的已知风险，以及当前阶段明确不覆盖的范围。"}
        meta={<span>{boundary.status === "confirmed" ? "已确认" : "基于项目事实"}</span>}
        sources={sources.length ? <div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div> : null}
        status={<Badge status={risks.length ? "waiting" : "done"}>{status}</Badge>}
        title="风险边界"
      />
      <OverviewSection
        subtitle={risks.length ? `${risks.length} 项需要持续关注` : "当前未发现需要处理的项目级风险"}
        title="已知风险"
        items={[{
          id: "known-risks",
          content: risks.length ? (
            <div className="riskBoundaryList">
              {risks.map((risk) => <article key={`${risk.title}-${risk.body}`}>
                <div><strong>{risk.title || "未命名风险"}</strong><Badge status={risk.severity === "high" ? "failed" : risk.severity === "low" ? "planned" : "waiting"}>{risk.severity === "high" ? "高" : risk.severity === "low" ? "低" : "中"}</Badge></div>
                <p>{risk.body}</p>
              </article>)}
            </div>
          ) : <Notice variant="success">当前项目没有记录需要处理的风险。</Notice>,
        }]}
      />
      <OverviewSection
        subtitle="不在这里执行或重复展示，由对应页面承接"
        title="当前边界"
        items={[
          { id: "execution-boundary", label: "任务与验证", content: "失败任务、运行日志和修复动作进入执行结果。" },
          { id: "asset-boundary", label: "文件健康", content: "缺失、变更和过期文件进入治理文件。" },
          { id: "security-boundary", label: "安全与权限", content: "确认动作、密钥和命令限制进入安全边界。" },
        ]}
      />
    </section>
  );
}

function LocalProjectStatePanel({ onOpenSource, report, snapshot }) {
  const summary = report?.summary?.localState || {};
  const domain = (report?.governanceDomains || []).find((item) => item.id === "local-state") || {};
  const statuses = Array.isArray(domain.fileStatuses) ? domain.fileStatuses : [];
  const statusFor = (path) => statuses.find((item) => item.path === path)?.status || "unknown";
  const sources = [...new Set((summary.sources || domain.files || []).filter((path) => path && !path.endsWith("/")))].slice(0, 5);
  const selectedProject = (snapshot?.projects || []).find((project) => project.isCurrent);
  const stateChanged = statusFor(".project-os/state.json") === "changed";
  return (
    <section className="localStateSurface">
      <OverviewPageHeader
        description={summary.body || "确认 OmniDesk 是否已认识、登记并可以继续治理当前项目。"}
        meta={<span>接入信息随项目登记和治理文件变化更新</span>}
        sources={sources.length ? <div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div> : null}
        status={<Badge status="done">已接入</Badge>}
        title="项目接入"
      />
      <OverviewSection title="接入状态" subtitle="当前工作区是否已登记并可继续使用" items={[
        { id: "project", label: "当前项目", content: selectedProject?.name || snapshot?.projectName || "尚未选择" },
        { id: "registry", label: "工作区登记", content: <Badge>{statusFor(".project-os/desktop-registry.json") === "found" ? "已登记" : "待确认"}</Badge> },
      ]} />
      <OverviewSection title="治理准备" subtitle="继续使用 OmniDesk 所需的基础信息" items={[
        { id: "state", label: "状态文件", content: stateChanged ? "检测到本地变化，已纳入当前状态" : <Badge>可用</Badge> },
        { id: "profile", label: "项目档案", content: <Badge>{snapshot?.projectProfile ? "已识别" : "待识别"}</Badge> },
      ]} />
    </section>
  );
}

function RunbookCommandList({ commands, copiedCommandId, copyErrorId, onCopy, onSendToTerminal }) {
  if (!commands.length) return <Notice variant="info">尚未识别到命令，请先在 package scripts 或运行文档登记。</Notice>;
  return (
    <div className="runbookCommandList">
      {commands.map((item) => {
        const copied = copiedCommandId === item.id;
        const failed = copyErrorId === item.id;
        return (
          <div className="runbookCommandRow" key={item.id || item.label}>
            <div className="runbookCommandIdentity">
              <strong>{item.label}</strong>
              <span>{item.source}</span>
            </div>
            <code>{item.command}</code>
            <div className="runbookCommandAction">
              <div className="runbookCommandButtons">
                <Tooltip content="发送到终端">
                  <Button aria-label={`发送${item.label}命令到终端`} onClick={() => onSendToTerminal?.(item.command)} size="icon" type="button" variant="ghost">
                    <TerminalSquare aria-hidden="true" />
                  </Button>
                </Tooltip>
                <Tooltip content={failed ? "复制失败" : copied ? "已复制" : "复制命令"}>
                  <Button aria-label={`复制${item.label}命令`} onClick={() => onCopy(item)} size="icon" type="button" variant="ghost">
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  </Button>
                </Tooltip>
              </div>
              {copied || failed ? <span className={failed ? "error" : "success"} role="status">{failed ? "复制失败" : "已复制"}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RunbookSlot({ model, onSendToTerminal }) {
  const [copiedCommandId, setCopiedCommandId] = useState("");
  const [copyErrorId, setCopyErrorId] = useState("");
  const copyCommand = async (item) => {
    setCopyErrorId("");
    try {
      await copyTextToSystemClipboard(item.command);
      setCopiedCommandId(item.id);
    } catch {
      setCopiedCommandId("");
      setCopyErrorId(item.id);
    }
  };
  return (
    <section className="workspaceFacts projectOverviewSurface runbookSurface">
      <OverviewPageHeader
        title="启动方式"
        description={model.description}
        sources={<div className="overviewSourceButtons">{model.sources.slice(0, 5).map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
        status={<Badge>{model.status}</Badge>}
      />
      <OverviewSection
        title="运行环境"
        subtitle="工作目录与依赖"
        items={[
          {
            id: "directory",
            label: "工作目录",
            className: "overviewSectionItem-mono",
            content: model.context.workingDirectory,
          },
          {
            id: "requirements",
            label: "环境要求",
            content: model.context.requirements.length
              ? <OverviewTagList items={model.context.requirements} />
              : <span className="runbookEmptyValue">尚未识别</span>,
          },
        ]}
      />
      <OverviewSection
        title="启动入口"
        subtitle={`${model.readiness.startCount} 个已确认入口`}
        items={[{
          id: "start-commands",
          content: <RunbookCommandList commands={model.startCommands} copiedCommandId={copiedCommandId} copyErrorId={copyErrorId} onCopy={copyCommand} onSendToTerminal={onSendToTerminal} />,
        }]}
      />
    </section>
  );
}

function RunbookPanel({ onOpenSource, onSendToTerminal, report, snapshot }) {
  const store = buildProjectFactStore({ report, snapshot });
  const descriptors = compileRunbookSlots({ capabilityManifest: snapshot?.projectCapabilities, components: { RunbookSlot }, contract: projectRunbookContract, store });
  return descriptors.map((descriptor) => <descriptor.component key={descriptor.id} model={descriptor.props} onOpenSource={onOpenSource} onSendToTerminal={onSendToTerminal} />);
}

function ReportArtifactsPanel({ snapshot }) {
  const validationReport = snapshot?.goalValidationReport || {};
  const checks = Array.isArray(validationReport.checks) ? validationReport.checks : [];
  const passedChecks = checks.filter((check) => check.success).length;
  const reportArtifacts = [
    {
      label: "AI 工程治理报告",
      path: ".project-os/reports/ai-project-report.json",
      purpose: "结构化记录项目评分、缺口和治理建议，是可视化报告的数据源。",
      status: "治理数据",
    },
    {
      label: "Markdown 报告",
      path: ".project-os/reports/ai-project-report.md",
      purpose: "适合人工快速阅读和交接摘录。",
      status: "文本报告",
    },
    {
      label: "报告截图",
      path: ".project-os/reports/ai-project-report-preview.png",
      purpose: "用于视觉回归或把报告结果作为截图证据沉淀。",
      status: "视觉证据",
    },
    {
      label: "目标验收报告",
      path: ".project-os/goal-validation-report.json",
      purpose: "记录最近一次目标验收的检查结果，通过或失败都从这里追溯。",
      status: validationReport.status || "unknown",
    },
  ];

  return (
    <section className="reportSurface">
      <header className="runbookHero">
        <div>
          <span>可视化报告是什么</span>
          <strong>工程治理报告产物</strong>
          <p>它不是单独的漂亮页面，而是把扫描、评分、推荐、验收和视觉证据沉淀成可追溯产物。</p>
        </div>
        <Badge>{validationReport.status === "passed" ? "验收通过" : statusLabel(validationReport.status)}</Badge>
      </header>
      <div className="agentTopicPanel">
        <div className="agentTopicCard">
          <span>报告产物</span>
          <strong>{reportArtifacts.length}</strong>
        </div>
        <div className="agentTopicCard">
          <span>最近验收</span>
          <strong>{validationReport.status === "passed" ? "通过" : statusLabel(validationReport.status)}</strong>
        </div>
        <div className="agentTopicCard">
          <span>检查项</span>
          <strong>{passedChecks}/{checks.length || 0}</strong>
        </div>
      </div>
      <div className="reportArtifactList">
        {reportArtifacts.map((artifact) => (
          <article className="reportArtifactItem" key={artifact.path}>
            <header>
              <div>
                <span>{artifact.label}</span>
                <strong>{artifact.path}</strong>
              </div>
              <Badge>{artifact.status}</Badge>
            </header>
            <p>{artifact.purpose}</p>
          </article>
        ))}
      </div>
      {checks.length ? (
        <div className="agentTopicList">
          {checks.map((check) => (
            <div className="agentPatchItem" key={check.id || check.label}>
              <div className="agentPatchItemHeader">
                <div>
                  <strong>{check.label || check.id}</strong>
                  <span>{check.command}</span>
                </div>
                <Badge status={check.success ? "done" : "failed"}>{check.success ? "通过" : "失败"}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceFactsPreview({ globalOverview = false, onCreateGovernanceTask, onNavigate, onRequestProjectAccess, provider, report, snapshot, tasks = [] }) {
  const refreshProjectKey = report?.project?.path || snapshot?.currentProjectPath || snapshot?.currentProjectId || snapshot?.projectName || "current-project";
  const refreshSignature = [refreshProjectKey, ...(snapshot?.factFreshness?.changedSources || [])].filter(Boolean).join("|");
  const initialRefreshFailure = readFactRefreshFailure(refreshProjectKey);
  const hasPersistedRefreshFailure = initialRefreshFailure?.signature === refreshSignature;
  const [currentReport, setCurrentReport] = useState(report);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshState, setRefreshState] = useState(hasPersistedRefreshFailure ? "error" : "idle");
  const [refreshError, setRefreshError] = useState(hasPersistedRefreshFailure ? initialRefreshFailure.message : "");
  const [factFreshnessStatus, setFactFreshnessStatus] = useState(snapshot?.factFreshness?.status || "unknown");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(report?.generatedAt || "");
  const [autoRefreshKey, setAutoRefreshKey] = useState("");
  const overviewActionHandlersRef = useRef({});
  const overviewRuntimeRef = useRef(null);
  const overviewRuntimeStateRef = useRef(null);
  if (!overviewRuntimeRef.current) {
    overviewRuntimeRef.current = createProjectOverviewSlotRuntime({
      actions: {
        "refresh-project-facts": (...args) => overviewActionHandlersRef.current["refresh-project-facts"]?.(...args),
        "open-architecture": (...args) => overviewActionHandlersRef.current["open-architecture"]?.(...args),
        "open-source": (...args) => overviewActionHandlersRef.current["open-source"]?.(...args),
      },
      components: { ProjectOverviewHeader, ProjectOverviewSectionSlot },
    });
  }
  useEffect(() => {
    setCurrentReport(report);
    setFactFreshnessStatus(snapshot?.factFreshness?.status || "unknown");
    if (report?.generatedAt) {
      setLastRefreshedAt((current) => !current || new Date(report.generatedAt) > new Date(current) ? report.generatedAt : current);
    }
  }, [report, snapshot?.factFreshness?.status]);
  useEffect(() => {
    const persistedFailure = readFactRefreshFailure(refreshProjectKey);
    if (persistedFailure?.signature === refreshSignature) {
      setAutoRefreshKey(refreshSignature);
      setRefreshError(persistedFailure.message || "项目事实更新失败");
      setRefreshState("error");
      return;
    }
    setAutoRefreshKey("");
    setRefreshError("");
    setRefreshState("idle");
  }, [refreshProjectKey, refreshSignature]);
  useEffect(() => {
    if (globalOverview) return;
    if (snapshot?.factFreshness?.status !== "stale") return;
    const nextKey = refreshSignature;
    if (!nextKey || nextKey === autoRefreshKey) return;
    const persistedFailure = readFactRefreshFailure(refreshProjectKey);
    if (persistedFailure?.signature === nextKey) {
      setAutoRefreshKey(nextKey);
      setRefreshError(persistedFailure.message || "项目事实更新失败");
      setRefreshState("error");
      return;
    }
    setAutoRefreshKey(nextKey);
    refreshFacts();
  }, [globalOverview, refreshProjectKey, refreshSignature, snapshot?.factFreshness?.status, autoRefreshKey]);
  if (globalOverview) {
    const projects = Array.isArray(snapshot?.projects) ? snapshot.projects : [];
    const currentProject = projects.find((project) => project.isCurrent);
    const indexedActiveTasks = projects.reduce((sum, project) => sum + Number(project.activeTaskCount || 0), 0);
    const indexedFailedTasks = projects.reduce((sum, project) => sum + Number(project.failedTaskCount || 0), 0);
    const currentTasks = tasks.filter((task) => !isNoiseTask(task));
    const currentRunningTasks = currentTasks.filter((task) => task.status === taskStatuses.running);
    const currentWaitingTasks = currentTasks.filter((task) => [taskStatuses.waitingApproval, taskStatuses.planned].includes(task.status));
    const currentFailedTasks = currentTasks.filter((task) => task.status === taskStatuses.failed);
    const attentionItems = [
      ...projects.filter((project) => Number(project.failedTaskCount) > 0).map((project) => ({
        action: "处理失败任务",
        body: `${project.failedTaskCount} 个任务失败，需要检查结果并决定是否生成修复任务。`,
        project,
        tone: "danger",
        title: `${project.name} 有执行失败`,
      })),
      ...projects.filter((project) => project.health === "missing").map((project) => ({
        action: "重新定位",
        body: "项目路径已经失效，需要重新定位后才能继续读取和执行。",
        project,
        tone: "danger",
        title: `${project.name} 无法访问`,
      })),
      ...projects.filter((project) => project.health === "partial").map((project) => ({
        action: "查看项目",
        body: "项目缺少关键治理文件，可以先查看扫描结果再决定是否补齐。",
        project,
        tone: "warning",
        title: `${project.name} 需要补充信息`,
      })),
      ...currentWaitingTasks.slice(0, 2).map((task) => ({
        action: "继续任务",
        body: task.plan?.summary || task.description || "任务已准备好，等待确认后继续。",
        project: currentProject,
        target: "execution",
        tone: "info",
        title: task.title || "任务等待确认",
      })),
    ].slice(0, 4);
    const recentActivities = projects
      .filter((project) => project.latestActivityTitle)
      .sort((a, b) => String(b.latestActivityAt || "").localeCompare(String(a.latestActivityAt || "")))
      .slice(0, 5);
    const switchAndNavigate = (project, target) => {
      if (!project) return;
      if (!project.isCurrent) {
        onNavigate?.({ type: "project", id: project.id, nextTarget: target });
        return;
      }
      if (target) onNavigate?.(target);
    };
    return (
      <div className="workspaceFacts workbenchDashboard portfolioDashboard">
        <section className="portfolioCommandBar">
          <div>
            <span className="portfolioEyebrow">今日工作</span>
            <strong>{attentionItems.length ? `${attentionItems.length} 件事需要处理` : "当前没有阻塞事项"}</strong>
            <p>{projects.length} 个项目已接入，当前在 {currentProject?.name || snapshot?.projectName || "未选择项目"}。</p>
          </div>
          <div className="portfolioCommandActions">
            <Button type="button" variant="primary" onClick={() => onNavigate?.("conversation")}><MessageSquare size={15} />发起任务</Button>
            <Button type="button" variant="secondary" onClick={onRequestProjectAccess}><Plus size={15} />添加项目</Button>
          </div>
        </section>

        <section className="portfolioAttention" aria-labelledby="portfolio-attention-title">
          <header className="portfolioSectionHeader">
            <div><strong id="portfolio-attention-title">需要你处理</strong><span>按影响程度排序</span></div>
            <em>{attentionItems.length || "无"}</em>
          </header>
          {attentionItems.length ? (
            <div className="portfolioAttentionList">
              {attentionItems.map((item) => (
                <article className={`portfolioAttentionItem tone-${item.tone}`} key={`${item.project?.id}-${item.title}`}>
                  <span className="portfolioAttentionMarker" aria-hidden="true" />
                  <div><strong>{item.title}</strong><p>{item.body}</p></div>
                  <Button type="button" variant="ghost" onClick={() => switchAndNavigate(item.project, item.target)}>{item.action}<ArrowRight size={14} /></Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="portfolioClearState"><Check size={16} /><span>所有项目当前可继续推进，没有等待处理的失败或确认项。</span></div>
          )}
        </section>

        <section className="portfolioProjects">
          <header className="portfolioSectionHeader">
            <div><strong>项目</strong><span>状态、当前动作与最近进展</span></div>
            <em>{projects.length}</em>
          </header>
          <div className="portfolioProjectList">
            {projects.map((project) => {
              const needsAttention = ["missing", "partial"].includes(project.health);
              const failedCount = Number(project.failedTaskCount || 0);
              const activeCount = Number(project.activeTaskCount || 0);
              const statusText = failedCount
                ? `${failedCount} 个失败`
                : project.health === "missing"
                  ? "路径失效"
                  : project.health === "partial"
                    ? "信息不完整"
                    : activeCount
                      ? `${activeCount} 项进行中`
                      : "可继续推进";
              return (
                <button className={`portfolioProjectRow${project.isCurrent ? " active" : ""}`} key={project.id} type="button" onClick={() => switchAndNavigate(project)}>
                  <span className={`projectStatusDot${needsAttention ? ` projectStatusDot-${project.health === "missing" ? "danger" : "warning"}` : " projectStatusDot-empty"}`} aria-hidden="true" />
                  <div>
                    <span className="portfolioProjectTitle"><strong>{project.name}</strong>{project.isCurrent ? <em>当前</em> : null}</span>
                    <span>{project.latestActivityTitle || project.phase || "已接入工作台"}</span>
                  </div>
                  <span className={failedCount || needsAttention ? "portfolioProjectState attention" : "portfolioProjectState"}>{statusText}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="portfolioLowerGrid">
          <div className="portfolioAgentQueue">
            <header className="portfolioSectionHeader"><div><strong>AI 工作</strong><span>跨项目执行队列</span></div></header>
            <div className="portfolioQueueMetrics">
              <button type="button" onClick={() => onNavigate?.("execution")}><strong>{indexedActiveTasks || currentRunningTasks.length}</strong><span>进行中</span></button>
              <button type="button" onClick={() => onNavigate?.("execution")}><strong>{currentWaitingTasks.length}</strong><span>等待确认</span></button>
              <button type="button" onClick={() => onNavigate?.("execution-results")}><strong>{indexedFailedTasks || currentFailedTasks.length}</strong><span>执行失败</span></button>
            </div>
            <Button type="button" variant="secondary" onClick={() => onNavigate?.("conversation")}><MessageSquare size={15} />告诉 AI 下一步做什么</Button>
          </div>

          <div className="portfolioRecent">
            <header className="portfolioSectionHeader"><div><strong>最近活动</strong><span>只保留关键变化</span></div></header>
            {recentActivities.length ? (
              <div className="portfolioRecentList">
                {recentActivities.map((project) => (
                  <button type="button" key={project.id} onClick={() => switchAndNavigate(project)}>
                    <span className="workbenchActivityDot tone-success" aria-hidden="true" />
                    <div><strong>{project.latestActivityTitle}</strong><p>{project.name}</p></div>
                    <time>{project.latestActivityAt ? new Date(project.latestActivityAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "最近"}</time>
                  </button>
                ))}
              </div>
            ) : <p className="portfolioEmptyText">完成任务或运行检查后，关键结果会出现在这里。</p>}
          </div>
        </section>
      </div>
    );
  }
  const refreshFacts = async () => {
      setRefreshing(true);
      setRefreshError("");
      setRefreshState("loading");
      try {
        const nextReport = await refreshWorkspaceFactsPreview();
        const refreshedAt = nextReport?.generatedAt || new Date().toISOString();
        if (nextReport) setCurrentReport({ ...nextReport, generatedAt: refreshedAt });
        clearFactRefreshFailure(refreshProjectKey);
        setFactFreshnessStatus("fresh");
        setLastRefreshedAt(refreshedAt);
        setRefreshState("success");
        window.setTimeout(() => setRefreshState("idle"), 1800);
      } catch (err) {
        const message = err instanceof Error ? err.message : "项目事实更新失败";
        writeFactRefreshFailure(refreshProjectKey, { message, signature: refreshSignature });
        setRefreshError(message);
        setRefreshState("error");
      } finally {
        setRefreshing(false);
      }
  };
  const factStore = buildProjectFactStore({
    report: currentReport,
    snapshot: {
      ...snapshot,
      factFreshness: {
        ...snapshot?.factFreshness,
        status: factFreshnessStatus,
        updatedAt: lastRefreshedAt || snapshot?.factFreshness?.updatedAt,
      },
    },
  });
  overviewActionHandlersRef.current = {
    "refresh-project-facts": () => refreshFacts(),
    "open-architecture": () => onNavigate?.("system-architecture"),
    "open-source": (path) => onNavigate?.({ type: "file", path }),
  };
  const previousRuntimeState = overviewRuntimeStateRef.current;
  const projectChanged = previousRuntimeState?.store.projectId !== factStore.projectId;
  const capabilitySignature = capabilityManifestSignature(snapshot?.projectCapabilities);
  const capabilitiesChanged = previousRuntimeState?.capabilitySignature !== capabilitySignature;
  const changedFactIds = projectChanged ? factStore.facts.map((fact) => fact.id) : diffProjectFactStores(previousRuntimeState?.store, factStore);
  const runtimeResult = !previousRuntimeState || projectChanged || capabilitiesChanged
    ? { descriptors: overviewRuntimeRef.current.compile({ capabilityManifest: snapshot?.projectCapabilities, contract: projectOverviewContract, store: factStore, surface: "project-overview" }) }
    : overviewRuntimeRef.current.reconcile({
      capabilityManifest: snapshot?.projectCapabilities,
      changedFactIds,
      contract: projectOverviewContract,
      previousDescriptors: previousRuntimeState.descriptors,
      sourcePaths: snapshot?.factFreshness?.changedSources || [],
      store: factStore,
      surface: "project-overview",
    });
  const slotDescriptors = runtimeResult.descriptors;
  overviewRuntimeStateRef.current = { capabilitySignature, descriptors: slotDescriptors, store: factStore };
  return (
    <div className="workspaceFacts projectOverviewSurface">
      <ProjectOverviewSlotRenderer descriptors={slotDescriptors} refreshError={refreshError} refreshState={refreshState} refreshing={refreshing} />
    </div>
  );
}

function AgentTopicPanel({
  agentRuns = [],
  onApproveAgentRun,
  onResumeAgentRun,
  activeTaskId,
  provider,
  topic,
  tasks = [],
  snapshot,
  composerModelAvailability = {},
  runnerLoadingId,
  handoffLoading,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunGuardedCheck,
  onSelectTask,
  onMarkTaskWaiting,
  onEnsureModelAvailable,
  onCreateTask,
  onCreateGoal,
  onDeleteTask,
  onArchiveGoal,
  onMergeGoal,
  onRestoreGoal,
  onPersistTask,
  onUpdateGoal,
  onCreateRepairTask,
  onCreateGovernanceTask,
  onOpenCapabilityFile,
  onOpenTaskConversation,
  onRefreshWorkspace,
  compact = false,
}) {
  const id = topic?.id || "";
  const {
    archivingGoal, archivingTask, createGoalOpen, createTaskError, createTaskOpen,
    deletingTask, editingGoal, editingGoalSummary, editingGoalTitle, editingTask,
    editingTaskGoalId, editingTaskSummary, editingTaskTitle, goalHistoryOpen,
    mergeTargetGoalId, mergingGoal, mutationError, newGoalTitle, newTaskGoalId,
    newTaskSummary, newTaskTitle, setArchivingGoal, setArchivingTask, setCreateGoalOpen,
    setCreateTaskError, setCreateTaskOpen, setDeletingTask, setEditingGoal,
    setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
    setEditingTaskSummary, setEditingTaskTitle, setGoalHistoryOpen, setMergeTargetGoalId,
    setMergingGoal, setMutationError, setNewGoalTitle, setNewTaskGoalId, setNewTaskSummary,
    setNewTaskTitle, setTaskActionDialog, setTaskFilter, setTaskModelPreflight, setTaskSort,
    taskActionDialog, taskFilter, taskModelPreflight, taskSort,
    activeTasks, currentTask, doneTasks, failedTasks, mergeGoalOptions, recentResultTasks,
    taskGoalOptions, taskGroups, visibleTasks,
  } = boardState;
  const { activeCapabilitySpec, activeGoal, archivedGoals, archivedTasks, capabilityKind, cards, currentChecks, currentPlan, doneGoals, modelAvailable } = buildAgentTopicViewModel({
    activeGoalFromSnapshot, activeTasks, checksForPlan, composerModelAvailability, currentTask, doneTasks, failedTasks,
    goalStatusLabel: goalStatusLabelText, phaseLabel, provider, recentResultTasks, snapshot, taskNextAction, tasks, topic, visibleTasks,
  });
  if (!cards) return null;
  const {
    archiveGoal, archiveTask, executeTaskDetailAction, failedRunsForTask, failureSummaryForTask,
    mergeGoal, onArchiveGoalGroup, onMergeGoalGroup, onRepair, openCreateTaskForGoal,
    openGoalEditor, openTaskEditor, openTaskPrimaryAction, openTaskFromCard,
    permanentlyDeleteTask, restoreGoal, restoreTask, rerunFailedChecks, runChecksForTask,
    saveGoalEdit, saveTaskEdit, selectTaskInWorkspace, startTaskFromDialog,
    submitNewGoal, submitNewTask,
  } = useAgentTopicTaskActions({
    activeGoal,
    boardState,
    helpers: { checksForPlan, goalTitleForTask, isTaskNoise: isNoiseTask, taskGoalOptions },
    modelAvailable,
    onApplyPatchDraft,
    onArchiveGoal,
    onCreateGoal,
    onCreateRepairTask,
    onCreateTask,
    onDeleteTask,
    onEnsureModelAvailable,
    onGeneratePatchDraft,
    onMarkTaskWaiting,
    onMergeGoal,
    onMergeHandoff,
    onOpenTaskConversation,
    onPersistTask,
    onRefreshWorkspace,
    onRestoreGoal,
    onRunGuardedCheck,
    onSelectTask,
    onUpdateGoal,
  });

  return <AgentTopicPanelContent
    activeCapabilitySpec={activeCapabilitySpec}
    canPreviewAgentTopicFile={canPreviewAgentTopicFile}
    capabilityKind={capabilityKind}
    cards={cards}
    compact={compact}
    currentTaskDetailProps={{ currentChecks, currentPlan, currentTask, goalTitleForTask, onApplyPatchDraft, onGeneratePatchDraft, onMergeHandoff, onOpenTask: selectTaskInWorkspace, onRunChecks: runChecksForTask, taskStatusLabel }}
    executionResultsProps={{ agentRuns, failedRunsForTask, failureSummaryForTask, onApproveAgentRun, onCreateRepairTask, onOpenTask: selectTaskInWorkspace, onResumeAgentRun, onRerunFailedChecks: rerunFailedChecks, recentResultTasks, runnerLoadingId, taskStatuses, taskStatusLabel }}
    id={id}
    onOpenCapabilityFile={onOpenCapabilityFile}
    taskBoardProps={{
      archiveGoal, archiveTask, archivedGoals, archivedTasks, archivingGoal, archivingTask, createGoalOpen,
      createTaskError, createTaskOpen, deletingTask, doneGoals, editingGoal, editingGoalSummary, editingGoalTitle,
      editingTask, editingTaskGoalId, editingTaskSummary, editingTaskTitle, failureSummaryForTask, goalHistoryOpen,
      goalTitleForTask, mergeGoal, mergeGoalOptions, mergeTargetGoalId, mergingGoal, modelAvailable, mutationError,
      newGoalTitle, newTaskGoalId, newTaskSummary, newTaskTitle,
      onArchiveGoal: (group) => { setMutationError(""); setArchivingGoal(taskGoalOptions.find((goal) => goal.id === group.id) || null); },
      onArchiveTask: setArchivingTask, onCreateTask: openCreateTaskForGoal, onDeleteTask: setDeletingTask,
      onEditGoal: openGoalEditor, onEditTask: openTaskEditor,
      onMergeGoal: (group) => { const goal = mergeGoalOptions.find((item) => item.id === group.id) || null; setMutationError(""); setMergingGoal(goal); setMergeTargetGoalId(mergeGoalOptions.find((item) => item.id !== group.id)?.id || ""); },
      onPrimaryAction: openTaskPrimaryAction, onOpenTask: selectTaskInWorkspace,
      onConfirmStart: startTaskFromDialog, onExecuteDetail: executeTaskDetailAction,
      onApplyPatchDraft, onGeneratePatchDraft,
      onMergeHandoff, onRepair: (task) => { setTaskActionDialog(null); onCreateRepairTask?.(task.id); },
      onRerunFailed: rerunFailedChecks, onRestoreGoal: restoreGoal, onRestoreTask: restoreTask,
      onRunChecks: runChecksForTask, onSubmitGoal: submitNewGoal, onSubmitTask: submitNewTask,
      openTaskFromCard, permanentlyDeleteTask, primaryActionLabel: (task) => taskCardPrimaryAction(task.status).label, runnerLoadingId,
      saveGoalEdit, saveTaskEdit, setArchivingGoal, setArchivingTask, setCreateGoalOpen, setCreateTaskOpen,
      setDeletingTask, setEditingGoal, setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
      setEditingTaskSummary, setEditingTaskTitle, setGoalHistoryOpen, setMergeTargetGoalId, setNewGoalTitle,
      setNewTaskGoalId, setNewTaskSummary, setNewTaskTitle, setTaskActionDialog, setTaskFilter, setTaskSort,
      taskActionDialog, taskFilter, taskFilterLabel, taskGoalOptions, taskGroups, taskModelPreflight, taskSort,
      taskSortLabel, taskStatusLabel, taskUpdatedLabel, currentTask,
    }}
    topic={topic}
  />;
}

function EngineeringFileTab({
  selectedEngineeringFile,
  snapshot,
  tasks = [],
  activeTaskId,
  provider,
  composerModelAvailability = {},
  runnerLoadingId,
  patchLoading,
  applyLoading,
  handoffLoading,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunGuardedCheck,
  onSelectTask,
  onMarkTaskWaiting,
  onEnsureModelAvailable,
  onCreateTask,
  onCreateGoal,
  onDeleteTask,
  onArchiveGoal,
  onMergeGoal,
  onRestoreGoal,
  onNavigateWorkbench,
  onCreateRepairTask,
  onCreateGovernanceTask,
  onCreateDesignGovernanceTask,
  onPersistTask,
  onUpdateGoal,
  decomposingGoal,
  onConfirmDecomposition,
  onGenerateDecomposition,
  onRequestProjectAccess,
  onPrepareTerminalCommand,
  onOpenTaskConversation,
  onRefreshWorkspace,
  onReadEngineeringFile,
  onGetHermesExecutorStatus,
}) {
  const {
    isAcceptanceCriteriaTopic, isAgentConfigSurfaceTopic, isAssetSurfaceTopic, isCodeStructureTopic,
    isCollaborationBoundaryTopic, isComponentLibraryTopic, isCurrentGoalTopic, isCurrentProgressTopic,
    isDataContractsTopic, isDecisionRecordsTopic, isDesignImplementationTopic, isDocumentationRulesTopic,
    isExecutionPermissionsTopic, isGoalHistoryTopic, isGovernanceFilesTopic, isHandoffRecordsTopic,
    isLessonsLearnedTopic, isLocalProjectStateTopic, isMemorySurfaceTopic, isOverviewTopic,
    isReportTopic, isRiskBoundaryTopic, isRunbookTopic, isRunRecordsTopic, isSystemArchitectureTopic,
    isTaskExecutionTopic, isTokenLibraryTopic, isValidationChecksTopic, isValidationReportTopic,
    selectedTopic, surface, topicRouteId, usesDedicatedSurface,
  } = resolveEngineeringTopicSurface({ dedicatedSurfaceByTopic, selectedEngineeringFile, workspaceRouteById });
  const selectedTopicGroupLabel = selectedEngineeringFile.group === "workbench-overview"
    ? "工作台"
    : selectedEngineeringFile.group;
  const [relatedFilePreview, setRelatedFilePreview] = useState(null);
  useEffect(() => {
    setRelatedFilePreview(null);
  }, [selectedTopic?.id, selectedEngineeringFile.path]);

  const previewRelatedFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) {
      setRelatedFilePreview({
        error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。",
        path,
      });
      return;
    }
    setRelatedFilePreview({ loading: true, path });
    try {
      const preview = await onReadEngineeringFile(path);
      setRelatedFilePreview({ path, preview });
    } catch (err) {
      setRelatedFilePreview({
        error: err instanceof Error ? err.message : String(err),
        path,
      });
    }
  };

  if (selectedTopic) {
    const workspaceFacts = isOverviewTopic ? snapshot?.workspaceFacts || null : null;
    const openSourceFile = (path) => onNavigateWorkbench?.({ type: "file", path });
    const currentProgressPanel = isCurrentProgressTopic && snapshot?.workspaceFacts
      ? <CurrentProgressPanel onNavigate={onNavigateWorkbench} onOpenSource={openSourceFile} report={snapshot.workspaceFacts} snapshot={snapshot} tasks={tasks} />
      : null;
    const currentGoalPanel = isCurrentGoalTopic
      ? <CurrentGoalPanel decomposingGoal={decomposingGoal} onConfirmDecomposition={onConfirmDecomposition} onGenerateDecomposition={onGenerateDecomposition} onNavigate={onNavigateWorkbench} onOpenSource={openSourceFile} snapshot={snapshot} />
      : null;
    const acceptanceCriteriaPanel = isAcceptanceCriteriaTopic
      ? <AcceptanceCriteriaPanel onNavigate={onNavigateWorkbench} onOpenSource={openSourceFile} snapshot={snapshot} />
      : null;
    const goalHistoryPanel = isGoalHistoryTopic
      ? <GoalHistoryPanel onOpenSource={openSourceFile} snapshot={snapshot} />
      : null;
    const collaborationBoundaryPanel = isCollaborationBoundaryTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="collaboration-boundary" />
      : null;
    const executionPermissionsPanel = isExecutionPermissionsTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="execution-permissions" />
      : null;
    const documentationRulesPanel = isDocumentationRulesTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="documentation-rules" />
      : null;
    const systemArchitecturePanel = isSystemArchitectureTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="system-architecture" />
      : null;
    const dataContractsPanel = isDataContractsTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="data-contracts" />
      : null;
    const codeStructurePanel = isCodeStructureTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="code-structure" />
      : null;
    const validationChecksPanel = isValidationChecksTopic
      ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="validation-checks" />
      : null;
    const validationReportPanel = isValidationReportTopic
      ? <ValidationReportPanel onOpenSource={openSourceFile} snapshot={snapshot} />
      : null;
    const runRecordsPanel = isRunRecordsTopic
      ? <RunRecordsPanel onOpenSource={openSourceFile} snapshot={snapshot} />
      : null;
    const handoffRecordsPanel = isHandoffRecordsTopic ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="handoff-records" /> : null;
    const decisionRecordsPanel = isDecisionRecordsTopic ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="decision-records" /> : null;
    const lessonsLearnedPanel = isLessonsLearnedTopic ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type="lessons-learned" /> : null;
    const memorySurfacePanel = isMemorySurfaceTopic ? <MemorySurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type={topicRouteId} /> : null;
    const assetSurfacePanel = isAssetSurfaceTopic ? <AssetSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type={topicRouteId} /> : null;
    const agentConfigSurfacePanel = isAgentConfigSurfaceTopic ? <AgentConfigSurfacePanel onGetHermesExecutorStatus={onGetHermesExecutorStatus} onOpenSource={openSourceFile} renderSourceButtons={(callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />} type={topicRouteId} /> : null;
    const runbookPanel = isRunbookTopic && snapshot?.workspaceFacts
      ? <RunbookPanel onOpenSource={openSourceFile} onSendToTerminal={onPrepareTerminalCommand} report={snapshot.workspaceFacts} snapshot={snapshot} />
      : null;
    const riskBoundaryPanel = isRiskBoundaryTopic && snapshot?.workspaceFacts
      ? <RiskBoundaryPanel onOpenSource={openSourceFile} report={snapshot.workspaceFacts} snapshot={snapshot} />
      : null;
    const localProjectStatePanel = isLocalProjectStateTopic && snapshot?.workspaceFacts
      ? <LocalProjectStatePanel onOpenSource={openSourceFile} report={snapshot.workspaceFacts} snapshot={snapshot} />
      : null;
    const reportPanel = isReportTopic
      ? <ReportArtifactsPanel snapshot={snapshot} />
      : null;
    const governanceFilesPanel = isGovernanceFilesTopic && snapshot?.workspaceFacts
      ? <GovernanceFilesHealthSection onCreateGovernanceTask={onCreateGovernanceTask} onReadEngineeringFile={onReadEngineeringFile} report={snapshot.workspaceFacts} />
      : null;
    const designImplementationPanel = isDesignImplementationTopic && snapshot?.workspaceFacts
      ? <DesignImplementationHealthSection onCreateDesignGovernanceTask={onCreateDesignGovernanceTask} onReadEngineeringFile={onReadEngineeringFile} report={snapshot.workspaceFacts} topic={selectedTopic} />
      : null;
    const componentLibraryPanel = isComponentLibraryTopic
      ? <ComponentGovernancePanel onNavigate={onNavigateWorkbench} />
      : null;
    const tokenLibraryPanel = isTokenLibraryTopic
      ? <TokenGovernancePanel onNavigate={onNavigateWorkbench} />
      : null;
    const agentTopic = (
      <AgentTopicPanel
        agentRuns={agentRuns}
        onApproveAgentRun={onApproveAgentRun}
        onResumeAgentRun={onResumeAgentRun}
        activeTaskId={activeTaskId}
        composerModelAvailability={composerModelAvailability}
        provider={provider}
        snapshot={snapshot}
        tasks={tasks}
        topic={selectedTopic}
        runnerLoadingId={runnerLoadingId}
        handoffLoading={handoffLoading}
        onGeneratePatchDraft={onGeneratePatchDraft}
        onApplyPatchDraft={onApplyPatchDraft}
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
        onCreateRepairTask={onCreateRepairTask}
        onPersistTask={onPersistTask}
        onUpdateGoal={onUpdateGoal}
        onOpenCapabilityFile={previewRelatedFile}
        onOpenTaskConversation={onOpenTaskConversation}
        onRefreshWorkspace={onRefreshWorkspace}
        compact={isTaskExecutionTopic}
      />
    );
    const taskTitle = { "task-list": "目标与任务", "execution-terminal": "执行终端", "execution-results": "执行结果" }[topicRouteId];
    const taskDescription = { "task-list": "按目标查看任务进展与审核状态。", "execution-terminal": "在受控终端中运行命令并查看输出。", "execution-results": "查看完成或失败任务的验证结果与后续处理。" }[topicRouteId];
    const taskExecutionPanel = isTaskExecutionTopic ? <section className="overviewSurface taskExecutionSurface"><OverviewPageHeader title={taskTitle} description={taskDescription} meta={<span>任务状态变化时自动更新</span>} sources={<RuleSourceButtons onOpenSource={openSourceFile} sources={selectedTopic.relatedFiles || [".project-os/runs/desktop-tasks/*"]} />} />{agentTopic}</section> : null;
    const capabilityPanel = surface === "agent-topic" ? agentTopic : null;
    const topicBody = (
      <EngineeringTopicSurfaceComposer
        capabilityPanel={capabilityPanel}
        capabilitySupplementPanels={[currentProgressPanel, runbookPanel, reportPanel, governanceFilesPanel, designImplementationPanel, componentLibraryPanel, tokenLibraryPanel]}
        dedicatedPanels={[agentConfigSurfacePanel, assetSurfacePanel, memorySurfacePanel, taskExecutionPanel, currentGoalPanel, acceptanceCriteriaPanel, goalHistoryPanel, collaborationBoundaryPanel, executionPermissionsPanel, documentationRulesPanel, systemArchitecturePanel, dataContractsPanel, codeStructurePanel, validationChecksPanel, validationReportPanel, runRecordsPanel, handoffRecordsPanel, decisionRecordsPanel, lessonsLearnedPanel, currentProgressPanel, runbookPanel, riskBoundaryPanel, localProjectStatePanel, reportPanel, governanceFilesPanel, designImplementationPanel, componentLibraryPanel, tokenLibraryPanel]}
        fallback={<Notice variant="info">这是项目治理地图。用户只看事项，OmniDesk 在背后维护对应文件、状态来源和更新时机。</Notice>}
        isOverviewTopic={isOverviewTopic}
        overviewPanel={<WorkspaceFactsPreview globalOverview={selectedTopic.id === "workbench-overview"} onCreateGovernanceTask={onCreateGovernanceTask} onNavigate={onNavigateWorkbench} onRequestProjectAccess={onRequestProjectAccess} provider={provider} report={workspaceFacts} snapshot={snapshot} tasks={tasks} />}
        topicPanel={agentTopic}
      />
    );
    return <EngineeringTopicFrame
      isCurrentProgressTopic={isCurrentProgressTopic}
      onPreviewRelatedFile={previewRelatedFile}
      relatedFilePreview={relatedFilePreview}
      selectedTopic={selectedTopic}
      selectedTopicGroupLabel={selectedTopicGroupLabel}
      usesDedicatedSurface={usesDedicatedSurface}
    >
      {topicBody}
    </EngineeringTopicFrame>;
  }

  return (
    <Panel className="engineeringFilePreview filePreviewPanel" variant="soft">
      <ReadonlyFilePreview description={selectedEngineeringFile.description} file={selectedEngineeringFile} />
    </Panel>
  );
}

function RightRail({
  collapsed,
  onResizeStart,
  onToggleCollapsed,
  snapshot,
  tasks,
  activeTaskId,
  conversations,
  activeConversationId,
  onSelectConversation,
  onArchiveConversation,
  onDeleteConversation,
  onRestoreConversation,
  onSelectTask,
  onSendGoalToChat,
  onSendGoalToTerminal,
  onSendTaskToChat,
  onSendTaskToTerminal,
  onMarkTaskWaiting,
  onValidateGoal,
  onSignOffGoal,
  onRefineGoal,
  onCreateGoal,
  onSwitchGoal,
  onConfirmGoal,
  validatingGoal,
  signingGoal,
  planLoading,
  terminalRunningId,
}) {
  const [taskFilter, setTaskFilter] = useState("todo");
  const [historyManagementOpen, setHistoryManagementOpen] = useState(false);
  const [confirmGoalOpen, setConfirmGoalOpen] = useState(false);
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalSummary, setNewGoalSummary] = useState("");
  const { goal: activeGoal } = resolveWorkspaceContext({ activeConversationId, activeTaskId, conversations, snapshot, tasks });
  const activeGoalTaskIds = new Set(Array.isArray(activeGoal?.taskIds) ? activeGoal.taskIds : []);
  const belongsToActiveGoal = (item) => {
    if (!activeGoal?.id) return true;
    if (item.goalId) return item.goalId === activeGoal.id;
    return activeGoalTaskIds.size ? activeGoalTaskIds.has(item.id) : true;
  };
  const visibleTasks = collapseDuplicateOpenTasks(tasks.filter((task) => !isNoiseTask(task) && belongsToActiveGoal(task)));
  const conversationGroups = groupConversations(conversations);
  const activeConversationCount = conversations.filter((conversation) => !conversation.archivedAt).length;
  const activeTask = visibleTasks.find((task) => task.id === activeTaskId);
  const snapshotTodos = collapseDuplicateOpenTasks(snapshotQueueTodos(snapshot).filter(belongsToActiveGoal));
  const todoMeta = visibleTasks.length || snapshotTodos.length;
  const goalTodos = visibleTasks.length
    ? visibleTasks.map((task) => ({
        description: task.plan?.summary || task.projectName || "",
        displayStatus: taskDisplayStatus(task, { activeTaskId, planLoading, terminalRunningId }),
        conversationId: task.conversationId || "",
        goalId: task.goalId || "",
        id: task.id,
        status: taskDisplayStatus(task, { activeTaskId, planLoading, terminalRunningId }),
        subtasks: taskSubtasks(task),
        task,
        title: task.title,
      }))
    : snapshotTodos.map((task) => ({
        ...task,
        subtasks: taskSubtasks(task),
      }));
  const progressValue = progressFromTodos(goalTodos);
  const doneCount = goalTodos.filter((todo) => todo.status === taskStatuses.done).length;
  const runningCount = goalTodos.filter((todo) => todo.status === taskStatuses.running || todo.status === taskStatuses.waitingApproval).length;
  const pendingCount = Math.max(goalTodos.length - doneCount - runningCount, 0);
  const goalTitle = activeGoal?.shortTitle || activeGoal?.title || snapshot.stage || snapshot.projectName || "当前项目";
  const validationGoal = snapshot.goalValidation?.goal || {};
  const validationReportStatus = snapshot.goalValidationReport?.status || "missing";
  const validationStatus = goalValidationStatusFromActiveGoal(activeGoal, validationGoal, validationReportStatus);
  const goalMeta = runningCount || (activeGoal?.status === "planned" && goalTodos.length)
    ? "进行中"
    : goalMetaFromStatus(activeGoal?.status || validationStatus, validationReportStatus, goalTodos, snapshot.phase);
  const openTodos = goalTodos.filter((todo) => todo.status !== taskStatuses.done);
  const doneTodos = goalTodos.filter((todo) => todo.status === taskStatuses.done);
  const displayedTodos = taskFilter === "all"
    ? goalTodos
    : taskFilter === "done"
      ? doneTodos
      : openTodos;
  const taskFilterLabel = {
    all: "全部",
    done: "已完成",
    todo: "待办",
  }[taskFilter];
  const taskFilterCount = displayedTodos.length;
  const goalNeedsVerification = goalTodos.length > 0 && goalTodos.every((todo) => todo.status === taskStatuses.done);
  const validationCriteria = Array.isArray(snapshot.goalValidation?.criteria)
    ? snapshot.goalValidation.criteria
    : [];
  const goalSignedOff = validationStatus === "signed-off";
  const goalVerified = validationStatus === "verified";
  const hasActiveWorkGoal = Boolean(activeGoal) && !goalSignedOff;
  const viewingCompletedGoal = false;
  const showGoalDetail = hasActiveWorkGoal;
  const visibleGoalTodos = displayedTodos;
  const currentDialogueTaskIds = new Set([
    "dialogue-context-state",
    "dialogue-context-assembler",
    "dialogue-grounded-answer-contract",
    "dialogue-reference-action-loop",
    "dialogue-multiturn-evaluation",
  ]);
  const currentPhaseTodos = visibleGoalTodos.filter((todo) => currentDialogueTaskIds.has(todo.id));
  const futurePhaseTodos = visibleGoalTodos.filter((todo) => !currentDialogueTaskIds.has(todo.id));
  const useDialoguePhaseGroups = currentPhaseTodos.length > 1;
  const visibleTaskFilterLabel = useDialoguePhaseGroups ? "当前阶段" : viewingCompletedGoal ? "记录" : taskFilterLabel;
  const visibleTaskFilterCount = useDialoguePhaseGroups ? currentPhaseTodos.length : visibleGoalTodos.length;
  const goalIsDraft = activeGoal?.status === "draft";
  const goalIsPlanned = activeGoal?.status === "planned" && !goalTodos.length;
  const goalSteps = goalTodos.length
    ? [`完成 ${doneCount}`, `进行 ${runningCount}`, `待办 ${pendingCount}`]
    : ["暂无任务", "等待拆解", "待确认"];
  const profileItems = projectProfileItems(snapshot);
  const recordedProfileCount = profileItems.filter((item) => !item.missing).length;
  const submitNewGoal = (event) => {
    event.preventDefault();
    const title = newGoalTitle.trim();
    if (!title) return;
    onCreateGoal?.({
      title,
      summary: newGoalSummary.trim(),
    });
    setNewGoalOpen(false);
    setNewGoalTitle("");
    setNewGoalSummary("");
  };

  if (collapsed) {
    return (
      <aside className="right right-collapsed" aria-label="右侧状态栏已折叠">
        <div className="collapsedRail collapsedRail-right">
          <Tooltip content={`目标 ${progressValue}%`}>
            <button className="collapsedRailItem active" type="button" onClick={onToggleCollapsed} aria-label={`目标 ${progressValue}%`}>
              <span className="collapsedProgress">{progressValue}</span>
            </button>
          </Tooltip>
          <Tooltip content={`任务 ${todoMeta}`}>
            <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label={`任务 ${todoMeta}`}>
              <ClipboardList strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="展开状态栏">
            <Button className="railToggleButton sideCornerButton" size="icon" variant="ghost" type="button" onClick={onToggleCollapsed} aria-label="展开状态栏">
              <PanelRightOpen strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="right">
      <div className="rightScroll">
        <RailDisclosure title="目标">
          <div className="goalStack">
            {showGoalDetail ? (
              <div className="goalProgress">
                <div className="goalProgressHeader">
                  <strong>
                    <span>{compactGoalTitle(goalTitle)}</span>
                    <em>{viewingCompletedGoal ? "已完成" : goalMeta}</em>
                  </strong>
                </div>
                <div className="goalProgressBar" aria-hidden="true">
                  <span style={{ width: `${progressValue}%` }} />
                </div>
                <div className="goalSteps">
                  {goalSteps.map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
                {viewingCompletedGoal ? (
                  <div className="goalVerifyNotice">
                    <span>这是已完成目标的历史记录。</span>
                  </div>
                ) : goalIsDraft ? (
                  <div className="goalVerifyNotice">
                    <span>这个目标还没有确认。确认后，我会先生成任务拆解草案。</span>
                    <div className="goalVerifyActions">
                      <Button size="sm" variant="primary" type="button" onClick={() => activeGoal?.id && onConfirmGoal?.(activeGoal.id)}>
                        确认目标
                      </Button>
                    </div>
                  </div>
                ) : goalIsPlanned ? (
                  <div className="goalVerifyNotice">
                    <span>目标已确认。下一步生成任务拆解草案，确认拆解后进入进行中。</span>
                    <div className="goalVerifyActions">
                      <Button size="sm" variant="primary" type="button">
                        生成拆解
                      </Button>
                    </div>
                  </div>
                ) : goalNeedsVerification ? (
                  <div className="goalVerifyNotice">
                    <span>
                      {goalVerified ? "验证已通过。你可以继续打磨，也可以确认完成。" : "任务已完成，等待验收。"}
                      {validationCriteria.length ? ` 验收标准 ${validationCriteria.length} 项。` : ""}
                    </span>
                    {goalVerified ? (
                      <div className="goalVerifyActions">
                        <Button size="sm" variant="subtle" type="button" onClick={onRefineGoal}>
                          继续打磨
                        </Button>
                        <Dialog open={confirmGoalOpen} onOpenChange={setConfirmGoalOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="primary" type="button" disabled={signingGoal}>
                              {signingGoal ? "确认中" : "确认完成"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent
                            className="goalConfirmDialog"
                            title="确认这个阶段完成？"
                            description="系统会记录当前验收结果和完成时间，后续工作将从新的目标或下一轮打磨继续。"
                          >
                            <div className="goalConfirmActions">
                              <DialogClose asChild>
                                <Button size="sm" variant="default" type="button">取消</Button>
                              </DialogClose>
                              <Button
                                size="sm"
                                variant="primary"
                                type="button"
                                disabled={signingGoal}
                                onClick={async () => {
                                  await onSignOffGoal?.();
                                  setConfirmGoalOpen(false);
                                }}
                              >
                                {signingGoal ? "确认中" : "确认完成"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : (
                      <button type="button" onClick={onValidateGoal} disabled={validatingGoal}>
                        {validatingGoal ? "验证中" : "验证目标"}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="goalEmptyState">
                <span>暂无进行中目标，请&nbsp;</span>
                <button className="goalEmptyAction" type="button" onClick={() => setNewGoalOpen(true)}>
                  <Plus strokeWidth={2.2} aria-hidden="true" />
                  添加目标
                </button>
              </div>
            )}
            <Dialog open={newGoalOpen} onOpenChange={setNewGoalOpen}>
              <DialogContent
                className="goalCreateDialog"
                title="开始一个新目标"
                description="新目标会先保存为草案，确认目标和拆解后才进入进行中。"
              >
                <form className="goalCreateForm" onSubmit={submitNewGoal}>
                  <Field label="目标名称">
                    {({ id }) => (
                      <Input
                        id={id}
                        autoFocus
                        value={newGoalTitle}
                        onChange={(event) => setNewGoalTitle(event.target.value)}
                        placeholder="例如：打磨对话体验"
                      />
                    )}
                  </Field>
                  <Field label="说明">
                    {({ id }) => (
                      <Input
                        id={id}
                        value={newGoalSummary}
                        onChange={(event) => setNewGoalSummary(event.target.value)}
                        placeholder="可选：这个阶段想达到什么结果"
                      />
                    )}
                  </Field>
                  <div className="goalConfirmActions">
                    <DialogClose asChild>
                      <Button size="sm" variant="default" type="button">取消</Button>
                    </DialogClose>
                    <Button size="sm" variant="primary" type="submit" disabled={!newGoalTitle.trim()}>
                      创建目标
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            {showGoalDetail ? (
              <>
                <div className="goalTaskHeader">
                  {useDialoguePhaseGroups ? <span>当前阶段</span> : <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="goalTaskFilter" type="button">
                        <span>任务拆解 · {compactGoalTitle(goalTitle)} · {visibleTaskFilterLabel}</span>
                        <ChevronDown strokeWidth={2} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="goalTaskFilterMenu">
                      <DropdownMenuItem onSelect={() => setTaskFilter("todo")}>待办</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTaskFilter("all")}>全部</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTaskFilter("done")}>已完成</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                  <span>{useDialoguePhaseGroups ? currentPhaseTodos.length : visibleTaskFilterCount}</span>
                </div>
                {visibleGoalTodos.length ? (
                  <>
                  <ol className="goalTodoList">
                    {(useDialoguePhaseGroups ? currentPhaseTodos : visibleGoalTodos).map((todo, index) => (
                      <GoalTaskItem
                        active={todo.id === activeTaskId}
                        displayStatus={todo.displayStatus}
                        index={index}
                        key={todo.id}
                        status={todo.status}
                        taskStatuses={taskStatuses}
                        subtasks={todo.subtasks}
                        title={todo.title}
                        onSelect={() => onSelectTask(todo.id)}
                        detail={todo.id === activeTaskId ? (
                          <TaskRailDetail
                            task={todo.task || todo}
                            onMarkTaskWaiting={onMarkTaskWaiting}
                            onSendTaskToChat={onSendTaskToChat}
                            onSendTaskToTerminal={onSendTaskToTerminal}
                          />
                        ) : null}
                      />
                    ))}
                  </ol>
                  {useDialoguePhaseGroups && futurePhaseTodos.length ? (
                    <details className="goalFutureTasks">
                      <summary><span>后续任务</span><em>{futurePhaseTodos.length}</em></summary>
                      <ol className="goalTodoList">
                        {futurePhaseTodos.map((todo, index) => (
                          <GoalTaskItem
                            active={todo.id === activeTaskId}
                            index={currentPhaseTodos.length + index}
                            key={todo.id}
                            status={todo.status}
                            taskStatuses={taskStatuses}
                            title={todo.title}
                            onSelect={() => onSelectTask(todo.id)}
                            detail={todo.id === activeTaskId ? (
                              <TaskRailDetail
                                task={todo.task || todo}
                                onMarkTaskWaiting={onMarkTaskWaiting}
                                onSendTaskToChat={onSendTaskToChat}
                                onSendTaskToTerminal={onSendTaskToTerminal}
                              />
                            ) : null}
                          />
                        ))}
                      </ol>
                    </details>
                  ) : null}
                  </>
                ) : (
                  <div className="goalEmpty">{viewingCompletedGoal ? "还没有任务记录。" : taskFilter === "done" ? "还没有完成任务。" : "当前没有待办任务。"}</div>
                )}
              </>
            ) : null}
          </div>
        </RailDisclosure>

        <RailDisclosure
          className="railHistory"
          title="对话"
          meta={
            <span className="railSectionActions">
              <em>{activeConversationCount}</em>
              <Tooltip content="历史管理">
              <Button
                aria-label="对话历史管理"
                className="sectionIconAction"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setHistoryManagementOpen(true)}
              >
                <MoreVertical strokeWidth={1.8} aria-hidden="true" />
              </Button>
              </Tooltip>
            </span>
          }
        >
          <div className="queue">
            {conversationGroups.length ? (
              conversationGroups.map((group) => (
                <div className="conversationHistoryGroup" key={group.label}>
                  {conversationGroups.length > 1 ? (
                    <div className="conversationHistoryGroupLabel">{group.label}</div>
                  ) : null}
                  {group.items.map((conversation) => (
                    <ConversationHistoryItem
                      active={conversation.id === activeConversationId}
                      conversation={conversation}
                      key={conversation.id}
                      onArchiveConversation={onArchiveConversation}
                      onDeleteConversation={onDeleteConversation}
                      onRestoreConversation={onRestoreConversation}
                      onSelectConversation={onSelectConversation}
                    />
                  ))}
                </div>
              ))
            ) : (
              <Notice variant="muted">没有匹配的对话。</Notice>
            )}
          </div>
        </RailDisclosure>

        <Dialog open={historyManagementOpen} onOpenChange={setHistoryManagementOpen}>
          <DialogContent title="历史管理" description="这里只显示已归档对话；归档可恢复，永久删除的对话不会保留记录。">
            <div className="conversationHistoryManagement">
              {conversations.filter((conversation) => conversation.archivedAt).map((conversation) => (
                <ConversationHistoryItem
                  active={false}
                  conversation={conversation}
                  key={conversation.id}
                  onArchiveConversation={onArchiveConversation}
                  onDeleteConversation={onDeleteConversation}
                  onRestoreConversation={onRestoreConversation}
                  onSelectConversation={onSelectConversation}
                />
              ))}
              {!conversations.some((conversation) => conversation.archivedAt) ? <Notice variant="info">暂无已归档对话。</Notice> : null}
            </div>
            <div className="taskCreateActions">
              <DialogClose asChild><Button type="button" variant="subtle">关闭</Button></DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        <RailDisclosure className="contextSection" title="项目档案" meta={`${recordedProfileCount}/${profileItems.length}`}>
          <div className="contextPack">
            {profileItems.map((item) => (
              <ProjectProfileItem body={item.body} missing={item.missing} title={item.title} key={item.title} />
            ))}
          </div>
        </RailDisclosure>
      </div>
      <Tooltip content="折叠状态栏">
        <Button className="sideCornerButton sideCornerButton-right" size="icon" variant="ghost" type="button" onClick={onToggleCollapsed} aria-label="折叠状态栏">
          <PanelRightClose strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>
      <div className="sidebarResizer sidebarResizer-right" role="separator" aria-label="拖拽调整右侧宽度" onPointerDown={onResizeStart} />
    </aside>
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
  const { composerModelTesting, composerModelTests, composerModels, composerModelsKey, composerModelsLoading, composerModelsSource, modelCatalog, provider, providerError, setComposerModelTesting, setComposerModelTests, setComposerModels, setComposerModelsKey, setComposerModelsLoading, setComposerModelsSource, setModelCatalog, setProvider, setProviderError } = useProviderSession({ fallbackModelCatalog, fallbackProvider });
  const [projectActionError, setProjectActionError] = useState("");
  const [agentRuns, setAgentRuns] = useState([]);
  const { applyError, applyLoading, handoffError, handoffLoading, patchError, patchLoading, planError, planLoading, runnerError, runnerLoadingId, setApplyError, setApplyLoading, setHandoffError, setHandoffLoading, setPatchError, setPatchLoading, setPlanError, setPlanLoading, setRunnerError, setRunnerLoadingId } = useExecutionSession();
  const { activeTerminalSessionId, appendContextToTerminal, appendTerminalLog, closeTerminalSession, newTerminalSession, openNativeTerminal, resetTerminalSessionState, resizeTerminalSession, restartTerminalSession, setActiveTerminalSessionId, setTerminalRunningId, terminalChunks, terminalError, terminalLogs, terminalRunningId, terminalSession, terminalSessions, terminalText, writeTerminalData } = useTerminalSession({
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

  useEffect(() => {
    let active = true;
    executionClient.listAgentRuns().then((runs) => {
      if (!active) return;
      const records = Array.isArray(runs) ? runs : [];
      setAgentRuns(records.filter((run) => !snapshot?.currentProjectId || run.projectId === snapshot.currentProjectId));
    }).catch(() => { if (active) setAgentRuns([]); });
    return () => { active = false; };
  }, [snapshot?.currentProjectId, snapshot?.currentProjectPath, source]);

  const resumeAgentRun = async (run) => {
    try {
      const result = await executionClient.resumeHermesAgent(run);
      const records = await executionClient.listAgentRuns();
      setAgentRuns((Array.isArray(records) ? records : []).filter((item) => !snapshot?.currentProjectId || item.projectId === snapshot.currentProjectId));
      return result;
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : String(error_));
      return null;
    }
  };

  const approveAgentRun = async (run) => {
    try {
      const result = await executionClient.approveHermesAgent(run);
      const records = await executionClient.listAgentRuns();
      setAgentRuns((Array.isArray(records) ? records : []).filter((item) => !snapshot?.currentProjectId || item.projectId === snapshot.currentProjectId));
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
  const requestProjectAccess = () => window.dispatchEvent(new Event("project-os:request-project-access"));

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
    onOpenConversation: () => window.dispatchEvent(new Event("project-os:open-conversation")),
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
        />
    )}
    agentWorkspace={(
        <AgentWorkspace
          snapshot={snapshot}
          activeTaskId={activeTaskId}
          agentRuns={agentRuns}
          onApproveAgentRun={approveAgentRun}
          onResumeAgentRun={resumeAgentRun}
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

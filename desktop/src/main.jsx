import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Activity, AlertTriangle, ArrowLeftRight, ArrowRight, Brain, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, ClipboardList, Eraser, FileText, Loader2, MessageSquare, MoreVertical, Package, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Play, Plus, RotateCcw, Server, ShieldAlert, Square, Target, TerminalSquare, X } from "lucide-react";
import { ChatComposer } from "./components/workbench/chat-composer";
import { Conversation, ConversationMessage } from "./components/workbench/conversation";
import { InfoCallout } from "./components/workbench/info-callout";
import { ProviderStatusRow } from "./components/workbench/provider-status-row";
import { SystemSettingsMenu } from "./components/workbench/system-settings-menu";
import { TaskCard } from "./components/workbench/task-card";
import { TaskCommandBar } from "./components/workbench/task-command-bar";
import { ThemeMenu } from "./components/workbench/theme-menu";
import { WorkspaceTree } from "./components/workbench/workspace-tree";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Tooltip, TooltipProvider } from "./components/ui/tooltip";
import { projectGovernanceOutline } from "./workspace-outline";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";

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
    { label: "DESKTOP_APP.md", depth: 2, kind: "file" },
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
    checks: ["bash scripts/check-runtime.sh ."],
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

const guardedChecks = [
  { id: "runtime", label: "Runtime", command: "bash scripts/check-runtime.sh ." },
  { id: "doc-structure", label: "Docs", command: "bash scripts/check-doc-structure.sh ." },
  { id: "recommend", label: "Recommend", command: "bash scripts/recommend-next.sh ." },
  { id: "ai-project", label: "AI Project", command: "bash scripts/check-ai-project.sh . --write-report" },
  { id: "web-build", label: "Web Build", command: "cd desktop && npm run web:build" },
  { id: "cargo-check", label: "Cargo", command: "cd desktop/src-tauri && cargo check" },
];

async function loadWorkspaceSnapshot() {
  if (!isTauriRuntime()) {
    return loadPreviewWorkspaceSnapshot();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_workspace_snapshot");
}

async function refreshWorkspaceFactsPreview() {
  if (!isTauriRuntime()) {
    return loadPreviewJson("/.project-os/workspace-facts.json", null);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("refresh_workspace_facts_preview");
}

async function runGoalValidationCheck() {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/run-goal-validation", { method: "POST" });
    if (!response.ok) {
      throw new Error("目标验收运行失败。");
    }
    await response.json();
    return loadPreviewWorkspaceSnapshot();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("run_goal_validation");
}

async function signOffGoalValidation() {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/sign-off-goal", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "目标签收失败。");
    }
    await response.json();
    return loadPreviewWorkspaceSnapshot();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("sign_off_goal_validation");
}

async function createWorkspaceGoal(input) {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/create-goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "目标创建失败。");
    }
    await response.json();
    return loadPreviewWorkspaceSnapshot();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("create_goal", { input });
}

async function switchWorkspaceGoal(input) {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/switch-goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "目标切换失败。");
    }
    await response.json();
    return loadPreviewWorkspaceSnapshot();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("switch_active_goal", { input });
}

async function switchPreviewProject(id) {
  const response = await fetch("/__project-os/switch-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "项目切换失败。");
  }
  return loadPreviewWorkspaceSnapshot();
}

async function relocatePreviewProject(id, path) {
  const response = await fetch("/__project-os/relocate-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, path }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "路径更新失败。");
  }
  return loadPreviewWorkspaceSnapshot();
}

async function confirmWorkspaceGoal(input) {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/confirm-goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "目标确认失败。");
    }
    await response.json();
    return loadPreviewWorkspaceSnapshot();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("confirm_goal", { input });
}

async function deleteProviderProfilePreview(profileId) {
  const response = await fetch("/__project-os/delete-provider-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "删除连接失败。");
  }
  return payload;
}

async function copyTextToSystemClipboard(text) {
  const canUseDevClipboard =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

  if (!canUseDevClipboard && isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("copy_text_to_clipboard", { text });
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
    })) : fallbackSnapshot.projects,
    queue,
    goalValidation,
    goalValidationReport,
    goalSignoffHistory,
    goals,
    projectProfile,
    workspaceFacts,
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

async function loadProviderStatus() {
  if (!isTauriRuntime()) {
    return loadPreviewProviderStatus();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_provider_status");
}

async function loadModelCatalog() {
  if (!isTauriRuntime()) {
    return loadPreviewJson("/.project-os/model-catalog.json", fallbackModelCatalog);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_model_catalog");
}

async function loadModelHealth() {
  if (!isTauriRuntime()) {
    return loadPreviewJson("/.project-os/model-health.json", {
      schemaVersion: "project-os.model-health.v0.1",
      entries: [],
    });
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_model_health");
}

async function loadDesktopTasks() {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/desktop-tasks");
    if (!response.ok) return [];
    return response.json();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("list_desktop_tasks");
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

async function loadPreviewProviderStatus() {
  const config = await loadPreviewJson("/.project-os/desktop-provider.json", fallbackProvider);
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  return {
    ...fallbackProvider,
    ...config,
    hasApiKey: false,
    profiles: profiles.map((profile) => ({ ...profile, hasApiKey: false })),
  };
}

async function invokeWorkspaceCommand(command, payload) {
  if (!isTauriRuntime()) {
    if (command === "read_engineering_file") {
      const response = await fetch("/__project-os/read-engineering-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload?.input || payload || {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "读取文件失败。");
      }
      return result;
    }
    if (command === "run_project_os_action") {
      const response = await fetch("/__project-os/run-project-os-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload?.input || payload || {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "治理动作执行失败。");
      }
      return result;
    }
    throw new Error("当前是浏览器预览，只能查看界面；请在桌面 App 窗口里保存配置。");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(command, payload);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function persistDesktopTask(task) {
  if (!isTauriRuntime()) {
    const response = await fetch("/__project-os/save-desktop-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "保存任务失败。");
    }
    return response.json();
  }
  return invokeWorkspaceCommand("save_desktop_task", { input: { task } });
}

async function pickProjectDirectory() {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式暂不支持系统目录选择器");
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  return open({
    directory: true,
    multiple: false,
    title: "新建或选择要加入 OmniDesk 的项目目录",
  });
}

function TopBar({
  snapshot,
  source,
  error,
  provider,
  modelCatalog,
  onSaveProvider,
  onSaveProviderSecret,
  onDeleteProviderProfile,
  providerError,
  onStartConversation,
}) {
  const providerButtonLabel = activeProviderProfileName(provider) || "连接";
  return (
    <header className="topbar">
        <div className="brand">
        <div className="mark" aria-hidden="true">
          <span className="markGlyph" />
        </div>
        <div>
          <div className="brandTitle">OmniDesk</div>
          <div className="brandSubtitle">超级个人工作台</div>
        </div>
      </div>
      <div className="topActions">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="modelStatusButton" variant="subtle" type="button" aria-label="连接设置">
              <span className="dot mutedDot" />
              {providerButtonLabel}
            </Button>
          </DialogTrigger>
          <DialogContent
            className="providerDialog"
            title="模型设置"
            description="配置 OmniDesk 调用的大模型、API Key 和网关地址。"
          >
            <ProviderPanel
              provider={provider}
              modelCatalog={modelCatalog}
              source={source}
              onSaveProvider={onSaveProvider}
              onSaveProviderSecret={onSaveProviderSecret}
              onDeleteProviderProfile={onDeleteProviderProfile}
              providerError={providerError}
            />
          </DialogContent>
        </Dialog>
        <ThemeMenu />
        <SystemSettingsMenu />
        <Tooltip content="开始一段新的对话">
          <Button variant="primary" type="button" onClick={onStartConversation}>
            <Plus className="buttonIcon" strokeWidth={2.25} aria-hidden="true" />
            新对话
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}

function ProjectSidebar({ collapsed, onResizeStart, onToggleCollapsed, snapshot, tasks = [], projectActivities = {}, planLoading, terminalRunningId, onSwitchProject, onPickProject, onOpenProjectFolder, onRelocateProject, onRenameProject, onRemoveProject, onSelectEngineeringFile, onProjectActionError, onProjectActivitySeen, onProjectPathCopied, projectActionError, selectedEngineeringFile }) {
  const [renameProject, setRenameProject] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState("workspace");
  const [fileTreeExpanded, setFileTreeExpanded] = useState(true);

  const openRenameDialog = (project) => {
    setRenameProject(project);
    setRenameName(project.name);
  };

  const submitRename = async (event) => {
    event.preventDefault();
    if (!renameProject) return;
    const ok = await onRenameProject(renameProject.id, renameName);
    if (ok) {
      setRenameProject(null);
      setRenameName("");
    }
  };

  const copyProjectPath = async (projectPath) => {
    let systemCopyError = null;
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = projectPath;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!copied) throw new Error("浏览器拒绝写入剪贴板");
    };

    try {
      try {
        await copyTextToSystemClipboard(projectPath);
      } catch (err) {
        systemCopyError = err;
        if (!navigator.clipboard?.writeText) {
          fallbackCopy();
        } else {
          try {
            await navigator.clipboard.writeText(projectPath);
          } catch {
            fallbackCopy();
          }
        }
      }
      onProjectActionError?.("");
      onProjectPathCopied?.(projectPath);
      return true;
    } catch (err) {
      const message = systemCopyError instanceof Error
        ? systemCopyError.message
        : err instanceof Error
          ? err.message
          : String(err);
      onProjectActionError?.(`复制路径失败：${message}`);
      return false;
    }
  };

  useEffect(() => {
    const handleCopyProjectPath = (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-copy-project-path]") : null;
      if (!target) return;
      const projectPath = target.getAttribute("data-copy-project-path") || "";
      if (!projectPath) return;
      copyProjectPath(projectPath);
    };
    document.addEventListener("click", handleCopyProjectPath, true);
    return () => document.removeEventListener("click", handleCopyProjectPath, true);
  }, []);

  const projectTasks = (project) => tasks.filter((task) => {
    if (task.projectId && task.projectId === project.id) return true;
    if (task.projectPath && task.projectPath === project.path) return true;
    if (task.projectName && task.projectName === project.name) return true;
    return false;
  });

  const projectRuntimeStatus = (project) => {
    const relatedTasks = projectTasks(project);
    if ((project.isCurrent && planLoading) || relatedTasks.some((task) => task.id === terminalRunningId)) {
      return { tone: "running", label: "进行中" };
    }
    if (relatedTasks.some((task) => [taskStatuses.failed, "interrupted", "canceled", "cancelled", "error"].includes(task.status))) {
      return { tone: "danger", label: "任务或会话中断" };
    }
    const cachedActivity = projectActivities[project.id];
    if (cachedActivity?.tone) {
      return cachedActivity;
    }
    if (project.health === "ready") return { tone: "", label: project.statusLabel || "已就绪" };
    if (project.health === "missing") return { tone: "danger", label: project.statusLabel || "路径失效" };
    if (project.health === "partial") return { tone: "warning", label: project.statusLabel || "缺少关键文件" };
    return { tone: "", label: project.statusLabel || "普通项目" };
  };

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
        <SectionGroup
          className="leftRailSection"
            title="项目"
            meta={snapshot.projects.length}
            open={projectsOpen}
            onToggle={() => setProjectsOpen((value) => !value)}
            toggleLabel={projectsOpen ? "收起项目" : "展开项目"}
            actions={(
              <Tooltip content="添加项目">
                <button className="sectionIconAction projectAddHeaderButton" type="button" onClick={onPickProject} aria-label="添加项目">
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
                      const runtimeStatus = projectRuntimeStatus(project);
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
            setRenameName("");
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
                  onChange={(event) => setRenameName(event.target.value)}
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

        {sidebarView === "workspace" ? (
          <WorkspaceTree
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
            outline={projectGovernanceOutline}
            snapshot={snapshot}
          />
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

function ProjectFileTree({ activePath, expanded, snapshot, onSelectFile }) {
  const [query, setQuery] = useState("");
  const [openFolders, setOpenFolders] = useState({});
  const [closedFolders, setClosedFolders] = useState({});
  const tree = Array.isArray(snapshot?.tree) ? snapshot.tree : [];
  const stack = [];
  const rows = tree.map((item, index) => {
    const depth = Number.isFinite(item.depth) ? item.depth : 0;
    const parentPath = depth <= 1 ? "" : stack[depth - 1] || "";
    const path = depth === 0 ? "" : [parentPath, item.label].filter(Boolean).join("/");
    stack[depth] = path;
    stack.length = depth + 1;
    return {
      ...item,
      depth,
      id: `${path || item.label}-${index}`,
      path,
    };
  });
  const normalizedQuery = query.trim().toLowerCase();
  const isFolderOpen = (path) => (expanded ? !closedFolders[path] : Boolean(openFolders[path]));
  const visibleByFolder = (item) => {
    if (item.depth <= 1) return true;
    const parts = item.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      const folderPath = parts.slice(0, index).join("/");
      if (!isFolderOpen(folderPath)) return false;
    }
    return true;
  };
  const visibleRows = normalizedQuery
    ? rows.filter((item) => `${item.label} ${item.path}`.toLowerCase().includes(normalizedQuery))
    : rows.filter(visibleByFolder);

  return (
    <section className="projectFileTree" aria-label="项目文件">
      <div className="projectFileSearch">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选文件..."
          aria-label="筛选文件"
        />
      </div>
      <div className="projectFileTreeList">
        {visibleRows.map((item) => {
          const isFolder = item.kind === "folder";
          const isActive = !isFolder && activePath === item.path;
          const isOpen = isFolder && isFolderOpen(item.path);
          return (
            <button
              className={`projectFileTreeRow${isFolder ? " folder" : " file"}${isActive ? " active" : ""}${isOpen ? " open" : ""}`}
              key={item.id}
              type="button"
              style={{ "--tree-depth": Math.max(item.depth - 1, 0) }}
              onClick={() => {
                if (isFolder) {
                  if (expanded) {
                    setClosedFolders((current) => ({ ...current, [item.path]: !current[item.path] }));
                  } else {
                    setOpenFolders((current) => ({ ...current, [item.path]: !current[item.path] }));
                  }
                  return;
                }
                if (!item.path) return;
                onSelectFile?.({
                  description: "当前项目文件",
                  group: "项目文件",
                  path: item.path,
                });
              }}
              title={item.path || item.label}
            >
              <span className="projectFileTreeChevron" aria-hidden="true">
                {isFolder ? <ChevronRight strokeWidth={2} /> : null}
              </span>
              <span className="projectFileTreeName">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function createTaskFromPlan(plan, taskText, snapshot, options = {}) {
  const title = taskText?.trim() || plan?.summary || "未命名任务";
  const activeGoal = activeGoalFromSnapshot(snapshot);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: title.length > 48 ? `${title.slice(0, 48)}...` : title,
    status: taskStatuses.planned,
    createdAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    projectId: snapshot.currentProjectId || "",
    conversationId: options.conversationId || "",
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
  }[status] || status || "待确认";
}

function checksForPlan(plan) {
  const checks = Array.isArray(plan?.checks) ? plan.checks : [];
  return guardedChecks.filter((check) =>
    checks.some((item) => item.includes(check.command) || item.includes(check.id) || item.includes(check.label))
  );
}

function previewChatResult(message, hasAttachments, snapshot = {}, tasks = []) {
  const normalized = message.trim().replace(/[。！？!?,，\s]/g, "").toLowerCase();
  const lowerMessage = message.toLowerCase();
  const explicitTask = [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
    "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
    "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
  ].some((keyword) => lowerMessage.includes(keyword));
  const greeting = ["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(normalized);
  const questionLike = [
    "为什么", "怎么", "哪些", "还有哪些", "是什么", "吗", "呢", "看一下", "看看",
    "检查当前项目还有哪些风险", "有哪些风险",
  ].some((keyword) => message.includes(keyword));
  const shouldCreatePlan = explicitTask || (hasAttachments && !questionLike);
  const riskLike = message.includes("风险") || lowerMessage.includes("risk");
  const statusLike = /状态|进度|下一步|总结|概况|现在/.test(message);
  const developLike = /开发|改代码|实现|任务|执行|patch|检查|构建|验证/.test(lowerMessage);
  const visibleTasks = Array.isArray(tasks) ? tasks.filter((task) => !isNoiseTask(task)) : [];
  const activeTasks = visibleTasks.filter((task) => ![taskStatuses.done, taskStatuses.failed].includes(task.status));
  const failedTasks = visibleTasks.filter((task) => task.status === taskStatuses.failed);
  const doneTasks = visibleTasks.filter((task) => task.status === taskStatuses.done);
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const validationStatus = snapshot?.goalValidationReport?.status || "待生成";
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
  return {
    intent: shouldCreatePlan ? "task" : questionLike ? "question" : "chat",
    reply: shouldCreatePlan
      ? "可以，我整理成一个可执行计划。"
      : greeting
        ? "你好，我在。"
        : riskLike
          ? "主要风险有三类：交接记录可能继续膨胀；对话和执行状态容易混在一起；模型或检查失败时反馈还不够像人话。我建议先把普通问答和执行任务彻底分开，再打磨失败提示。"
          : statusLike
            ? statusReply
            : developLike
              ? developReply
              : "我可以直接回答项目问题；如果你说“帮我改/实现/优化”，我会先生成任务计划，再进入受控开发流程。",
    shouldCreatePlan,
  };
}

function isActionRequestMessage(message, hasAttachments = false) {
  const lowerMessage = safeDisplayText(message).toLowerCase();
  const actionLike = [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
    "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
    "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
  ].some((keyword) => lowerMessage.includes(keyword));
  return actionLike || hasAttachments;
}

function isExecutionWorkspaceTab(tab, actionMode) {
  if (tab.id === "plan" || tab.kind === "terminal" || tab.kind === "file") return true;
  return actionMode;
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
      actions.push({ id: "open-topic", label: "查看任务队列", target: "task-queue" });
    }
    if (!actions.length) {
      actions.push({ id: "open-topic", label: "打开工作台", target: "workbench-overview" });
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

function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_METADATA__);
}

function projectScopedStorageKey(snapshot, suffix) {
  const projectKey = snapshot?.currentProjectId || snapshot?.currentProjectPath || snapshot?.projectName || "current";
  return `omnidesk.${suffix}.${projectKey}`;
}

function cleanTerminalText(value) {
  let text = safeDisplayText(value);
  text = text
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-Z\\-_]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  while (text.includes("\b")) {
    const next = text.replace(/[^\n]\x08/g, "").replace(/^\x08/gm, "");
    if (next === text) break;
    text = next;
  }

  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function conversationTitle(turns) {
  const firstUser = turns.find((turn) => turn.role === "user");
  const title = cleanConversationText(firstUser?.text) || "新对话";
  return compactConversationText(title, 24);
}

function conversationPreview(turns) {
  const meaningful = [...turns]
    .reverse()
    .map((turn) => cleanConversationText(turn.text))
    .find((text) => text && !isLowSignalConversationText(text));
  return compactConversationText(meaningful || "暂无内容", 52);
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

function catalogModelsForProvider(provider, modelCatalog) {
  const providers = Array.isArray(modelCatalog?.providers) ? modelCatalog.providers : [];
  const preset =
    providers.find((item) => item.apiBase === provider?.apiBase && item.apiKeyEnv === provider?.apiKeyEnv) ||
    providers.find((item) => item.id === provider?.profileId || item.id === provider?.activeProfileId);
  const models = Array.isArray(preset?.models) ? preset.models.filter(Boolean) : [];
  const current = provider?.model ? [provider.model] : [];
  return Array.from(new Set([...models, ...current]));
}

function activeProviderProfileName(provider) {
  const activeProfile = provider?.profiles?.find((profile) => profile.id === provider?.activeProfileId);
  return activeProfile?.name || provider?.profileName || provider?.apiBase || "当前 API";
}

function providerConnectionLabel(profile) {
  return profile?.name || profile?.apiBase || "未命名连接";
}

function visibleConversationPreview(conversation) {
  const title = cleanConversationText(conversation?.title);
  const preview = cleanConversationText(conversation?.preview);
  if (!preview || preview === title || isLowSignalConversationText(preview)) return "";
  return compactConversationText(preview, 34);
}

function groupedConversations(conversations) {
  const groups = [];
  const today = conversations.filter(Boolean);
  if (today.length) {
    groups.push({ label: "今天", items: today });
  }
  return groups;
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
    init: "初始化",
    stabilizing: "收口中",
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
  const goals = Array.isArray(snapshot.goals?.goals) ? snapshot.goals.goals : [];
  if (!goals.length) return null;
  return goals.find((goal) => goal.id === snapshot.goals?.activeGoalId) || goals[0];
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

const executionTabs = [
  { id: "execution", title: "执行", kind: "execution", closable: false },
];

function workspaceFileTabId(file) {
  if (file?.virtual) return `topic:${file.id || file.title || file.path || "preview"}`;
  return `file:${file?.path || file?.preview?.path || file?.topic?.title || "preview"}`;
}

function topicItemKey({ child, item, node }) {
  return [node?.id || node?.title, child?.id || child?.title, item?.id || item?.title].filter(Boolean).join("/");
}

function topicPayloadFromOutline(targetId) {
  for (const node of projectGovernanceOutline) {
    if (node.id === targetId || node.title === targetId) {
      return {
        description: node.description,
        group: node.title,
        governanceRole: node.governanceRole,
        id: node.id,
        maturity: node.maturity,
        nextAction: node.nextAction,
        path: node.id || node.title,
        relatedFiles: node.files || [],
        statusSource: node.statusSource,
        title: node.title,
        updatesWhen: node.updatesWhen,
        virtual: true,
      };
    }
    for (const child of node.children || []) {
      if (child.id === targetId || child.title === targetId) {
        return {
          description: child.description,
          group: child.title || node.title,
          governanceRole: child.governanceRole || node.governanceRole,
          id: child.id,
          maturity: child.maturity || node.maturity,
          nextAction: child.nextAction || node.nextAction,
          path: child.id || child.title,
          relatedFiles: child.files || [],
          statusSource: child.statusSource || node.statusSource,
          title: child.title,
          updatesWhen: child.updatesWhen || node.updatesWhen,
          virtual: true,
        };
      }
      for (const item of child.items || []) {
        if (item.id === targetId || item.title === targetId) {
          return {
            description: item.description,
            group: child.title || node.title,
            governanceRole: item.governanceRole || child.governanceRole || node.governanceRole,
            id: item.id,
            maturity: item.maturity || child.maturity || node.maturity,
            nextAction: item.nextAction || child.nextAction || node.nextAction,
            path: topicItemKey({ child, item, node }),
            relatedFiles: item.relatedFiles || [],
            statusSource: item.statusSource || child.statusSource || node.statusSource,
            title: item.title,
            updatesWhen: item.updatesWhen || child.updatesWhen || node.updatesWhen,
            virtual: true,
          };
        }
      }
    }
    for (const item of node.items || []) {
      if (item.id === targetId || item.title === targetId) {
        return {
          description: item.description,
          group: node.title,
          governanceRole: item.governanceRole || node.governanceRole,
          id: item.id,
          maturity: item.maturity || node.maturity,
          nextAction: item.nextAction || node.nextAction,
          path: topicItemKey({ item, node }),
          relatedFiles: item.relatedFiles || [],
          statusSource: item.statusSource || node.statusSource,
          title: item.title,
          updatesWhen: item.updatesWhen || node.updatesWhen,
          virtual: true,
        };
      }
    }
  }
  return null;
}

function AgentWorkspace({
  snapshot,
  selectedEngineeringFile,
  chatTurns,
  terminalLogs,
  terminalRunningId,
  terminalText,
  terminalChunks,
  terminalSession,
  terminalError,
  loading,
  error,
  readonlyPlan,
  activeTask,
  tasks,
  planLoading,
  planError,
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
  onConfirmTask,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunChatAction,
  onRunGuardedCheck,
  onRunTerminalCheck,
  onRunTerminalCommand,
  onWriteTerminalData,
  onResizeTerminalSession,
  onRestartTerminalSession,
  onProfileUpdated,
  onStopPlan,
  provider,
  composerModelAvailability,
  composerModelOptions,
  composerModelsLoading,
  composerModelsSource,
  composerModelTesting,
  onLoadComposerModels,
  onSelectComposerModel,
  onTestComposerModel,
  goalRefinementMode,
  onSelectEngineeringFile,
  onSelectConversation,
  onSelectTask,
  onCreateRepairTask,
  onCreateGovernanceTask,
  onCreateDesignGovernanceTask,
}) {
  const [taskInput, setTaskInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [pendingTurn, setPendingTurn] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("plan");
  const [workspaceTabs, setWorkspaceTabs] = useState([
    { id: "plan", title: "对话", kind: "conversation", closable: false },
    { id: "terminal", title: "终端", kind: "terminal", closable: false },
  ]);
  const composerRef = React.useRef(null);
  const activeRequestRef = React.useRef(null);
  const actionMode = Boolean(activeTask || readonlyPlan);
  const isConversationEmpty = !chatTurns.length && !activeTask && !readonlyPlan && !loading && !error && !pendingTurn && !chatLoading;

  useEffect(() => {
    setTaskInput("");
    setAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      return [];
    });
    setPendingTurn(null);
    activeRequestRef.current = null;
      onChatTurnsChange([]);
      setActiveWorkspaceTab("plan");
      setWorkspaceTabs((current) => current.filter((tab) => tab.kind !== "file"));
    composerRef.current?.focus();
  }, [conversationResetKey]);

  useEffect(() => {
    if (selectedEngineeringFile) {
      const tabId = workspaceFileTabId(selectedEngineeringFile);
      const title =
        selectedEngineeringFile.preview?.name ||
        selectedEngineeringFile.topic?.title ||
        (selectedEngineeringFile.virtual ? selectedEngineeringFile.title : "") ||
        selectedEngineeringFile.path ||
        "文件";
      setWorkspaceTabs((current) => {
        const nextTab = {
          file: selectedEngineeringFile,
          id: tabId,
          title,
          kind: "file",
          closable: true,
        };
        return current.some((tab) => tab.id === tabId)
          ? current.map((tab) => (tab.id === tabId ? { ...tab, ...nextTab } : tab))
          : [...current, nextTab];
      });
      setActiveWorkspaceTab(tabId);
    } else {
      if (activeTask || readonlyPlan) {
        ensureExecutionTabs();
        setActiveWorkspaceTab("execution");
      } else {
        setActiveWorkspaceTab("plan");
      }
    }
  }, [selectedEngineeringFile, activeTask, readonlyPlan]);

  const closeWorkspaceTab = (event, tabId) => {
    event.preventDefault();
    event.stopPropagation();
    const tab = workspaceTabs.find((item) => item.id === tabId);
    if (!tab?.closable) return;
    setWorkspaceTabs((current) => current.filter((item) => item.id !== tabId));
    if (activeWorkspaceTab === tabId) {
      setActiveWorkspaceTab("plan");
    }
  };

  const addImageFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    const nextAttachments = await Promise.all(
      files.map(async (file) => ({
        dataUrl: await readFileAsDataUrl(file),
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID?.() || Date.now()}`,
        name: file.name || "截图",
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }))
    );
    setAttachments((current) => [
      ...current,
      ...nextAttachments,
    ]);
  };

  const handlePaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    addImageFiles(files);
  };

  const removeAttachment = (id) => {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id);
      if (attachment) URL.revokeObjectURL(attachment.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const useStarterPrompt = (prompt) => {
    setTaskInput(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const ensureExecutionTabs = () => {
    setWorkspaceTabs((current) => [
      ...current,
      ...executionTabs.filter((tab) => !current.some((item) => item.id === tab.id)),
    ]);
  };

  const navigateWorkbench = (target) => {
    if (!target) return;
    if (target === "conversation") {
      setActiveWorkspaceTab("plan");
      return;
    }
    if (target === "terminal") {
      setActiveWorkspaceTab("terminal");
      return;
    }
    if (target === "execution") {
      if (!actionMode) {
        const topic = topicPayloadFromOutline("project-progress");
        if (topic) onSelectEngineeringFile?.(topic);
        return;
      }
      ensureExecutionTabs();
      setActiveWorkspaceTab("execution");
      return;
    }
    if (typeof target === "object" && target.type === "file" && target.path) {
      onSelectEngineeringFile?.({
        description: "来自工作台活动的工程文件。",
        path: target.path,
      });
      return;
    }
    const topic = topicPayloadFromOutline(target);
    if (topic) {
      onSelectEngineeringFile?.(topic);
    }
  };

  const openCurrentProgress = () => {
    setWorkspaceTabs((current) => {
      const progressTab = current.find((tab) =>
        tab.kind === "file" &&
        (tab.title === "当前进度" || tab.file?.topic?.id === "project-progress")
      );
      if (progressTab) setActiveWorkspaceTab(progressTab.id);
      return current;
    });
  };

  useEffect(() => {
    if (actionMode) {
      ensureExecutionTabs();
    }
  }, [actionMode]);

  useEffect(() => {
    const openExecution = () => {
      ensureExecutionTabs();
      setActiveWorkspaceTab("execution");
    };
    window.addEventListener("project-os:open-execution", openExecution);
    return () => window.removeEventListener("project-os:open-execution", openExecution);
  }, []);

  const submitTask = async (event) => {
    event.preventDefault();
    const nextInput = taskInput.trim();
    if (!nextInput && !attachments.length) return;
    const submittedAttachments = attachments.map((attachment) => ({
      dataUrl: attachment.dataUrl,
      id: attachment.id,
      mimeType: attachment.type,
      name: attachment.name,
      url: attachment.url,
    }));
    const userTurn = {
      attachments: submittedAttachments,
      id: `${Date.now()}-user`,
      role: "user",
      text: nextInput || "请根据截图帮我分析并修改。",
    };
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    activeRequestRef.current = requestId;
    setTaskInput("");
    setAttachments([]);
    onChatTurnsChange([...chatTurns, userTurn]);
    const profilePatches = profilePatchesFromMessage(nextInput);
    if (profilePatches.length && isTauriRuntime()) {
      invokeWorkspaceCommand("update_project_profile_from_conversation", {
        input: { patches: profilePatches },
      })
        .then((nextSnapshot) => onProfileUpdated?.(nextSnapshot))
        .catch(() => {});
    }
    setChatLoading(true);

    let chatResult;
    try {
      if (!isTauriRuntime()) {
        chatResult = previewChatResult(nextInput, submittedAttachments.length > 0, snapshot, tasks);
      } else {
        chatResult = await invokeWorkspaceCommand("chat_with_model", {
          input: {
            attachments: submittedAttachments.map((attachment) => ({
              dataUrl: attachment.dataUrl,
              mimeType: attachment.mimeType,
              name: attachment.name,
            })),
            message: nextInput,
          },
        });
      }
    } catch (err) {
      chatResult = {
        intent: "chat",
        reply: `我现在先按本地规则回答。模型对话暂时不可用：${err instanceof Error ? err.message : String(err)}`,
        shouldCreatePlan: false,
      };
    } finally {
      if (activeRequestRef.current === requestId) {
        setChatLoading(false);
      }
    }

    if (activeRequestRef.current !== requestId) {
      submittedAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      return;
    }

    const shouldCreatePlan = Boolean(chatResult?.shouldCreatePlan) || isActionRequestMessage(nextInput, submittedAttachments.length > 0);

    if (!shouldCreatePlan) {
      onChatTurnsChange([
        ...chatTurns,
        userTurn,
        {
          id: `${Date.now()}-assistant`,
          actions: actionPromptsForMessage(nextInput, chatResult?.intent),
          role: "assistant",
          text: safeDisplayText(chatResult?.reply, "我在。你可以继续说想做什么。"),
        },
      ]);
      submittedAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      return;
    }

    setPendingTurn({
      attachments: submittedAttachments,
      showUser: false,
      text: nextInput || "请根据截图帮我分析并修改。",
    });
    ensureExecutionTabs();
    onGeneratePlan({
      attachments: submittedAttachments.map((attachment) => ({
        dataUrl: attachment.dataUrl,
        mimeType: attachment.mimeType,
        name: attachment.name,
      })),
      conversationId: activeConversationId,
      requestId,
      task: nextInput || "请根据截图帮我分析并修改。",
    }).then((ok) => {
      if (activeRequestRef.current !== requestId) return;
      if (ok) {
        onChatTurnsChange([
          ...chatTurns,
          userTurn,
          {
            id: `${Date.now()}-assistant-plan`,
            actions: [{ id: "confirm-active-task", label: "开始执行" }],
            role: "assistant",
            text: "我已经生成计划并创建任务。确认后会进入执行状态。",
          },
        ]);
        setPendingTurn(null);
        submittedAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      }
    }).catch(() => {
      if (activeRequestRef.current !== requestId) return;
      setPendingTurn(null);
      submittedAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
    });
  };

  const stopCurrentResponse = () => {
    activeRequestRef.current = null;
    setChatLoading(false);
    setPendingTurn(null);
    onStopPlan?.();
  };

  return (
    <Tabs className="center" value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab}>
      <TabsList className="tabs" aria-label="工作区视图">
        {workspaceTabs.filter((tab) => isExecutionWorkspaceTab(tab, actionMode)).map((tab) => {
          const tabTitle = tab.kind === "execution" && (activeTask || readonlyPlan)
            ? `任务：${compactGoalTitle(activeTask?.title || readonlyPlan?.task || readonlyPlan?.summary || "详情")}`
            : tab.title;
          return (
          <TabsTrigger className={`tab workspaceTab ${tab.kind === "file" ? "fileTab" : ""}${tab.closable ? " closable" : ""}`} key={tab.id} value={tab.id}>
            <span>{tabTitle}</span>
            {tab.closable ? (
              <button
                aria-label={`关闭 ${tabTitle}`}
                className="workspaceTabClose"
                type="button"
                onClick={(event) => closeWorkspaceTab(event, tab.id)}
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </TabsTrigger>
        );})}
      </TabsList>

      <TabsContent className="workspaceTabContent agentCanvas" value="plan">
        {isConversationEmpty ? (
          <div className="conversationStart">
            <h2>有什么新点子？</h2>
            <div className="conversationStarters" aria-label="建议任务">
              {chatStarterPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => useStarterPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Conversation>
            {chatTurns.map((turn) => (
              <ConversationMessage key={turn.id} role={turn.role}>
                <div>{safeDisplayText(turn.text)}</div>
                {turn.actions?.length ? (
                  <div className="conversationActions">
                    {turn.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => onRunChatAction?.(action)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {turn.attachments?.length ? (
                  <div className="conversationAttachmentGrid">
                    {turn.attachments.map((attachment) => (
                      <figure className="conversationAttachment" key={attachment.id}>
                        <img src={attachment.url} alt={attachment.name} />
                        <figcaption>{attachment.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </ConversationMessage>
            ))}

            {loading || error ? (
              <ConversationMessage
                meta={loading ? "连接中" : error ? "需要检查" : snapshot.phase}
                role="assistant"
                title="OmniDesk"
              >
                {loading
                  ? "正在连接本地工作区。"
                  : error
                    ? `本地能力暂时不可用：${error}`
                    : null}
              </ConversationMessage>
            ) : null}

            {activeTask || readonlyPlan ? (
              <ConversationMessage
                meta={activeTask ? activeTask.status : "计划已生成"}
                role="assistant"
                title="OmniDesk"
              >
                {activeTask
                  ? "我整理好了下一步，详情放在「执行」里。你确认后我再继续动手。"
                  : "我整理好了下一步，详情放在「执行」里。"}
                {planError ? <Notice className="planError" variant="danger">{planError}</Notice> : null}
                {activeTask?.status === taskStatuses.planned ? (
                  <div className="conversationActions">
                    <button type="button" onClick={() => onConfirmTask?.(activeTask.id)}>
                      开始执行
                    </button>
                  </div>
                ) : null}
              </ConversationMessage>
            ) : null}

          {pendingTurn || chatLoading ? (
            <>
              {pendingTurn && pendingTurn.showUser !== false ? (
                <ConversationMessage role="user">
                  <div>{safeDisplayText(pendingTurn.text)}</div>
                  {pendingTurn.attachments?.length ? (
                    <div className="conversationAttachmentGrid">
                      {pendingTurn.attachments.map((attachment) => (
                        <figure className="conversationAttachment" key={attachment.id}>
                          <img src={attachment.url} alt={attachment.name} />
                          <figcaption>{attachment.name}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </ConversationMessage>
              ) : null}
              <ConversationMessage className="conversationMessage-thinking" role="assistant" title="OmniDesk">
                <div className="thinkingStage">
                  <span className="thinkingStageDot" aria-hidden="true" />
                  <span>{pendingTurn ? "整理计划" : "理解问题"}</span>
                </div>
              </ConversationMessage>
            </>
          ) : null}

          </Conversation>
        )}
      </TabsContent>

      {workspaceTabs.filter((tab) => tab.id !== "plan" && isExecutionWorkspaceTab(tab, actionMode)).map((tab) => {
        if (tab.kind === "file") {
          return (
            <TabsContent className="workspaceTabContent fileCanvas" key={tab.id} value={tab.id}>
              <EngineeringFileTab
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
                onNavigateWorkbench={navigateWorkbench}
                onCreateRepairTask={onCreateRepairTask}
                onCreateGovernanceTask={onCreateGovernanceTask}
                onCreateDesignGovernanceTask={onCreateDesignGovernanceTask}
              />
            </TabsContent>
          );
        }
        if (tab.kind === "terminal") {
          return (
            <TabsContent className="workspaceTabContent terminalWorkspace" key={tab.id} value={tab.id}>
              <TerminalDock
                active={activeWorkspaceTab === tab.id}
                logs={terminalLogs}
                runningId={terminalRunningId}
                onRunCheck={onRunTerminalCheck}
                onRunCommand={onRunTerminalCommand}
                onWriteTerminalData={onWriteTerminalData}
                onResizeTerminalSession={onResizeTerminalSession}
                onRestartTerminalSession={onRestartTerminalSession}
                text={terminalText}
                chunks={terminalChunks}
                session={terminalSession}
                error={terminalError}
              />
            </TabsContent>
          );
        }
        if (tab.kind === "execution") {
          return (
            <TabsContent className="workspaceTabContent agentCanvas executionWorkspace" key={tab.id} value={tab.id}>
              {activeTask ? (
                <ActiveTask
                  task={activeTask}
                  runnerLoadingId={runnerLoadingId}
                  runnerError={runnerError}
                  patchLoading={patchLoading}
                  patchError={patchError}
                  applyLoading={applyLoading}
                  applyError={applyError}
                  handoffLoading={handoffLoading}
                  handoffError={handoffError}
                  onGeneratePatchDraft={onGeneratePatchDraft}
                  onApplyPatchDraft={onApplyPatchDraft}
                  onMergeHandoff={onMergeHandoff}
                  onRunGuardedCheck={onRunGuardedCheck}
                  onSelectConversation={onSelectConversation}
                  onBackToProgress={openCurrentProgress}
                />
              ) : readonlyPlan ? (
                <ReadonlyPlan plan={readonlyPlan} />
              ) : (
                <Notice variant="muted">生成计划后，执行详情会显示在这里。</Notice>
              )}
            </TabsContent>
          );
        }
        if (tab.kind === "diff") {
          return (
            <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" key={tab.id} value={tab.id}>
              <Notice variant="muted">生成改动后，会在这里预览。</Notice>
            </TabsContent>
          );
        }
        if (tab.kind === "checks") {
          return (
            <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" key={tab.id} value={tab.id}>
              <Notice variant="muted">运行检查会在确认计划后显示可执行项。</Notice>
            </TabsContent>
          );
        }
        if (tab.kind === "trace") {
          return (
            <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" key={tab.id} value={tab.id}>
              <div className="terminal conversationTerminal">
                {snapshot.trace.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </TabsContent>
          );
        }
        return null;
      })}

      {activeWorkspaceTab === "plan" ? (
        <ChatDock
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
          planLoading={planLoading}
          taskInput={taskInput}
        />
      ) : null}
    </Tabs>
  );
}

function ChatDock({
  attachments,
  chatLoading,
  composerRef,
  onFilesSelected,
  onInputChange,
  onPaste,
  onRemoveAttachment,
  onStop,
  onSubmit,
  onVoiceInput,
  currentModel,
  modelAvailability,
  modelLabel,
  modelLoading,
  modelOptions,
  modelProfile,
  modelSource,
  modelTesting,
  onLoadComposerModels,
  onSelectComposerModel,
  onTestComposerModel,
  goalRefinementMode,
  planLoading,
  taskInput,
}) {
  const placeholder = goalRefinementMode
    ? "说说哪里还不满意，比如交互、视觉、文案、流程或结果..."
    : "问项目情况、描述想法，或说要改什么...";
  const draftText = safeDisplayText(taskInput).toLowerCase();
  const actionDraft = isActionRequestMessage(taskInput, attachments.length > 0);
  const modeHint = planLoading || chatLoading
    ? "正在处理：你可以继续补充要求，也可以停止生成。"
    : actionDraft
      ? "开发模式：会先生成任务计划，确认后才会改文件。"
      : draftText.trim()
        ? "问答模式：先回答问题，不会改文件。"
        : "普通问题直接回答；开发需求会进入任务、Patch 和验证流程。";

  return (
    <section className="chatDock" aria-label="对话输入">
      <ChatComposer
        attachments={attachments}
        inputRef={composerRef}
        disabled={false}
        onFilesSelected={onFilesSelected}
        onChange={onInputChange}
        onPaste={onPaste}
        onRemoveAttachment={onRemoveAttachment}
        onStop={onStop}
        onSubmit={onSubmit}
        onVoiceInput={onVoiceInput}
        currentModel={currentModel}
        modelAvailability={modelAvailability}
        modelLabel={modelLabel}
        modelLoading={modelLoading}
        modelOptions={modelOptions}
        modelProfile={modelProfile}
        modelSource={modelSource}
        modelTesting={modelTesting}
        modeHint={modeHint}
        onModelMenuOpen={onLoadComposerModels}
        onModelSelect={onSelectComposerModel}
        onModelTest={onTestComposerModel}
        placeholder={placeholder}
        sending={planLoading || chatLoading}
        value={taskInput}
      />
    </section>
  );
}

function TerminalDock({
  active = true,
  logs,
  runningId,
  onRunCheck,
  onRunCommand,
  onWriteTerminalData,
  onResizeTerminalSession,
  onRestartTerminalSession,
  text,
  chunks,
  session,
  error,
}) {
  const terminalHostRef = React.useRef(null);
  const xtermRef = React.useRef(null);
  const fitAddonRef = React.useRef(null);
  const writeDataRef = React.useRef(onWriteTerminalData);
  const resizeSessionRef = React.useRef(onResizeTerminalSession);
  const writtenChunkCountRef = React.useRef(0);
  const lastSizeRef = React.useRef({ cols: 0, rows: 0 });
  const isRunning = Boolean(runningId);

  useEffect(() => {
    writeDataRef.current = onWriteTerminalData;
  }, [onWriteTerminalData]);

  useEffect(() => {
    resizeSessionRef.current = onResizeTerminalSession;
  }, [onResizeTerminalSession]);

  const syncTerminalSize = React.useCallback(() => {
    if (!xtermRef.current || !fitAddonRef.current) return;
    try {
      fitAddonRef.current.fit();
      const cols = xtermRef.current.cols;
      const rows = xtermRef.current.rows;
      if (!cols || !rows) return;
      if (cols === lastSizeRef.current.cols && rows === lastSizeRef.current.rows) return;
      lastSizeRef.current = { cols, rows };
      resizeSessionRef.current?.(cols, rows);
    } catch {
      // Ignore fit races while the panel is settling.
    }
  }, []);

  useEffect(() => {
    if (!terminalHostRef.current || xtermRef.current) return undefined;

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      disableStdin: false,
      fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: {
        background: "#050908",
        black: "#101716",
        blue: "#7ea7ff",
        brightBlack: "#66706f",
        brightBlue: "#a9c2ff",
        brightCyan: "#8ee8d3",
        brightGreen: "#7ce4b0",
        brightMagenta: "#d7b7ff",
        brightRed: "#ff9a87",
        brightWhite: "#f4fbf8",
        brightYellow: "#ffe09a",
        cursor: "#35e6aa",
        cyan: "#68d8c2",
        foreground: "#d7e3df",
        green: "#35d892",
        magenta: "#c8a5ff",
        red: "#ff846f",
        selectionBackground: "#214238",
        white: "#d7e3df",
        yellow: "#ffd680",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalHostRef.current);
    terminal.focus();
    terminal.onData((data) => {
      writeDataRef.current(data);
    });
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    requestAnimationFrame(syncTerminalSize);

    window.addEventListener("resize", syncTerminalSize);
    return () => {
      window.removeEventListener("resize", syncTerminalSize);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      writtenChunkCountRef.current = 0;
      lastSizeRef.current = { cols: 0, rows: 0 };
    };
  }, [syncTerminalSize]);

  useEffect(() => {
    if (!xtermRef.current) return;
    const nextChunks = Array.isArray(chunks) ? chunks.slice(writtenChunkCountRef.current) : [];
    nextChunks.forEach((chunk) => xtermRef.current.write(chunk.data || ""));
    writtenChunkCountRef.current = Array.isArray(chunks) ? chunks.length : 0;
  }, [chunks]);

  useEffect(() => {
    if (!xtermRef.current || !session) return;
    xtermRef.current.reset();
    writtenChunkCountRef.current = Array.isArray(chunks) ? chunks.length : 0;
    try {
      requestAnimationFrame(syncTerminalSize);
      xtermRef.current.focus();
    } catch {
      // Ignore focus/fit races during hot reload.
    }
  }, [session, syncTerminalSize]);

  useEffect(() => {
    if (!active || !xtermRef.current) return;
    requestAnimationFrame(() => {
      syncTerminalSize();
      xtermRef.current?.focus();
    });
  }, [active, syncTerminalSize]);

  const clearTerminal = () => {
    xtermRef.current?.clear();
    writtenChunkCountRef.current = Array.isArray(chunks) ? chunks.length : 0;
    requestAnimationFrame(() => xtermRef.current?.focus());
  };

  return (
    <section className="terminalDock" aria-label="终端">
      <div className="terminalDockHeader">
        <Tooltip content={session?.cwd || "终端"}>
          <div className="terminalSessionTabs" role="tablist" aria-label="终端会话">
            <button className="terminalSessionTab active" type="button" role="tab" aria-selected="true">
              <TerminalSquare aria-hidden="true" />
              <span>main</span>
            </button>
          </div>
        </Tooltip>
        <div className="terminalDockActions">
          <Tooltip content="新建会话">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={onRestartTerminalSession} aria-label="新建终端会话">
              <Plus strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="清空屏幕">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={clearTerminal} aria-label="清空终端屏幕">
              <Eraser strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="停止当前命令">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={() => onWriteTerminalData("\u0003")} aria-label="停止当前命令">
              <Square strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="重启终端">
            <Button className="terminalIconButton" size="icon" type="button" variant="ghost" onClick={onRestartTerminalSession} aria-label="重启终端">
              <RotateCcw strokeWidth={2} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="terminal terminalDockOutput terminalDockXterm" ref={terminalHostRef} />
      {error ? <Notice className="terminalNotice" variant="danger">{error}</Notice> : null}
    </section>
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

function GovernanceFilesHealthSection({ onCreateGovernanceTask, report }) {
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
      const preview = await invokeWorkspaceCommand("read_engineering_file", {
        input: { path },
      });
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
      {governanceFile ? (
        <div className="workspaceGovernancePreview">
          <div className="engineeringFileHeader">
            <div>
              <strong>{governanceFile.path}</strong>
              <p>工程文件只读预览</p>
            </div>
            {governanceFile.preview ? <Badge>{governanceFile.preview.language}</Badge> : null}
          </div>
          {governanceFile.loading ? (
            <Notice variant="info">正在读取文件内容...</Notice>
          ) : governanceFile.error ? (
            <Notice variant="danger">{governanceFile.error}</Notice>
          ) : governanceFile.preview ? (
            <>
              <div className="engineeringFileMeta">
                <span>{formatBytes(governanceFile.preview.size)}</span>
                {governanceFile.preview.truncated ? <span>已截断</span> : <span>完整预览</span>}
              </div>
              <pre className="engineeringFileCode">{governanceFile.preview.content || "文件为空。"}</pre>
            </>
          ) : null}
        </div>
      ) : null}
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
    files: ["docs/CODE_STRUCTURE.md", "desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"],
    task: "审阅实现结构",
  },
};

function DesignImplementationHealthSection({ onCreateDesignGovernanceTask, report, topic }) {
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
      const preview = await invokeWorkspaceCommand("read_engineering_file", {
        input: { path },
      });
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
      {previewFile ? (
        <div className="workspaceGovernancePreview">
          <div className="engineeringFileHeader">
            <div>
              <strong>{previewFile.path}</strong>
              <p>工程文件只读预览</p>
            </div>
            {previewFile.preview ? <Badge>{previewFile.preview.language}</Badge> : null}
          </div>
          {previewFile.loading ? (
            <Notice variant="info">正在读取文件内容...</Notice>
          ) : previewFile.error ? (
            <Notice variant="danger">{previewFile.error}</Notice>
          ) : previewFile.preview ? (
            <>
              <div className="engineeringFileMeta">
                <span>{formatBytes(previewFile.preview.size)}</span>
                {previewFile.preview.truncated ? <span>已截断</span> : <span>完整预览</span>}
              </div>
              <pre className="engineeringFileCode">{previewFile.preview.content || "文件为空。"}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CurrentProgressPanel({ report, snapshot, tasks = [], onSelectTask }) {
  const [activeFocus, setActiveFocus] = useState("");
  const [progressFilePreview, setProgressFilePreview] = useState(null);
  const activeGoal = activeGoalFromSnapshot(snapshot);
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const backlogItems = Array.isArray(snapshot?.taskBacklog?.items) ? snapshot.taskBacklog.items : [];
  const summary = report?.summary?.currentProgress || {};
  const currentProgressDomain = (Array.isArray(report?.governanceDomains) ? report.governanceDomains : [])
    .find((domain) => domain.id === "current-progress" || domain.title === "当前进度");
  const allTasks = tasks.filter((task) => !isNoiseTask(task));
  const openTasks = allTasks.filter((task) => ![taskStatuses.done, taskStatuses.failed].includes(task.status));
  const doneTasks = allTasks.filter((task) => task.status === taskStatuses.done);
  const failedTasks = allTasks.filter((task) => task.status === taskStatuses.failed);
  const backlogDone = backlogItems.filter((item) => item.status === "done");
  const backlogOpen = backlogItems.filter((item) => item.status !== "done");
  const taskTotal = allTasks.length || backlogItems.length;
  const taskDone = doneTasks.length || backlogDone.length;
  const progressValue = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
  const phaseText = phaseLabel(snapshot?.phase || report?.project?.lifecycle);
  const goalStatus = activeGoal ? goalStatusLabelText(activeGoal.status) : phaseText;
  const recentDone = [
    ...doneTasks.slice(0, 3).map((task) => ({
      id: task.id,
      title: task.title,
      meta: task.runSummary?.path || task.updatedAt || task.createdAt || "已完成",
      task,
    })),
    ...backlogDone.slice(0, Math.max(0, 3 - doneTasks.length)).map((item) => ({
      id: item.id,
      title: item.title,
      meta: item.completedAt || item.updatedAt || "已完成",
    })),
  ].slice(0, 4);
  const nextItems = [
    ...openTasks.slice(0, 4).map((task) => ({
      id: task.id,
      title: task.title,
      meta: taskStatusLabel(task.status),
      task,
    })),
    ...backlogOpen.slice(0, Math.max(0, 4 - openTasks.length)).map((item) => ({
      id: item.id,
      title: item.title,
      meta: item.status || "planned",
    })),
  ].slice(0, 4);
  const fileStatuses = Array.isArray(currentProgressDomain?.fileStatuses) ? currentProgressDomain.fileStatuses : [];
  const progressFiles = fileStatuses.length
    ? fileStatuses
    : (currentProgressDomain?.files || []).map((path) => ({ path, status: "found" }));
  const riskFiles = fileStatuses.filter((file) => ["missing", "changed", "stale"].includes(file.status || "found"));
  const riskCount = failedTasks.length + riskFiles.length;
  const visibleProgressFiles = activeFocus === "risk" ? riskFiles : progressFiles;
  const primaryNext = nextItems[0];
  const previewProgressFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) {
      setProgressFilePreview({ error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。", path });
      return;
    }
    setProgressFilePreview({ loading: true, path });
    try {
      const preview = await invokeWorkspaceCommand("read_engineering_file", {
        input: { path },
      });
      setProgressFilePreview({ path, preview });
    } catch (err) {
      setProgressFilePreview({ error: err instanceof Error ? err.message : String(err), path });
    }
  };

  return (
    <section className="currentProgressBoard">
      <header className="currentProgressHero">
        <div>
          <span>阶段</span>
          <strong>{phaseText}</strong>
          <p>{summary.body || "当前进度会从目标、任务、交接和工作区事实中自动汇总。"}</p>
        </div>
        <div className="currentProgressScore" aria-label={`当前进度 ${progressValue}%`}>
          <strong>{progressValue}%</strong>
          <span>任务完成度</span>
        </div>
      </header>

      <div className="currentProgressStage">
        <div className="currentProgressStageTrack" aria-hidden="true">
          <span style={{ width: `${progressValue}%` }} />
        </div>
        <div className="currentProgressStageMeta">
          <span>{activeGoal?.shortTitle || activeGoal?.title || "暂无目标"}</span>
          <strong>{goalStatus}</strong>
        </div>
      </div>

      <div className="currentProgressStats">
        <div>
          <span>执行任务</span>
          <strong>{openTasks.length}</strong>
          <p>待确认 / 进行中</p>
        </div>
        <div>
          <span>已完成</span>
          <strong>{taskDone}</strong>
          <p>任务或 backlog</p>
        </div>
        <button
          className={activeFocus === "risk" ? "active" : ""}
          type="button"
          onClick={() => setActiveFocus(activeFocus === "risk" ? "" : "risk")}
        >
          <span>需关注</span>
          <strong>{riskCount}</strong>
          <p>失败或治理变更</p>
        </button>
      </div>

      <div className="currentProgressSurface">
        <section className="currentProgressPrimary">
          <header>
            <div>
              <span>下一步</span>
              <strong>{primaryNext?.title || "暂无待处理任务"}</strong>
              <p>{primaryNext ? primaryNext.meta : "当前没有待处理任务。"}</p>
            </div>
            {primaryNext?.task ? (
              <Button size="sm" variant="primary" type="button" onClick={() => onSelectTask?.(primaryNext.task.id)}>
                打开任务
              </Button>
            ) : null}
          </header>
          <div className="currentProgressList">
            {nextItems.slice(1).length ? nextItems.slice(1).map((item) => (
              <button
                disabled={!item.task}
                key={item.id}
                type="button"
                onClick={() => item.task && onSelectTask?.(item.task.id)}
              >
                <span>{item.title}</span>
                <small>{item.meta}</small>
              </button>
            )) : <Notice variant="success">没有更多待处理任务。</Notice>}
          </div>
        </section>

        <aside className="currentProgressAside">
          <section>
            <strong>最近完成</strong>
            <div className="currentProgressTimeline">
              {recentDone.length ? recentDone.map((item) => (
              <button
                disabled={!item.task}
                key={item.id}
                type="button"
                onClick={() => item.task && onSelectTask?.(item.task.id)}
              >
                <span>{item.title}</span>
                <small>{item.meta}</small>
              </button>
            )) : <Notice variant="info">完成任务后会出现在这里。</Notice>}
            </div>
          </section>
          <section>
            <strong>{activeFocus === "risk" ? "需关注项" : "进度依据"}</strong>
            <div className="currentProgressFiles">
              {visibleProgressFiles.map((file) => {
                const path = file.path || file;
                return (
                  <button
                    className={`status-${file.status || "found"}${progressFilePreview?.path === path ? " active" : ""}`}
                    key={path}
                    type="button"
                    onClick={() => previewProgressFile(path)}
                  >
                    {path}
                    <small>{governanceFileHealthLabel(file.status)}</small>
                  </button>
                );
              })}
              {activeFocus === "risk" && failedTasks.map((task) => (
                <button
                  className="status-failed"
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask?.(task.id)}
                >
                  {task.title}
                  <small>失败任务</small>
                </button>
              ))}
              {activeFocus === "risk" && !riskFiles.length && !failedTasks.length ? <Notice variant="success">当前没有需关注项。</Notice> : null}
            </div>
          </section>
        </aside>
      </div>
      {progressFilePreview ? (
        <div className="workspaceGovernancePreview">
          <div className="engineeringFileHeader">
            <div>
              <strong>{progressFilePreview.path}</strong>
              <p>进度依据只读预览</p>
            </div>
            {progressFilePreview.preview ? <Badge>{progressFilePreview.preview.language}</Badge> : null}
          </div>
          {progressFilePreview.loading ? (
            <Notice variant="info">正在读取文件内容...</Notice>
          ) : progressFilePreview.error ? (
            <Notice variant="danger">{progressFilePreview.error}</Notice>
          ) : progressFilePreview.preview ? (
            <>
              <div className="engineeringFileMeta">
                <span>{formatBytes(progressFilePreview.preview.size)}</span>
                {progressFilePreview.preview.truncated ? <span>已截断</span> : <span>完整预览</span>}
              </div>
              <pre className="engineeringFileCode">{progressFilePreview.preview.content || "文件为空。"}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RunbookPanel({ report }) {
  const runbookSummary = report?.summary?.runbook || {};
  const runbookDomain = (Array.isArray(report?.governanceDomains) ? report.governanceDomains : [])
    .find((domain) => domain.id === "runbook" || domain.title === "启动方式");
  const fileStatuses = Array.isArray(runbookDomain?.fileStatuses) ? runbookDomain.fileStatuses : [];
  const commandGroups = [
    {
      command: "npm --prefix desktop run web:dev -- --host 127.0.0.1 --port 1420",
      label: "开发预览",
      note: "启动浏览器里的工作台预览，当前地址就是 http://127.0.0.1:1420/。",
      status: "本地服务",
    },
    {
      command: "npm --prefix desktop run web:build",
      label: "Web 构建",
      note: "验证前端页面能否构建通过，适合改 UI 后自检。",
      status: "可验证",
    },
    {
      command: "cargo check --manifest-path desktop/src-tauri/Cargo.toml",
      label: "桌面壳检查",
      note: "验证 Tauri/Rust 桌面端命令和类型是否正常。",
      status: "可验证",
    },
    {
      command: "bash scripts/check-runtime.sh .",
      label: "治理检查",
      note: "检查 Project OS 运行规则、文档 frontmatter 和基础治理约束。",
      status: "可验证",
    },
  ];
  const foundFiles = fileStatuses.filter((file) => (file.status || "found") === "found").length;
  const missingFiles = fileStatuses.filter((file) => file.status === "missing").length;

  return (
    <section className="runbookSurface">
      <header className="runbookHero">
        <div>
          <span>启动方式</span>
          <strong>{runbookSummary.title || "本地启动方式"}</strong>
          <p>{runbookSummary.body || "这里集中展示当前项目的启动、构建和检查命令。"}</p>
        </div>
        <Badge>{missingFiles ? `${missingFiles} 项待补` : "可启动"}</Badge>
      </header>
      <div className="agentTopicPanel">
        <div className="agentTopicCard">
          <span>命令类型</span>
          <strong>{commandGroups.length}</strong>
        </div>
        <div className="agentTopicCard">
          <span>运行说明</span>
          <strong>{foundFiles}/{fileStatuses.length || 3}</strong>
        </div>
        <div className="agentTopicCard">
          <span>当前入口</span>
          <strong>浏览器预览 / 桌面端 / 治理检查</strong>
        </div>
      </div>
      <div className="runbookCommandGrid">
        {commandGroups.map((item) => (
          <article className="runbookCommand" key={item.label}>
            <header>
              <div>
                <span>{item.label}</span>
                <strong>{item.status}</strong>
              </div>
              <Badge>{item.label === "开发预览" ? "启动" : "检查"}</Badge>
            </header>
            <code>{item.command}</code>
            <p>{item.note}</p>
          </article>
        ))}
      </div>
      <Notice variant="info">这里先只展示受控启动和检查入口。长期运行的 dev server 后续应接入进程管理，再开放一键启动/停止。</Notice>
    </section>
  );
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

function WorkspaceFactsPreview({ onCreateGovernanceTask, onNavigate, provider, report, snapshot, tasks = [] }) {
  const [currentReport, setCurrentReport] = useState(report);
  const [refreshing, setRefreshing] = useState(false);
  const [runningAction, setRunningAction] = useState("");
  const [feedback, setFeedback] = useState("");
  const [autoRefreshKey, setAutoRefreshKey] = useState("");
  useEffect(() => {
    setCurrentReport(report);
  }, [report]);
  const quickEntries = [
    ["currentProgress", "当前进度", "进展、最近完成和下一步"],
    ["runbook", "启动方式", "运行、构建和验证命令"],
    ["riskBoundary", "风险边界", "约束、风险和不可触碰区"],
    ["localState", "本地状态", "Git、工作区和本地变化"],
  ].map(([key, fallbackTitle, description]) => ({
    key,
    title: currentReport?.summary?.[key]?.title || fallbackTitle,
    description,
    status: currentReport?.summary?.[key]?.status,
    confidence: currentReport?.summary?.[key]?.confidence,
    sources: currentReport?.summary?.[key]?.sources || [],
  }));
  const evidence = Array.isArray(currentReport?.evidence) ? currentReport.evidence : [];
  const missing = Array.isArray(currentReport?.findings?.missing) ? currentReport.findings.missing : [];
  const risks = Array.isArray(currentReport?.findings?.risks) ? currentReport.findings.risks : [];
  const governanceDomains = Array.isArray(currentReport?.governanceDomains) ? currentReport.governanceDomains : [];
  const recommendations = Array.isArray(currentReport?.recommendations) ? currentReport.recommendations : [];
  const healthScore = currentReport?.healthScore || {};
  const healthDimensions = Array.isArray(healthScore.dimensions) ? healthScore.dimensions : [];
  const governanceLevel = currentReport?.governanceLevel || {};
  const governanceLevels = Array.isArray(governanceLevel.levels) ? governanceLevel.levels : [];
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const visibleTasks = tasks.filter((task) => !isNoiseTask(task));
  const runningTasks = visibleTasks.filter((task) => task.status === taskStatuses.running);
  const plannedTasks = visibleTasks.filter((task) => task.status === taskStatuses.planned || task.status === taskStatuses.waitingApproval);
  const failedTasks = visibleTasks.filter((task) => task.status === taskStatuses.failed);
  const doneTasks = visibleTasks.filter((task) => task.status === taskStatuses.done);
  const openTasks = [...runningTasks, ...plannedTasks];
  const draftGoals = goals.filter((goal) => goal.status === "draft" || goal.status === "planned" || goal.status === "pending-confirm");
  const validationChecks = Array.isArray(snapshot?.goalValidationReport?.checks) ? snapshot.goalValidationReport.checks : [];
  const failedChecks = validationChecks.filter((check) => check && check.success === false);
  const taskProgressTotal = visibleTasks.length || goals.length || 0;
  const taskProgressDone = visibleTasks.length ? doneTasks.length : goals.filter((goal) => goal.status === "done").length;
  const progressText = taskProgressTotal ? `${taskProgressDone}/${taskProgressTotal} (${Math.round((taskProgressDone / taskProgressTotal) * 100)}%)` : statusLabel(currentReport?.status);
  const projectIssuesCount = risks.length + missing.length + failedTasks.length + failedChecks.length + draftGoals.length;
  const localStatusText = failedTasks.length || failedChecks.length
    ? "需处理"
    : runningTasks.length
      ? "执行中"
      : statusLabel(currentReport?.status) || "正常运行";
  const governanceActions = [
    { id: "scan", label: "一键扫描" },
    { id: "recommend", label: "生成优化建议" },
    { id: "report", label: "批量修复草案" },
    { id: "prune", label: "清理过期产物" },
    { id: "sync", label: "同步治理状态" },
  ];
  const sourceNames = [...new Set(evidence.filter((item) => item.status === "found").map((item) => item.source))].slice(0, 6);
  const detectedStack = (currentReport?.project?.detectedStack || []).join(" / ");
  const metaParts = [
    currentReport?.project?.kind,
    currentReport?.project?.lifecycle,
    detectedStack,
  ].filter(Boolean);
  const projectPhase = currentReport?.project?.lifecycle || currentReport?.project?.phase || "stabilizing";
  const warningItems = [
    ...failedTasks.map((task) => ({
      action: "打开任务",
      body: failureSummaryForTask(task) || task.plan?.summary || "任务执行失败，需要查看运行记录并生成修复任务。",
      target: "execution",
      tone: "danger",
      title: task.title || "任务失败",
      type: "高危预警",
    })),
    ...failedChecks.map((check) => ({
      action: "查看报告",
      body: check.output || check.command || "最近一次验收检查未通过。",
      target: "validation-report",
      tone: "danger",
      title: check.label || check.id || "验收失败",
      type: "高危预警",
    })),
    ...risks.map((item) => ({
      action: "查看详情",
      body: item.body || item.description || "需要确认风险边界。",
      target: "project-risks",
      tone: item.severity === "high" ? "danger" : "warning",
      title: item.title || "风险预警",
      type: item.severity === "high" ? "高危预警" : "状态警告",
    })),
    ...missing.map((item) => ({
      action: "补齐信息",
      body: item.body || item.description || "存在缺失项，需要补齐。",
      target: "governance-files",
      tone: "warning",
      title: item.title || "治理缺口",
      type: "状态警告",
    })),
    ...draftGoals.map((goal) => ({
      action: "前往确认",
      body: goal.summary || "目标处于待确认状态，需要进入目标治理确认范围和验收口径。",
      target: "current-goal",
      tone: "info",
      title: goal.shortTitle || goal.title || "待确认目标",
      type: "操作提示",
    })),
    ...recommendations.slice(0, 2).map((item) => ({
      action: "查看建议",
      body: item.problem || item.action || "已有治理优化建议。",
      target: item.files?.[0] ? { type: "file", path: item.files[0] } : "current-goal",
      tone: item.severity === "high" ? "danger" : "info",
      title: item.title || "操作提示",
      type: item.severity === "high" ? "高危预警" : "操作提示",
    })),
  ].slice(0, 3);
  const fallbackWarnings = [
    {
      action: "前往确认",
      body: "系统检测到目标或任务仍有待确认项，需要人工确认后进入执行闭环。",
      target: "current-goal",
      tone: "info",
      title: "待确认目标",
      type: "操作提示",
    },
  ];
  const visibleWarnings = warningItems.length ? warningItems.slice(0, 3) : fallbackWarnings;
  const warningCounts = (warningItems.length ? warningItems : visibleWarnings).reduce((acc, item) => {
    acc[item.tone] = (acc[item.tone] || 0) + 1;
    return acc;
  }, {});
  const primaryFocus = failedTasks[0]
    ? {
      next: failureSummaryForTask(failedTasks[0]) || "任务失败，需要查看运行记录并修复。",
      target: "execution",
      title: failedTasks[0].title || "处理失败任务",
    }
    : failedChecks[0]
      ? {
        next: failedChecks[0].command || "最近一次验收未通过，需要查看报告。",
        target: "validation-report",
        title: failedChecks[0].label || "处理失败验收",
      }
      : runningTasks[0]
        ? {
          next: runningTasks[0].plan?.summary || "任务正在执行，优先观察结果和终端输出。",
          target: "execution",
          title: runningTasks[0].title || "跟进运行中任务",
        }
        : draftGoals[0]
          ? {
            next: draftGoals[0].summary || "目标待确认，需要确认范围和验收标准。",
            target: "current-goal",
            title: draftGoals[0].shortTitle || draftGoals[0].title || "确认当前目标",
          }
          : recommendations[0]
            ? {
              next: recommendations[0].action || recommendations[0].problem,
              target: recommendations[0].files?.[0] ? { type: "file", path: recommendations[0].files[0] } : "governance-files",
              title: recommendations[0].title || "处理治理建议",
            }
            : {
              next: currentReport?.summary?.currentProgress?.body || activeGoal?.summary || "下一步：确认当前焦点，必要时运行一轮基础检查。",
              target: "project-progress",
              title: currentReport?.summary?.currentProgress?.title || activeGoal?.shortTitle || activeGoal?.title || "推进当前项目治理闭环",
            };
  const focusTitle = primaryFocus.title;
  const focusNext = primaryFocus.next;
  const recentActivities = [
    ...visibleTasks.slice(0, 3).map((task) => ({
      body: task.plan?.summary || task.description || task.projectName || "来自当前任务队列。",
      target: task.status === taskStatuses.done || task.status === taskStatuses.failed ? "execution-results" : "execution",
      title: task.title || "任务更新",
      when: task.updatedAt || task.createdAt || taskStatusLabel(task.status),
      tone: task.status === taskStatuses.failed ? "danger" : task.status === taskStatuses.done ? "success" : "neutral",
    })),
    ...recommendations.slice(0, 3).map((item) => ({
      body: item.problem || item.action || "已生成治理建议。",
      target: item.files?.[0] ? { type: "file", path: item.files[0] } : "governance-files",
      title: item.title || "生成治理建议",
      when: item.impact || "刚刚",
      tone: "success",
    })),
    ...evidence.filter((item) => item.status === "found").slice(0, 3).map((item) => ({
      body: item.reason || item.path || "已纳入工作台事实。",
      target: item.path ? { type: "file", path: item.path } : "governance-files",
      title: `识别 ${item.source || item.path || "工程文件"}`,
      when: "本次扫描",
      tone: "neutral",
    })),
  ].slice(0, 4);
  const quickCounts = {
    conversation: "",
    execution: openTasks.length || visibleTasks.length || "",
    terminal: runningTasks.length || "",
    "project-identity": projectIssuesCount || "",
    "engineering-files": evidence.filter((item) => item.status === "found").length || "",
    "validation-report": failedChecks.length || snapshot?.goalValidationReport?.status || "",
  };
  const quickLinks = [
    ["当前对话", "对话", MessageSquare, "conversation"],
    ["当前任务", "任务", Check, "execution"],
    ["终端", "命令", TerminalSquare, "terminal"],
    ["项目流程", "治理", ClipboardList, "project-identity"],
    ["工程资产", "文件", Package, "engineering-files"],
    ["验证报告", "验收", FileText, "validation-report"],
  ];
  const dashboardStats = [
    ["当前项目", currentReport?.project?.name || "OmniDesk", "project-identity"],
    ["项目阶段", projectPhase, "project-progress"],
    ["目标进度", progressText, "project-progress"],
    ["治理健康", Number.isFinite(healthScore.score) ? `${healthScore.score}/100` : statusLabel(currentReport?.status), "governance-files"],
    ["本地状态", localStatusText, "local-project-state"],
  ];
  const projectProfileMissing = Array.isArray(snapshot?.projectProfile?.missingFields)
    ? snapshot.projectProfile.missingFields.length
    : 0;
  const governanceFilesCount = governanceDomains.reduce((sum, domain) => sum + (Array.isArray(domain.files) ? domain.files.length : 0), 0);
  const reportAssetsReady = Boolean(snapshot?.goalValidationReport?.status) || recommendations.length > 0 || Number.isFinite(healthScore.score);
  const agentReady = Boolean(provider?.enabled && provider?.model);
  const taskExecutionReady = visibleTasks.length > 0 || Boolean(snapshot?.runCount);
  const onboardingCards = [
    {
      action: projectProfileMissing ? "补齐事实" : "查看事实",
      body: projectProfileMissing
        ? `还有 ${projectProfileMissing} 项项目事实待补齐，Agent 理解项目时会优先提示确认。`
        : "项目身份、阶段、栈和治理事实已可用于 Agent 上下文。",
      metric: projectProfileMissing ? `${projectProfileMissing} 缺失` : "已识别",
      status: projectProfileMissing ? "待补齐" : "可用",
      target: "project-facts",
      title: "项目事实",
      tone: projectProfileMissing ? "warning" : "success",
    },
    {
      action: "查看资产",
      body: governanceFilesCount
        ? `已识别 ${governanceFilesCount} 个治理域文件引用，可按工程文件、治理文件、报告、Schema 和脚本下钻。`
        : "还需要扫描关键工程文件、治理文件、报告产物和脚本模板。",
      metric: governanceFilesCount ? `${governanceFilesCount} 文件` : "待扫描",
      status: governanceFilesCount ? "已发现" : "待扫描",
      target: "engineering-files",
      title: "工程资产",
      tone: governanceFilesCount ? "success" : "warning",
    },
    {
      action: agentReady ? "查看配置" : "配置模型",
      body: agentReady
        ? `当前模型 ${provider.model} 已接入，工具白名单、Skill、适配器和安全边界可继续检查。`
        : "模型连接未完全可用，其他项目接入后需要先配置 Provider 和默认模型。",
      metric: agentReady ? "已接入" : "待配置",
      status: agentReady ? "可用" : "待配置",
      target: "model-connections",
      title: "Agent 配置",
      tone: agentReady ? "success" : "warning",
    },
    {
      action: taskExecutionReady ? "查看队列" : "创建任务",
      body: taskExecutionReady
        ? `当前有 ${visibleTasks.length} 个任务记录、${runningTasks.length} 个运行中任务，可进入受控执行链路。`
        : "还没有任务队列，接入项目后需要从对话或目标生成第一批任务。",
      metric: taskExecutionReady ? `${visibleTasks.length} 任务` : "待创建",
      status: failedTasks.length ? "需处理" : taskExecutionReady ? "可执行" : "待创建",
      target: taskExecutionReady ? "task-queue" : "conversation",
      title: "任务执行",
      tone: failedTasks.length ? "danger" : taskExecutionReady ? "success" : "warning",
    },
  ];
  const onboardingBlockers = onboardingCards.filter((card) => card.tone !== "success").length;
  const onboardingReady = onboardingCards.length - onboardingBlockers;
  const refreshFacts = async (source = "manual") => {
      setRefreshing(true);
      setFeedback(source === "auto" ? "正在自动更新工作区事实..." : "正在手动刷新当前项目事实...");
      try {
        const nextReport = await refreshWorkspaceFactsPreview();
        if (nextReport) setCurrentReport(nextReport);
        setFeedback(source === "auto"
          ? "已自动更新：结果只刷新在工作区，没有写入工程文件。"
          : "已完成手动刷新：结果只刷新在工作区，没有写入工程文件。");
      } catch (err) {
        setFeedback(`${source === "auto" ? "自动更新" : "手动刷新"}失败：${err?.message || err}`);
      } finally {
        setRefreshing(false);
      }
  };
  useEffect(() => {
    const nextKey = [report?.project?.path, report?.generatedAt].filter(Boolean).join("|");
    if (!nextKey || nextKey === autoRefreshKey) return;
    setAutoRefreshKey(nextKey);
    refreshFacts("auto");
  }, [report?.project?.path, report?.generatedAt, autoRefreshKey]);
  const handleWorkspaceAction = async (nextMode) => {
    if (nextMode === "refresh") {
      await refreshFacts("manual");
      return;
    }
    const action = governanceActions.find((item) => item.id === nextMode);
    if (!action) return;
    setRunningAction(action.id);
    setFeedback(`正在执行：${action.label}...`);
    try {
      const result = await invokeWorkspaceCommand("run_project_os_action", {
        input: { actionId: action.id },
      });
      const nextReport = await refreshWorkspaceFactsPreview();
      if (nextReport) setCurrentReport(nextReport);
      window.dispatchEvent(new CustomEvent("project-os:snapshot-refresh-requested", {
        detail: { source: action.id },
      }));
      setFeedback(result?.success
        ? `已完成：${action.label}。结果已写入 .project-os，并刷新当前视图。`
        : `${action.label} 未通过：${result?.output || "请查看终端输出。"}`);
    } catch (err) {
      setFeedback(`${action.label} 失败：${err?.message || err}`);
    } finally {
      setRunningAction("");
    }
  };
  return (
    <div className="workspaceFacts workbenchDashboard">
      <section className="workbenchHero">
        <h3>今日工作台</h3>
        {metaParts.length ? <p>{metaParts.join(" · ")}</p> : null}
      </section>

      <section className="workbenchStatGrid" aria-label="工作台状态总览">
        {dashboardStats.map(([label, value, target]) => (
          <button className="workbenchStatCard" key={label} type="button" onClick={() => onNavigate?.(target)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </section>

      <section className="workbenchOnboarding">
        <header>
          <div>
            <strong>项目接入状态</strong>
            <p>{onboardingReady}/{onboardingCards.length} 条链路可用，{onboardingBlockers ? `${onboardingBlockers} 项需要处理` : "可以进入日常工作"}</p>
          </div>
          <button type="button" onClick={() => onNavigate?.("governance-files")}>查看接入详情</button>
        </header>
        <div className="workbenchOnboardingGrid">
          {onboardingCards.map((card) => (
            <button className={`workbenchOnboardingCard tone-${card.tone}`} key={card.title} type="button" onClick={() => onNavigate?.(card.target)}>
              <span>{card.status}</span>
              <strong>{card.title}</strong>
              <p>{card.body}</p>
              <small>{card.metric} · {card.action}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="workbenchFocusSection">
        <h4>当前焦点</h4>
        <div className="workbenchFocus">
          <div>
            <span className="workbenchFocusLabel"><Activity size={14} />进行中任务</span>
            <strong>{focusTitle}</strong>
            <p>{focusNext}</p>
          </div>
          <Button variant="primary" type="button" disabled={refreshing || Boolean(runningAction)} onClick={() => onNavigate?.(primaryFocus.target)}>
            <Play size={14} fill="currentColor" />
            {runningAction === "scan" ? "执行中" : "继续执行"}
          </Button>
        </div>
      </section>
      {feedback ? <Notice variant="success">{feedback}</Notice> : null}

      <section className="workbenchWarnings">
        <header>
          <div>
            <strong>系统预警</strong>
            <span className="workbenchWarningPills">
              <em className="danger">{warningCounts.danger || 0} 高危</em>
              <em className="warning">{warningCounts.warning || 0} 警告</em>
              <em className="info">{warningCounts.info || 0} 提示</em>
            </span>
          </div>
          <p>共发现 {visibleWarnings.length} 项需处理事项</p>
        </header>
        <div className="workbenchWarningGrid">
          {visibleWarnings.map((item) => (
            <article className={`workbenchWarningCard tone-${item.tone}`} key={`${item.type}-${item.title}`}>
              <span className="workbenchWarningType">
                {item.tone === "danger" ? <ShieldAlert size={14} /> : item.tone === "warning" ? <AlertTriangle size={14} /> : <Target size={14} />}
                {item.type}
              </span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <div>
                <button type="button" onClick={() => onNavigate?.(item.target)}>{item.action}<ArrowRight size={12} /></button>
                <button type="button" onClick={() => onNavigate?.(item.target)}>查看详情</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="workbenchLowerGrid">
        <div>
          <strong>快捷入口</strong>
          <div className="workbenchShortcutGrid">
            {quickLinks.map(([title, label, Icon, target]) => (
              <button type="button" key={title} onClick={() => onNavigate?.(target)}>
                <Icon size={18} />
                <strong>{title}</strong>
                <span>{quickCounts[target] ? `${label} · ${quickCounts[target]}` : label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <strong>最近活动</strong>
          <div className="workbenchActivityList">
            {(recentActivities.length ? recentActivities : [{ title: "工作台已接入", body: "项目事实已进入工作台总览。", when: "刚刚", tone: "success" }]).map((item) => (
              <button className="workbenchActivityItem" key={`${item.title}-${item.when}`} type="button" onClick={() => onNavigate?.(item.target || "governance-files")}>
                <span className={`workbenchActivityDot tone-${item.tone}`} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>{item.when}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <details className="workbenchAdvanced">
        <summary>治理详情与自动化动作</summary>
        <div className="workspaceFactsActions" aria-label="工作区事实操作">
          {governanceActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.id === "scan" ? "primary" : "subtle"}
              type="button"
              disabled={refreshing || Boolean(runningAction)}
              onClick={() => handleWorkspaceAction(action.id)}
            >
              {runningAction === action.id ? "执行中" : action.label}
            </Button>
          ))}
          <Button size="sm" variant="subtle" type="button" disabled={refreshing || Boolean(runningAction)} onClick={() => handleWorkspaceAction("refresh")}>{refreshing ? "更新中" : "手动刷新"}</Button>
        </div>
        <GovernanceFilesHealthSection onCreateGovernanceTask={onCreateGovernanceTask} report={currentReport} />
      </details>
    </div>
  );
}

function AgentTopicPanel({
  provider,
  topic,
  tasks = [],
  snapshot,
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
  onCreateRepairTask,
  onCreateGovernanceTask,
  onOpenCapabilityFile,
}) {
  const id = topic?.id || "";
  const visibleTasks = tasks.filter((task) => !isNoiseTask(task));
  const activeTasks = visibleTasks.filter((task) => ![taskStatuses.done, taskStatuses.failed].includes(task.status));
  const patchTasks = visibleTasks.filter((task) => task.patchDraft);
  const doneTasks = visibleTasks.filter((task) => task.status === taskStatuses.done);
  const failedTasks = visibleTasks.filter((task) => task.status === taskStatuses.failed);
  const currentTask = activeTasks[0] || visibleTasks[0];
  const recentResultTasks = [...doneTasks, ...failedTasks].slice(0, 5);
  const providerName = activeProviderProfileName(provider) || "未命名连接";
  const modelStatus = composerModelAvailability?.[provider?.model]?.status || (provider?.model ? "未测试" : "未选择");
  const modelEnabled = provider?.enabled ? "已启用" : "未启用";
  const currentPlan = currentTask?.plan || {};
  const currentChecks = checksForPlan(currentPlan);
  const previewItems = (items = [], limit = 3) => items.filter(Boolean).slice(0, limit);
  const formatDraftFiles = (draft) => {
    const files = draft?.files || [];
    if (!files.length) return "未标注文件";
    return files.slice(0, 3).join(" / ") + (files.length > 3 ? ` 等 ${files.length} 个` : "");
  };
  const applyStatusLabel = (task) => {
    if (task.applyResult?.success) return "已应用";
    if (task.applyResult) return "应用失败";
    return "待应用";
  };
  const verifyStatusLabel = (task) => {
    if (task.verificationSummary) return task.verificationSummary;
    if (task.status === taskStatuses.done) return "已完成";
    if (task.status === taskStatuses.failed) return "有失败项";
    return "待验证";
  };
  const runChecksForTask = async (task) => {
    if (!task) return false;
    const checks = checksForPlan(task.plan);
    if (!checks.length) return false;
    for (const check of checks) {
      const ok = await onRunGuardedCheck?.(task.id, check.id);
      if (!ok) return false;
    }
    return true;
  };
  const failedRunsForTask = (task) => (task?.runs || []).filter((run) => run && run.success === false);
  const failureSummaryForTask = (task) => {
    const failedRuns = failedRunsForTask(task);
    if (task?.applyResult && !task.applyResult.success) return task.applyResult.message || "应用改动失败";
    if (failedRuns.length) return failedRuns[0].output || `${failedRuns[0].label || failedRuns[0].id || "检查"} 失败`;
    return task?.verificationSummary || "任务失败，等待定位原因";
  };
  const rerunFailedChecks = async (task) => {
    const failedRuns = failedRunsForTask(task);
    const checkIds = failedRuns.map((run) => run.id).filter(Boolean);
    const fallbackIds = checksForPlan(task?.plan).map((check) => check.id);
    const ids = [...new Set(checkIds.length ? checkIds : fallbackIds)];
    if (!task || !ids.length) return false;
    for (const checkId of ids) {
      const ok = await onRunGuardedCheck?.(task.id, checkId);
      if (!ok) return false;
    }
    return true;
  };
  const actionsForTask = (task, scope = "task") => {
    if (!task) return [];
    const checks = checksForPlan(task.plan);
    return [
      {
        key: `${scope}-open`,
        label: "打开任务",
        onClick: () => onSelectTask?.(task.id),
      },
      {
        disabled: patchLoading,
        key: `${scope}-generate-patch`,
        label: patchLoading ? "生成中" : task.patchDraft ? "重新生成草案" : "生成 Patch 草案",
        onClick: () => onGeneratePatchDraft?.(task.id),
      },
      {
        disabled: applyLoading || !task.patchDraft,
        key: `${scope}-apply`,
        label: applyLoading ? "应用中" : "应用并自动验证",
        onClick: () => onApplyPatchDraft?.(task.id),
        variant: "primary",
      },
      {
        disabled: Boolean(runnerLoadingId) || !checks.length,
        key: `${scope}-verify`,
        label: runnerLoadingId ? "验证中" : "运行检查",
        onClick: () => runChecksForTask(task),
      },
      {
        disabled: handoffLoading || !task.runSummary || Boolean(task.handoffMerge),
        key: `${scope}-handoff`,
        label: handoffLoading ? "更新中" : task.handoffMerge ? "已更新交接" : "更新交接",
        onClick: () => onMergeHandoff?.(task.id),
      },
    ];
  };
  const emptyTaskActions = [
    { disabled: true, key: "empty-open", label: "打开任务" },
    { disabled: true, key: "empty-generate-patch", label: "生成 Patch 草案" },
    { disabled: true, key: "empty-apply", label: "应用并自动验证", variant: "primary" },
    { disabled: true, key: "empty-verify", label: "运行检查" },
    { disabled: true, key: "empty-handoff", label: "更新交接" },
  ];
  const assetDomains = Array.isArray(snapshot?.workspaceFacts?.governanceDomains) ? snapshot.workspaceFacts.governanceDomains : [];
  const assetDomainById = (domainId, title) => assetDomains.find((domain) => domain.id === domainId || domain.title === title);
  const assetDomainFileCount = (domain) => Array.isArray(domain?.files) ? domain.files.length : 0;
  const assetDomainRiskCount = (domain) => (Array.isArray(domain?.fileStatuses) ? domain.fileStatuses : [])
    .filter((file) => ["missing", "changed", "stale"].includes(file.status || "")).length;
  const engineeringDomain = assetDomainById("engineering-files", "工程文件");
  const governanceDomain = assetDomainById("governance-files", "治理文件");
  const reportDomain = assetDomainById("report-artifacts", "报告产物");
  const schemaDomain = assetDomainById("schema-assets", "Schema");
  const scriptDomain = assetDomainById("script-templates", "脚本模板");
  const profileMissingCount = Array.isArray(snapshot?.projectProfile?.missingFields) ? snapshot.projectProfile.missingFields.length : 0;
  const profileKnownCount = Math.max(0, 5 - profileMissingCount);
  const memoryItems = Array.isArray(snapshot?.memory) ? snapshot.memory : [];
  const conversationCount = Array.isArray(snapshot?.conversations) ? snapshot.conversations.length : 0;
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const doneGoals = goals.filter((goal) => goal.status === "done");
  const openGoals = goals.filter((goal) => goal.status !== "done");
  const validationChecks = Array.isArray(snapshot?.goalValidationReport?.checks) ? snapshot.goalValidationReport.checks : [];
  const passedChecks = validationChecks.filter((check) => check?.success).length;
  const projectPhase = phaseLabel(snapshot?.phase || snapshot?.workspaceFacts?.project?.lifecycle);
  const topicRelatedCount = Array.isArray(topic?.relatedFiles) ? topic.relatedFiles.length : 0;
  const cardsByTopic = {
    "project-identity": [
      ["项目阶段", projectPhase],
      ["事实完整度", `${profileKnownCount}/5`],
      ["来源文件", `${topicRelatedCount || 2}`],
    ],
    "project-progress": [
      ["当前目标", activeGoal?.shortTitle || activeGoal?.title || "未选择"],
      ["任务数量", `${visibleTasks.length}`],
      ["运行中", `${activeTasks.length}`],
    ],
    "project-runbook": [
      ["启动入口", "desktop/package.json"],
      ["检查命令", `${validationChecks.length || 3}`],
      ["状态", "可验证"],
    ],
    "project-risks": [
      ["风险来源", "HANDOFF / LESSONS"],
      ["失败任务", `${failedTasks.length}`],
      ["需关注", `${assetDomainRiskCount(governanceDomain)}`],
    ],
    "local-project-state": [
      ["接入状态", snapshot?.workspaceFacts?.status || "connected"],
      ["运行记录", `${snapshot?.runCount || 0}`],
      ["本地项目", snapshot?.currentProjectId ? "已选中" : "待选择"],
    ],
    "current-goal": [
      ["当前目标", activeGoal?.shortTitle || activeGoal?.title || "未选择"],
      ["目标状态", activeGoal ? goalStatusLabelText(activeGoal.status) : "空"],
      ["目标总数", `${goals.length}`],
    ],
    "acceptance-criteria": [
      ["验收状态", snapshot?.goalValidationReport?.status || "missing"],
      ["检查项", validationChecks.length ? `${passedChecks}/${validationChecks.length}` : "待补齐"],
      ["来源", ".project-os/goal-validation.json"],
    ],
    "goal-history": [
      ["已完成", `${doneGoals.length}`],
      ["进行中", `${openGoals.length}`],
      ["历史来源", ".project-os/goals.json"],
    ],
    "collaboration-boundary": [
      ["规则来源", "AGENTS.md"],
      ["路由来源", "docs/ROUTING.md"],
      ["状态", "已接入"],
    ],
    "execution-permissions": [
      ["自动边界", "受控命令"],
      ["确认边界", "写入/发布/高风险"],
      ["状态", "规则已接入"],
    ],
    "documentation-rules": [
      ["文档边界", "DOCUMENTATION"],
      ["命名规则", "NAMING"],
      ["状态", "已接入"],
    ],
    "system-architecture": [
      ["架构来源", "docs/ARCHITECTURE.md"],
      ["实现入口", "desktop/src"],
      ["状态", "待细化"],
    ],
    "data-contracts": [
      ["契约来源", "schemas / docs/data"],
      ["Schema 状态", assetDomainFileCount(schemaDomain) ? "已发现" : "待补齐"],
      ["用途", "状态和报告结构"],
    ],
    "ui-standards": [
      ["规范来源", "DESIGN_STANDARDS"],
      ["Token 来源", "desktop/src/styles.css"],
      ["状态", "已接入"],
    ],
    "code-structure": [
      ["结构来源", "CODE_STRUCTURE"],
      ["前端入口", "desktop/src/main.jsx"],
      ["后端入口", "desktop/src-tauri/src/main.rs"],
    ],
    "validation-checks": [
      ["检查项", `${validationChecks.length || 3}`],
      ["通过项", validationChecks.length ? `${passedChecks}` : "待运行"],
      ["状态", snapshot?.goalValidationReport?.status || "待生成"],
    ],
    "validation-report": [
      ["报告状态", snapshot?.goalValidationReport?.status || "missing"],
      ["检查结果", validationChecks.length ? `${passedChecks}/${validationChecks.length}` : "待运行"],
      ["用途", "验收和修复入口"],
    ],
    "run-records": [
      ["运行记录", `${snapshot?.runCount || 0}`],
      ["任务结果", `${doneTasks.length + failedTasks.length}`],
      ["来源", ".project-os/runs/*"],
    ],
    "handoff-records": [
      ["交接来源", "HANDOFF.md"],
      ["任务结果", `${doneTasks.length + failedTasks.length}`],
      ["状态", "可继续"],
    ],
    "decision-records": [
      ["决策来源", "DECISIONS / CHANGELOG"],
      ["状态", "待沉淀"],
      ["用途", "重要取舍记录"],
    ],
    "lessons-learned": [
      ["经验来源", "LESSONS.md"],
      ["记忆条目", `${memoryItems.length}`],
      ["用途", "踩坑约束"],
    ],
    "active-task": [
      ["当前任务", currentTask?.title || "暂无进行中的任务"],
      ["任务状态", currentTask ? taskStatusLabel(currentTask.status) : "空"],
      ["下一步", currentTask?.status === taskStatuses.planned ? "点击右侧任务或对话里的开始执行" : "生成计划后会进入执行链路"],
    ],
    "task-queue": [
      ["任务总数", `${visibleTasks.length}`],
      ["活跃任务", `${activeTasks.length}`],
      ["失败任务", `${failedTasks.length}`],
    ],
    "patch-drafts": [
      ["草案数量", `${patchTasks.length}`],
      ["最近草案", patchTasks[0]?.title || "暂无 Patch 草案"],
      ["下一步", patchTasks.length ? "打开任务查看 diff、确认 apply、自动验证" : "先从当前任务生成改动"],
    ],
    "execution-terminal": [
      ["运行记录", `${snapshot?.runCount || 0}`],
      ["可用入口", "终端 tab / 受控检查 / 白名单命令"],
      ["边界", "不直接执行任意高风险命令"],
    ],
    "execution-results": [
      ["已完成任务", `${doneTasks.length}`],
      ["失败任务", `${failedTasks.length}`],
      ["最近结果", doneTasks[0]?.title || failedTasks[0]?.title || "暂无执行结果"],
    ],
    "model-connections": [
      ["当前连接", providerName],
      ["启用状态", modelEnabled],
      ["当前模型", provider?.model || "未选择"],
      ["模型状态", modelStatus],
    ],
    "tool-allowlist": [
      ["受控检查", "runtime / docs / recommend / web-build / cargo-check"],
      ["治理动作", "scan / recommend / report / prune / sync"],
      ["执行方式", "Tauri command 白名单"],
    ],
    "skill-capabilities": [
      ["已接入 Skill", "project-setup / design-system / frontend"],
      ["本地目录", ".agents/skills / .claude/skills"],
      ["触发方式", "按项目请求和领域意图路由"],
    ],
    "adapters": [
      ["适配目标", "Claude / Codex / Cursor / Gemini / DeepSeek"],
      ["当前形态", "adapters/* 文档适配"],
      ["接入状态", "可读，待产品化检测"],
    ],
    "security-boundary": [
      ["写入边界", "工程文件写入必须经确认"],
      ["命令边界", "页面不传任意 shell"],
      ["密钥边界", "API Key 只保存在本地环境"],
    ],
    "engineering-files": [
      ["关键文件", `${assetDomainFileCount(engineeringDomain) || "待扫描"}`],
      ["风险文件", `${assetDomainRiskCount(engineeringDomain)}`],
      ["用途", "源码入口、配置和工程目录"],
    ],
    "governance-files": [
      ["治理文件", `${assetDomainFileCount(governanceDomain) || "待扫描"}`],
      ["需关注", `${assetDomainRiskCount(governanceDomain)}`],
      ["用途", "规则、状态、交接和运行说明"],
    ],
    "report-artifacts": [
      ["报告状态", snapshot?.goalValidationReport?.status || "待生成"],
      ["推荐数量", `${Array.isArray(snapshot?.workspaceFacts?.recommendations) ? snapshot.workspaceFacts.recommendations.length : 0}`],
      ["用途", "评分、建议和验收证据"],
    ],
    "schema-assets": [
      ["Schema 文件", `${assetDomainFileCount(schemaDomain) || "待扫描"}`],
      ["需关注", `${assetDomainRiskCount(schemaDomain)}`],
      ["用途", "约束 Agent 输入输出契约"],
    ],
    "script-templates": [
      ["脚本模板", `${assetDomainFileCount(scriptDomain) || "待扫描"}`],
      ["需关注", `${assetDomainRiskCount(scriptDomain)}`],
      ["用途", "检查、同步、模板和适配资源"],
    ],
    "project-facts": [
      ["事实完整度", `${profileKnownCount}/5`],
      ["事实来源", "profile / state / workspace-facts"],
      ["缺失项", profileMissingCount ? `${profileMissingCount}` : "无"],
    ],
    "user-preferences": [
      ["偏好状态", snapshot?.projectProfile?.userPreferences ? "已记录" : "待确认"],
      ["作用范围", "项目偏好 / 全局偏好"],
      ["来源", "对话提取 / 用户确认"],
    ],
    "long-term-memory": [
      ["记忆条目", `${memoryItems.length}`],
      ["沉淀方式", "事实 / 决策 / 经验"],
      ["状态", memoryItems.length ? "已接入" : "待沉淀"],
    ],
    "conversation-summary": [
      ["会话数量", `${conversationCount || "本地缓存"}`],
      ["沉淀方向", "任务 / 事实 / 偏好"],
      ["状态", "待产品化"],
    ],
  };
  const agentConfigSpecs = {
    "model-connections": {
      title: "模型连接",
      status: provider?.enabled && provider?.model ? "已接入" : "待配置",
      tone: provider?.enabled && provider?.model ? "success" : "warning",
      value: "让接入项目知道当前 Agent 用哪个模型、Key 存在哪里、模型是否可用。",
      next: provider?.enabled ? "测试当前模型可用性，并补充项目级默认模型策略。" : "配置 Provider、API Base、Key 环境变量和默认模型。",
      files: [".project-os/desktop-provider.json", ".project-os/model-catalog.json", ".project-os/model-health.json"],
    },
    "tool-allowlist": {
      title: "工具白名单",
      status: "待产品化",
      tone: "warning",
      value: "让新项目明确哪些检查、治理动作和终端命令可以被 Agent 调用。",
      next: "把 Tauri command、检查脚本、治理动作汇总成项目级允许列表。",
      files: ["desktop/src-tauri/src/main.rs", "scripts/check-runtime.sh", "scripts/check-ai-project.sh"],
    },
    "skill-capabilities": {
      title: "Skill 能力",
      status: "已发现",
      tone: "success",
      value: "让接入项目按意图启用项目初始化、设计规范、前端实现等能力。",
      next: "显示每个 Skill 的职责、触发条件、来源目录和启用状态。",
      files: [".agents/skills/project-setup/SKILL.md", ".agents/skills/design-system/SKILL.md", ".agents/skills/frontend/SKILL.md", ".claude/skills/REGISTRY.md"],
    },
    "adapters": {
      title: "适配器",
      status: "有基础",
      tone: "info",
      value: "让同一个项目规则可以被 Codex、Claude、Cursor、Gemini 等工具复用。",
      next: "检测 adapters 目录、根入口文件和工具专属规则是否同步。",
      files: ["adapters/CODEX.md", "adapters/CLAUDE.md", "adapters/CURSOR.md", "adapters/GEMINI.md"],
    },
    "security-boundary": {
      title: "安全边界",
      status: "规则已接入",
      tone: "success",
      value: "让接入项目明确哪些动作必须确认、哪些文件不能动、哪些信息不能外传。",
      next: "把 AGENTS.md 的禁止行为、确认动作和密钥规则整理成可视化边界。",
      files: ["AGENTS.md", "docs/ROUTING.md", "docs/DOCUMENTATION.md", "docs/LESSONS.md"],
    },
  };
  const agentConfigSpec = agentConfigSpecs[id];
  const assetCapabilitySpecs = {
    "engineering-files": {
      title: "工程文件",
      status: assetDomainFileCount(engineeringDomain) ? "已发现" : "待扫描",
      tone: assetDomainFileCount(engineeringDomain) ? "success" : "warning",
      value: "让 Agent 快速定位源码入口、配置文件和工程目录，减少从零扫目录的成本。",
      next: "优先标注入口文件、运行配置、核心模块和高频修改区域。",
      files: engineeringDomain?.files || ["desktop/*", "cli/*", "package.json"],
    },
    "governance-files": {
      title: "治理文件",
      status: assetDomainRiskCount(governanceDomain) ? "需关注" : "已接入",
      tone: assetDomainRiskCount(governanceDomain) ? "warning" : "success",
      value: "让 Agent 知道项目规则、当前状态、交接记录和文档边界。",
      next: "把缺失、过期或变更中的治理文件标成待确认事项。",
      files: governanceDomain?.files || ["PROJECT.md", "HANDOFF.md", "AGENTS.md", "docs/*"],
    },
    "report-artifacts": {
      title: "报告产物",
      status: snapshot?.goalValidationReport?.status || "待生成",
      tone: snapshot?.goalValidationReport?.status === "failed" ? "danger" : snapshot?.goalValidationReport?.status ? "success" : "warning",
      value: "让接入项目有评分、建议、验收和运行证据，用户能知道报告下一步能干嘛。",
      next: "把评分、建议和失败验收直接连接到修复任务。",
      files: reportDomain?.files || [".project-os/reports/*", ".project-os/recommendations/*", ".project-os/goal-validation-report.json"],
    },
    "schema-assets": {
      title: "Schema",
      status: assetDomainFileCount(schemaDomain) ? "已发现" : "待补齐",
      tone: assetDomainFileCount(schemaDomain) ? "success" : "warning",
      value: "让 Agent 按结构化契约读取状态、生成报告和校验配置。",
      next: "展示每个 schema/manifest 约束的数据对象和使用场景。",
      files: schemaDomain?.files || ["schemas/*", "docs/data/*"],
    },
    "script-templates": {
      title: "脚本模板",
      status: assetDomainFileCount(scriptDomain) ? "已发现" : "待整理",
      tone: assetDomainFileCount(scriptDomain) ? "success" : "warning",
      value: "让接入项目知道哪些检查、同步和模板命令可以被安全复用。",
      next: "区分可直接运行、需要确认、只作为模板参考的脚本。",
      files: scriptDomain?.files || ["scripts/*", "templates/*", "adapters/*"],
    },
  };
  const assetCapabilitySpec = assetCapabilitySpecs[id];
  const executionCapabilitySpecs = {
    "active-task": {
      files: [".project-os/runs/desktop-tasks/*", ".project-os/goals.json"],
      next: currentTask ? "围绕当前任务生成 Patch 草案、应用并自动验证。" : "从对话或目标创建当前任务。",
      status: currentTask ? taskStatusLabel(currentTask.status) : "待创建",
      title: "当前任务",
      tone: currentTask?.status === taskStatuses.failed ? "danger" : currentTask ? "success" : "warning",
      value: "让接入项目把对话意图变成可追踪、可验证、可交接的执行任务。",
    },
    "task-queue": {
      files: [".project-os/runs/desktop-tasks/*", ".project-os/task-backlog.json"],
      next: failedTasks.length ? "优先处理失败任务，再推进运行中和待确认任务。" : "按状态推进队列，必要时从对话继续补充任务。",
      status: failedTasks.length ? "有失败项" : activeTasks.length ? "推进中" : visibleTasks.length ? "已归档" : "待创建",
      title: "任务队列",
      tone: failedTasks.length ? "danger" : visibleTasks.length ? "success" : "warning",
      value: "让接入项目知道所有任务的状态、来源和下一步动作，而不是散落在对话里。",
    },
    "patch-drafts": {
      files: [".project-os/runs/desktop-tasks/*"],
      next: patchTasks.length ? "查看涉及文件和验证项，确认后应用并自动验证。" : "先从当前任务生成 Patch 草案。",
      status: patchTasks.length ? "有草案" : "待生成",
      title: "Patch 草案",
      tone: patchTasks.length ? "success" : "warning",
      value: "让接入项目在真正改文件前先看到改动范围、风险和验证计划。",
    },
    "execution-terminal": {
      files: ["scripts/check-runtime.sh", "scripts/check-ai-project.sh", "desktop/package.json"],
      next: "把常用检查和构建命令标为受控命令，和普通终端输入区分开。",
      status: "可用",
      title: "执行终端",
      tone: "success",
      value: "让用户知道哪些命令是安全入口，哪些只是普通终端操作。",
    },
    "execution-results": {
      files: [".project-os/runs/*", ".project-os/runs/desktop-summary.md", "HANDOFF.md"],
      next: failedTasks.length ? "重跑失败检查或生成修复任务。" : "把成功结果沉淀到 run summary 和交接记录。",
      status: failedTasks.length ? "需处理" : recentResultTasks.length ? "有结果" : "待生成",
      title: "执行结果",
      tone: failedTasks.length ? "danger" : recentResultTasks.length ? "success" : "warning",
      value: "让接入项目保留执行证据，并能从失败结果直接进入修复闭环。",
    },
  };
  const executionCapabilitySpec = executionCapabilitySpecs[id];
  const memoryCapabilitySpecs = {
    "project-facts": {
      files: [".project-os/project-profile.json", ".project-os/workspace-facts.json", ".project-os/state.json", "PROJECT.md"],
      next: profileMissingCount ? "补齐缺失事实，并标记哪些来自用户确认、哪些来自文件推断。" : "把事实来源、可信度和更新时机展示出来。",
      status: profileMissingCount ? "待补齐" : "已识别",
      title: "项目事实",
      tone: profileMissingCount ? "warning" : "success",
      value: "让接入项目不再从零理解，Agent 可以直接知道项目定位、阶段、技术栈和治理域。",
    },
    "user-preferences": {
      files: [".project-os/project-profile.json", "OmniDesk global: user-profile.json"],
      next: "提供偏好确认入口，并区分项目级偏好和全局偏好。",
      status: snapshot?.projectProfile?.userPreferences ? "已记录" : "待确认",
      title: "用户偏好",
      tone: snapshot?.projectProfile?.userPreferences ? "success" : "warning",
      value: "让 Agent 记住用户对协作方式、视觉偏好、风险边界和表达方式的要求。",
    },
    "long-term-memory": {
      files: [".project-os/memory/*", "docs/LESSONS.md", "docs/DECISIONS.md", "HANDOFF.md"],
      next: "把重要对话、决策和踩坑经验沉淀为可复用长期记忆。",
      status: memoryItems.length ? "已接入" : "待沉淀",
      title: "长期记忆",
      tone: memoryItems.length ? "success" : "warning",
      value: "让接入项目保留长期上下文，避免重复解释历史决策和约束。",
    },
    "conversation-summary": {
      files: [".project-os/conversations/*", ".project-os/runs/desktop-tasks/*"],
      next: "把会话摘要和任务、项目事实、偏好更新关联起来。",
      status: "待产品化",
      title: "会话摘要",
      tone: "warning",
      value: "让对话不只是聊天记录，而能沉淀成任务、事实、偏好和交接线索。",
    },
  };
  const memoryCapabilitySpec = memoryCapabilitySpecs[id];
  const flowStageByTopic = {
    "project-identity": ["认识项目", "项目身份、用途和阶段。"],
    "project-progress": ["认识项目", "当前进度和下一步。"],
    "project-runbook": ["认识项目", "启动、构建和检查命令。"],
    "project-risks": ["认识项目", "已知风险和边界。"],
    "local-project-state": ["认识项目", "本地接入和文件状态。"],
    "current-goal": ["定义目标", "当前目标、范围和优先级。"],
    "acceptance-criteria": ["定义目标", "完成判断和检查条件。"],
    "goal-history": ["定义目标", "目标历史和完成记录。"],
    "collaboration-boundary": ["工作规则", "AI 和用户如何分工。"],
    "execution-permissions": ["工作规则", "自动执行和确认边界。"],
    "documentation-rules": ["工作规则", "信息归属和命名规则。"],
    "system-architecture": ["设计实现", "模块、依赖和架构关系。"],
    "data-contracts": ["设计实现", "对象、状态和结构化契约。"],
    "ui-standards": ["设计实现", "组件、视觉规范和设计 token。"],
    "code-structure": ["设计实现", "目录、模块职责和实现入口。"],
    "validation-checks": ["验证交付", "当前项目可运行检查。"],
    "validation-report": ["验证交付", "目标验收和检查结果。"],
    "run-records": ["验证交付", "检查、扫描和执行历史。"],
    "handoff-records": ["复盘沉淀", "继续工作上下文。"],
    "decision-records": ["复盘沉淀", "重要取舍记录。"],
    "lessons-learned": ["复盘沉淀", "踩坑、修正和新增约束。"],
  };
  const flowStage = flowStageByTopic[id];
  const flowCapabilitySpec = flowStage ? {
    files: topic?.relatedFiles || [],
    next: topic?.nextAction || "补齐状态源、操作入口和闭环验证。",
    status: topic?.maturity || "只读",
    title: topic?.title || flowStage[0],
    tone: ["闭环", "状态化", "可验证"].includes(topic?.maturity) ? "success" : "info",
    value: `属于「${flowStage[0]}」阶段，用来让接入项目明确${flowStage[1]}`,
  } : null;
  const cards = cardsByTopic[id];
  if (!cards) return null;
  const activeCapabilitySpec = agentConfigSpec || assetCapabilitySpec || executionCapabilitySpec || memoryCapabilitySpec || flowCapabilitySpec;
  const canPreviewCapabilityFile = (file) => {
    if (!file || typeof file !== "string") return false;
    if (file.includes("*") || file.endsWith("/")) return false;
    if (file.includes(":")) return false;
    if (file.startsWith("/") || file.startsWith(".env") || file.includes("/.env")) return false;
    if (file.includes(".project-os/desktop-provider")) return false;
    if (file.split("/").includes("..")) return false;
    const extension = file.split(".").pop();
    if (!["md", "mdx", "txt", "json", "jsonc", "yaml", "yml", "toml", "js", "jsx", "ts", "tsx", "css", "scss", "html", "rs", "sh", "py", "sql"].includes(extension)) return false;
    return !["desktop/*", "cli/*", "docs/*", "schemas/*", "docs/data/*", "scripts/*", "templates/*", "adapters/*"].includes(file);
  };

  return (
    <div className="agentTopicStack" aria-label={`${topic.title}状态`}>
      <div className="agentTopicPanel">
        {cards.map(([label, value]) => (
          <div className="agentTopicCard" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {activeCapabilitySpec ? (
        <div className="agentConfigCapability">
          <div className="agentConfigCapabilityHeader">
            <div>
              <span>{agentConfigSpec ? "接入能力" : assetCapabilitySpec ? "资产能力" : executionCapabilitySpec ? "执行能力" : memoryCapabilitySpec ? "记忆能力" : "流程能力"}</span>
              <strong>{activeCapabilitySpec.title}</strong>
              <p>{activeCapabilitySpec.value}</p>
            </div>
            <Badge status={activeCapabilitySpec.tone}>{activeCapabilitySpec.status}</Badge>
          </div>
          <div className="agentConfigCapabilityGrid">
            <section>
              <span>对新项目的作用</span>
              <p>{activeCapabilitySpec.value}</p>
            </section>
            <section>
              <span>下一步动作</span>
              <p>{activeCapabilitySpec.next}</p>
            </section>
          </div>
          <div className="agentConfigFiles">
            <span>来源文件</span>
            <div>
              {activeCapabilitySpec.files.slice(0, 8).map((file) => canPreviewCapabilityFile(file) ? (
                <button key={file} type="button" onClick={() => onOpenCapabilityFile?.(file)}>
                  {file}
                </button>
              ) : (
                <code key={file}>{file}</code>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {id === "task-queue" ? (
        <div className="agentTaskQueueList">
          {visibleTasks.length ? visibleTasks.slice(0, 8).map((task) => (
            <article className={`agentTaskQueueItem status-${task.status || "unknown"}`} key={task.id}>
              <div className="agentTaskQueueMain">
                <span>{taskStatusLabel(task.status)}</span>
                <strong>{task.title || "未命名任务"}</strong>
                <p>{task.plan?.summary || task.description || task.projectName || "暂无任务摘要。"}</p>
              </div>
              <div className="agentTaskQueueMeta">
                <span>{task.patchDraft ? "已有草案" : "未生成草案"}</span>
                <span>{verifyStatusLabel(task)}</span>
                <span>{task.updatedAt || task.createdAt || "无更新时间"}</span>
              </div>
              <TaskCommandBar
                actions={actionsForTask(task, `queue-${task.id}`)}
                meta={task.status === taskStatuses.failed ? failureSummaryForTask(task) : "按任务状态进入受控执行链路。"}
              />
            </article>
          )) : (
            <Notice variant="info">暂无任务。可以从对话或目标开始创建第一批任务。</Notice>
          )}
        </div>
      ) : null}

      {id === "execution-terminal" ? (
        <div className="agentControlledCommands">
          {[
            ["Runtime 检查", "bash scripts/check-runtime.sh .", "验证 Project OS 运行规则和核心文档。"],
            ["AI 项目报告", "bash scripts/check-ai-project.sh . --write-report", "生成工程治理报告和建议。"],
            ["Web 构建", "npm --prefix desktop run web:build", "验证桌面前端是否可构建。"],
          ].map(([label, command, description]) => (
            <div className="agentControlledCommand" key={command}>
              <div>
                <strong>{label}</strong>
                <p>{description}</p>
              </div>
              <code>{command}</code>
            </div>
          ))}
        </div>
      ) : null}

      {id === "active-task" ? (
        <div className="agentTopicDetail">
          <div className="agentTopicDetailHeader">
            <div>
              <strong>{currentTask?.title || "暂无当前任务"}</strong>
              <span>{currentTask?.goalTitle ? `目标：${currentTask.goalTitle}` : "生成计划后会绑定目标、对话和执行状态。"}</span>
            </div>
            <Badge status={currentTask?.status}>{currentTask ? taskStatusLabel(currentTask.status) : "空"}</Badge>
          </div>
          <div className="agentExecutionGrid">
            <div>
              <span>计划步骤</span>
              <ul>
                {previewItems(currentPlan.steps).map((step) => <li key={step}>{step}</li>)}
                {!previewItems(currentPlan.steps).length ? <li>暂无步骤</li> : null}
              </ul>
            </div>
            <div>
              <span>候选改动</span>
              <ul>
                {previewItems(currentPlan.candidateChanges).map((item) => <li key={item}>{item}</li>)}
                {!previewItems(currentPlan.candidateChanges).length ? <li>暂无候选改动</li> : null}
              </ul>
            </div>
            <div>
              <span>验证检查</span>
              <ul>
                {currentChecks.slice(0, 3).map((check) => <li key={check.id}>{check.label}</li>)}
                {!currentChecks.length ? <li>暂无可运行检查</li> : null}
              </ul>
            </div>
          </div>
          <div className="agentTopicStatusLine">
            <span>{currentTask?.patchDraft ? `已有 Patch 草案：${formatDraftFiles(currentTask.patchDraft)}` : "尚未生成 Patch 草案"}</span>
            <span>{currentTask ? applyStatusLabel(currentTask) : "待应用"}</span>
            <span>{currentTask ? verifyStatusLabel(currentTask) : "待验证"}</span>
          </div>
          <TaskCommandBar
            actions={currentTask ? actionsForTask(currentTask, "active") : emptyTaskActions}
            meta={currentTask
              ? "操作会复用受控任务链路，写入前仍走既有确认和白名单边界。"
              : "先通过对话或右侧待办创建任务，操作链路才会启用。"}
          />
        </div>
      ) : null}

      {id === "patch-drafts" ? (
        <div className="agentTopicList">
          {patchTasks.length ? patchTasks.map((task) => (
            <div className="agentPatchItem" key={task.id}>
              <div className="agentPatchItemHeader">
                <div>
                  <strong>{task.title}</strong>
                  <span>{formatDraftFiles(task.patchDraft)}</span>
                </div>
                <Badge status={task.status}>{taskStatusLabel(task.status)}</Badge>
              </div>
              <div className="agentTopicStatusLine">
                <span>{applyStatusLabel(task)}</span>
                <span>{verifyStatusLabel(task)}</span>
                <span>{task.runSummary?.path ? `Run summary：${task.runSummary.path}` : "待写入 run summary"}</span>
                <span>{task.handoffMerge?.path ? "已更新交接" : "待更新交接"}</span>
              </div>
              <TaskCommandBar
                actions={actionsForTask(task, `patch-${task.id}`)}
                meta={task.patchDraft?.files?.length ? `${task.patchDraft.files.length} 个文件` : "草案未标注文件。"}
              />
              {task.patchDraft?.summary ? <p>{task.patchDraft.summary}</p> : null}
            </div>
          )) : (
            <Notice variant="info">还没有 Patch 草案。先在当前任务里生成改动，草案会集中出现在这里。</Notice>
          )}
        </div>
      ) : null}

      {id === "execution-results" ? (
        <div className="agentTopicList">
          {recentResultTasks.length ? recentResultTasks.map((task) => (
            <div className="agentPatchItem" key={task.id}>
              <div className="agentPatchItemHeader">
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.runSummary?.path || task.createdAt || "暂无 run summary"}</span>
                </div>
                <Badge status={task.status}>{taskStatusLabel(task.status)}</Badge>
              </div>
              <div className="agentTopicStatusLine">
                <span>{task.verificationSummary || "未记录验证摘要"}</span>
                <span>{task.handoffMerge ? "交接已更新" : "交接未更新"}</span>
              </div>
              {task.status === taskStatuses.failed ? (
                <div className="agentFailureBox">
                  <strong>失败摘要</strong>
                  <p>{failureSummaryForTask(task)}</p>
                  <div className="agentTopicStatusLine">
                    {failedRunsForTask(task).length ? failedRunsForTask(task).slice(0, 3).map((run) => (
                      <span key={`${task.id}-${run.id}-${run.finishedAt || run.command}`}>{run.label || run.id || run.command || "失败检查"}</span>
                    )) : <span>暂无失败检查明细</span>}
                  </div>
                </div>
              ) : null}
              <TaskCommandBar
                actions={[
                  {
                    key: `result-open-${task.id}`,
                    label: "打开任务",
                    onClick: () => onSelectTask?.(task.id),
                  },
                  {
                    disabled: task.status !== taskStatuses.failed || Boolean(runnerLoadingId),
                    key: `result-rerun-${task.id}`,
                    label: runnerLoadingId ? "重跑中" : "重跑失败检查",
                    onClick: () => rerunFailedChecks(task),
                  },
                  {
                    disabled: task.status !== taskStatuses.failed,
                    key: `result-repair-${task.id}`,
                    label: "生成修复任务",
                    variant: "primary",
                    onClick: () => onCreateRepairTask?.(task.id),
                  },
                ]}
                meta={task.status === taskStatuses.failed ? "失败任务可生成修复任务，进入同一套受控 Patch 和验证链路。" : "已完成任务保留结果追溯。"}
              />
            </div>
          )) : (
            <Notice variant="info">暂无已完成或失败的执行结果。</Notice>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EngineeringFileTab({
  selectedEngineeringFile,
  snapshot,
  tasks = [],
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
  onNavigateWorkbench,
  onCreateRepairTask,
  onCreateGovernanceTask,
  onCreateDesignGovernanceTask,
}) {
  const selectedTopic = selectedEngineeringFile.topic || (selectedEngineeringFile.virtual ? selectedEngineeringFile : null);
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
      const preview = await invokeWorkspaceCommand("read_engineering_file", {
        input: { path },
      });
      setRelatedFilePreview({ path, preview });
    } catch (err) {
      setRelatedFilePreview({
        error: err instanceof Error ? err.message : String(err),
        path,
      });
    }
  };

  if (selectedTopic) {
    const isOverviewTopic = ["workbench-overview", "project-identity"].includes(selectedTopic.id) || selectedTopic.title === "项目概览";
    const isCurrentProgressTopic = selectedTopic.id === "project-progress" || selectedTopic.title === "当前进度";
    const isRunbookTopic = selectedTopic.id === "project-runbook" || selectedTopic.title === "启动方式";
    const isGovernanceFilesTopic = selectedTopic.id === "governance-files" || selectedTopic.title === "治理文件";
    const isReportTopic = ["validation-report", "report-artifacts"].includes(selectedTopic.id);
    const isDesignImplementationTopic = Object.keys(designImplementationTopics).includes(selectedTopic.id);
    const isAssetCapabilityTopic = ["engineering-files", "governance-files", "report-artifacts", "schema-assets", "script-templates"].includes(selectedTopic.id);
    const isFlowCapabilityTopic = [
      "project-identity", "project-progress", "project-runbook", "project-risks", "local-project-state",
      "current-goal", "acceptance-criteria", "goal-history",
      "collaboration-boundary", "execution-permissions", "documentation-rules",
      "system-architecture", "data-contracts", "ui-standards", "code-structure",
      "validation-checks", "validation-report", "run-records",
      "handoff-records", "decision-records", "lessons-learned",
    ].includes(selectedTopic.id);
    const workspaceFacts = isOverviewTopic ? snapshot?.workspaceFacts || null : null;
    const currentProgressPanel = isCurrentProgressTopic && snapshot?.workspaceFacts
      ? <CurrentProgressPanel onSelectTask={onSelectTask} report={snapshot.workspaceFacts} snapshot={snapshot} tasks={tasks} />
      : null;
    const runbookPanel = isRunbookTopic && snapshot?.workspaceFacts
      ? <RunbookPanel report={snapshot.workspaceFacts} />
      : null;
    const reportPanel = isReportTopic
      ? <ReportArtifactsPanel snapshot={snapshot} />
      : null;
    const governanceFilesPanel = isGovernanceFilesTopic && snapshot?.workspaceFacts
      ? <GovernanceFilesHealthSection onCreateGovernanceTask={onCreateGovernanceTask} report={snapshot.workspaceFacts} />
      : null;
    const designImplementationPanel = isDesignImplementationTopic && snapshot?.workspaceFacts
      ? <DesignImplementationHealthSection onCreateDesignGovernanceTask={onCreateDesignGovernanceTask} report={snapshot.workspaceFacts} topic={selectedTopic} />
      : null;
    const agentTopic = (
      <AgentTopicPanel
        composerModelAvailability={composerModelAvailability}
        provider={provider}
        snapshot={snapshot}
        tasks={tasks}
        topic={selectedTopic}
        runnerLoadingId={runnerLoadingId}
        patchLoading={patchLoading}
        applyLoading={applyLoading}
        handoffLoading={handoffLoading}
        onGeneratePatchDraft={onGeneratePatchDraft}
        onApplyPatchDraft={onApplyPatchDraft}
        onMergeHandoff={onMergeHandoff}
        onRunGuardedCheck={onRunGuardedCheck}
        onSelectTask={onSelectTask}
        onCreateRepairTask={onCreateRepairTask}
        onOpenCapabilityFile={previewRelatedFile}
      />
    );
    const capabilityPanel = (isAssetCapabilityTopic || isFlowCapabilityTopic) ? agentTopic : null;
    const topicBody = isOverviewTopic
      ? <WorkspaceFactsPreview onCreateGovernanceTask={onCreateGovernanceTask} onNavigate={onNavigateWorkbench} provider={provider} report={workspaceFacts} snapshot={snapshot} tasks={tasks} />
      : capabilityPanel
        ? (
          <>
            {capabilityPanel}
            {currentProgressPanel || runbookPanel || reportPanel || governanceFilesPanel || designImplementationPanel}
          </>
        )
        : currentProgressPanel || runbookPanel || reportPanel || governanceFilesPanel || designImplementationPanel || agentTopic || (
          <Notice variant="info">这是项目治理地图。用户只看事项，OmniDesk 在背后维护对应文件、状态来源和更新时机。</Notice>
        );
    return (
      <Panel className="engineeringFilePreview filePreviewPanel" variant="soft">
        <div className={`engineeringFileHeader${isCurrentProgressTopic ? " progressTopicHeader" : ""}`}>
          <div>
            <strong>{selectedTopic.title}</strong>
            <p>{selectedTopic.description}</p>
          </div>
          {isCurrentProgressTopic ? (
            <span className="topicBreadcrumb">项目流程 / {selectedEngineeringFile.group}</span>
          ) : (
            <Badge>{selectedEngineeringFile.group}</Badge>
          )}
        </div>
        <div className="topicPreview">
          {topicBody}
          {(selectedTopic.governanceRole || selectedTopic.maturity || selectedTopic.nextAction || selectedTopic.statusSource || selectedTopic.updatesWhen) ? (
            <div className="topicGovernanceMeta">
              {selectedTopic.governanceRole ? (
                <div>
                  <span>治理角色</span>
                  <p>{selectedTopic.governanceRole}</p>
                </div>
              ) : null}
              {selectedTopic.maturity ? (
                <div>
                  <span>闭环程度</span>
                  <p>{selectedTopic.maturity}</p>
                </div>
              ) : null}
              {selectedTopic.statusSource ? (
                <div>
                  <span>状态来源</span>
                  <code>{selectedTopic.statusSource}</code>
                </div>
              ) : null}
              {selectedTopic.updatesWhen ? (
                <div>
                  <span>更新时机</span>
                  <p>{selectedTopic.updatesWhen}</p>
                </div>
              ) : null}
              {selectedTopic.nextAction ? (
                <div>
                  <span>下一步动作</span>
                  <p>{selectedTopic.nextAction}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="topicFileList">
            <strong>关联工程文件</strong>
            <div>
              {(selectedTopic.relatedFiles || []).map((file) => (
                <button
                  className={`topicFileButton${relatedFilePreview?.path === file ? " active" : ""}`}
                  key={file}
                  type="button"
                  onClick={() => previewRelatedFile(file)}
                >
                  {file}
                </button>
              ))}
            </div>
          </div>
          {relatedFilePreview ? (
            <div className="workspaceGovernancePreview">
              <div className="engineeringFileHeader">
                <div>
                  <strong>{relatedFilePreview.path}</strong>
                  <p>关联工程文件只读预览</p>
                </div>
                {relatedFilePreview.preview ? <Badge>{relatedFilePreview.preview.language}</Badge> : null}
              </div>
              {relatedFilePreview.loading ? (
                <Notice variant="info">正在读取文件内容...</Notice>
              ) : relatedFilePreview.error ? (
                <Notice variant="danger">{relatedFilePreview.error}</Notice>
              ) : relatedFilePreview.preview ? (
                <>
                  <div className="engineeringFileMeta">
                    <span>{formatBytes(relatedFilePreview.preview.size)}</span>
                    {relatedFilePreview.preview.truncated ? <span>已截断</span> : <span>完整预览</span>}
                  </div>
                  <pre className="engineeringFileCode">{relatedFilePreview.preview.content || "文件为空。"}</pre>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="engineeringFilePreview filePreviewPanel" variant="soft">
      <div className="engineeringFileHeader">
        <div>
          <strong>{selectedEngineeringFile.path}</strong>
          <p>{selectedEngineeringFile.description}</p>
        </div>
        {selectedEngineeringFile.preview ? (
          <Badge>{selectedEngineeringFile.preview.language}</Badge>
        ) : null}
      </div>
      {selectedEngineeringFile.loading ? (
        <Notice variant="info">正在读取文件内容...</Notice>
      ) : selectedEngineeringFile.error ? (
        <Notice variant="danger">{selectedEngineeringFile.error}</Notice>
      ) : selectedEngineeringFile.preview ? (
        <>
          <div className="engineeringFileMeta">
            <span>{formatBytes(selectedEngineeringFile.preview.size)}</span>
            {selectedEngineeringFile.preview.truncated ? <span>已截断预览</span> : <span>完整预览</span>}
          </div>
          <pre className="engineeringFileCode">{selectedEngineeringFile.preview.content || "文件为空。"}</pre>
        </>
      ) : null}
    </Panel>
  );
}

function ActiveTask({
  task,
  runnerLoadingId,
  runnerError,
  patchLoading,
  patchError,
  applyLoading,
  applyError,
  handoffLoading,
  handoffError,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunGuardedCheck,
  onSelectConversation,
  onBackToProgress,
}) {
  const runnableChecks = checksForPlan(task.plan);
  const draftActions = [
    {
      disabled: patchLoading,
      key: "generate-patch",
      label: patchLoading ? "生成中" : task.patchDraft ? "重新生成改动" : "生成改动",
      onClick: () => onGeneratePatchDraft(task.id),
      variant: task.patchDraft ? "default" : "primary",
    },
    {
      disabled: applyLoading || !task.patchDraft,
      key: "apply-patch",
      label: applyLoading ? "应用中" : "应用改动",
      onClick: () => onApplyPatchDraft(task.id),
      variant: task.patchDraft ? "primary" : "default",
    },
    {
      disabled: handoffLoading || !task.runSummary || Boolean(task.handoffMerge),
      key: "merge-handoff",
      label: handoffLoading ? "合并中" : task.handoffMerge ? "已更新交接" : "更新交接",
      onClick: () => onMergeHandoff(task.id),
    },
  ];
  const checkActions = runnableChecks.slice(0, 2).map((check) => ({
    disabled: Boolean(runnerLoadingId),
    key: check.id,
    label: runnerLoadingId === check.id ? "运行中" : check.label,
    onClick: () => onRunGuardedCheck(task.id, check.id),
  }));

  return (
    <Panel as="article" className="activeTask" variant="soft">
      <div className="activeTaskBreadcrumb">
        <button type="button" onClick={onBackToProgress}>返回当前进度</button>
        <span>任务详情</span>
      </div>
      <div className="activeTaskHeader">
        <div>
          <strong>{task.title}</strong>
          <span>{task.projectName} · {task.createdAt}</span>
          {task.goalTitle || task.conversationId ? (
            <span className="activeTaskSource">
              {task.goalTitle ? `来自目标：${task.goalTitle}` : null}
              {task.goalTitle && task.conversationId ? " · " : null}
              {task.conversationId ? "来自对话" : null}
            </span>
          ) : null}
        </div>
        <Badge status={task.status}>{taskStatusLabel(task.status)}</Badge>
      </div>
      {task.conversationId ? (
        <div className="activeTaskInlineActions">
          <button type="button" onClick={() => onSelectConversation?.(task.conversationId)}>
            回到对话
          </button>
        </div>
      ) : null}
      <div className="activeTaskPrimaryActions">
        <TaskCommandBar
          actions={[...draftActions, ...checkActions]}
          meta={task.patchDraft?.files?.length
            ? `已生成 ${task.patchDraft.files.length} 个文件的改动草稿。`
            : "先生成改动，再应用和验证。"}
        />
      </div>
      {patchError ? <Notice className="planError" variant="danger">{patchError}</Notice> : null}
      {applyError ? <Notice className="planError" variant="danger">{applyError}</Notice> : null}
      {handoffError ? <Notice className="planError" variant="danger">{handoffError}</Notice> : null}
      {runnerError ? <Notice className="planError" variant="danger">{runnerError}</Notice> : null}
      {task.applyResult ? <Notice className="providerSuccess" variant="success">{task.applyResult.message}</Notice> : null}
      {task.verificationSummary ? (
        <Notice className={task.status === taskStatuses.failed ? "providerError" : "providerSuccess"} variant={task.status === taskStatuses.failed ? "danger" : "success"}>
          {task.verificationSummary}
        </Notice>
      ) : null}
      <ReadonlyPlan plan={task.plan} />
      <details className="executionTools">
        <summary>高级详情</summary>
        <Panel className="diffPanel" variant="info">
          <div className="runnerHeader">
            <strong>改动草稿</strong>
            <span>先预览，不直接写入</span>
          </div>
          <TaskCommandBar
            actions={draftActions}
            meta={task.patchDraft?.files?.length ? `${task.patchDraft.files.length} 个文件` : "还没有生成改动。"}
          />
          {task.runSummary ? <Notice className="providerHint" variant="info">{task.runSummary.message}：{task.runSummary.path}</Notice> : null}
          {task.handoffMerge ? <Notice className="providerSuccess" variant="success">{task.handoffMerge.message}：{task.handoffMerge.path}</Notice> : null}
          {task.patchDraft ? <PatchDraft draft={task.patchDraft} /> : null}
        </Panel>
        <Panel className="runnerPanel" variant="code">
          <div className="runnerHeader">
            <strong>检查</strong>
            <span>只运行已允许的命令</span>
          </div>
          <TaskCommandBar
            actions={runnableChecks.map((check) => ({
              disabled: Boolean(runnerLoadingId),
              key: check.id,
              label: runnerLoadingId === check.id ? "运行中" : check.label,
              onClick: () => onRunGuardedCheck(task.id, check.id),
            }))}
          >
            {runnableChecks.length ? (
              null
            ) : (
              <span>当前没有可运行的检查。</span>
            )}
          </TaskCommandBar>
          {runnerError ? <Notice className="planError" variant="danger">{runnerError}</Notice> : null}
          {task.runs?.length ? (
            <div className="runnerResults">
              {task.runs.map((run) => (
                <div className={`runnerResult ${run.success ? "success" : "failed"}`} key={`${run.id}-${run.finishedAt}`}>
                  <div>
                    <strong>{run.label}</strong>
                    <span>{run.command}</span>
                  </div>
                <em>{run.success ? "通过" : `失败 ${run.code ?? ""}`}</em>
                  <pre>{run.output || "No output."}</pre>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      </details>
    </Panel>
  );
}

function PatchDraft({ draft }) {
  return (
    <Panel className="patchDraft" variant="default" padding="none">
      <div className="patchSummary">
        <strong>{draft.summary}</strong>
        <span>{draft.guardrails?.join(" · ")}</span>
      </div>
      <pre>{draft.diff || "No diff generated."}</pre>
    </Panel>
  );
}

function ReadonlyPlan({ plan }) {
  return (
    <Panel as="article" className="readonlyPlan" variant="soft">
      <div className="planHeader">
        <div>
          <strong>下一步计划</strong>
          <span>{plan.projectName}</span>
        </div>
        <Badge>待确认</Badge>
      </div>
      <p>{plan.summary}</p>
      <div className="planColumns">
        <PlanList title="怎么做" items={plan.steps} />
        <PlanList title="会看什么" items={plan.filesToRead} />
        <PlanList title="可能改哪里" items={plan.candidateChanges} />
        <PlanList title="怎么确认" items={plan.checks} mono />
        <PlanList title="边界" items={plan.guardrails} />
      </div>
    </Panel>
  );
}

function PlanList({ title, items, mono }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="planList">
      <strong>{title}</strong>
      <ul className={mono ? "monoList" : undefined}>
        {safeItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
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
  onDeleteConversation,
  onSelectTask,
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
  const [confirmGoalOpen, setConfirmGoalOpen] = useState(false);
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalSummary, setNewGoalSummary] = useState("");
  const [viewingHistoryGoalId, setViewingHistoryGoalId] = useState("");
  const activeGoal = activeGoalFromSnapshot(snapshot);
  const activeGoalTaskIds = new Set(Array.isArray(activeGoal?.taskIds) ? activeGoal.taskIds : []);
  const belongsToActiveGoal = (item) => {
    if (!activeGoal?.id) return true;
    if (item.goalId) return item.goalId === activeGoal.id;
    return activeGoalTaskIds.size ? activeGoalTaskIds.has(item.id) : true;
  };
  const visibleTasks = tasks.filter((task) => !isNoiseTask(task) && belongsToActiveGoal(task));
  const conversationGroups = groupedConversations(conversations);
  const activeTask = visibleTasks.find((task) => task.id === activeTaskId);
  const snapshotTodos = snapshotQueueTodos(snapshot).filter(belongsToActiveGoal);
  const todoMeta = visibleTasks.length || snapshotTodos.length;
  const goalTodos = visibleTasks.length
    ? visibleTasks.map((task) => ({
        description: task.plan?.summary || task.projectName || "",
        displayStatus: taskDisplayStatus(task, { activeTaskId, planLoading, terminalRunningId }),
        conversationId: task.conversationId || "",
        goalId: task.goalId || "",
        id: task.id,
        status: task.status,
        subtasks: taskSubtasks(task),
        title: task.title,
      }))
    : snapshotTodos.map((task) => ({
        ...task,
        subtasks: taskSubtasks(task),
      }));
  const progressValue = progressFromTodos(goalTodos);
  const doneCount = goalTodos.filter((todo) => todo.status === taskStatuses.done).length;
  const runningCount = goalTodos.filter((todo) => todo.displayStatus === taskStatuses.running || todo.displayStatus === taskStatuses.waitingApproval).length;
  const pendingCount = Math.max(goalTodos.length - doneCount - runningCount, 0);
  const allGoals = Array.isArray(snapshot.goals?.goals) ? snapshot.goals.goals : [];
  const activeGoalIndex = Math.max(allGoals.findIndex((goal) => goal.id === activeGoal?.id), 0);
  const completedGoals = allGoals.filter((goal) => goal.status === "done");
  const recentCompletedGoals = completedGoals.slice(0, 3);
  const draftGoals = allGoals.filter((goal) => goal.status === "draft" || (goal.status === "planned" && !Array.isArray(goal.taskIds)));
  const openGoals = allGoals.filter((goal) => !["done", "draft"].includes(goal.status) && !(goal.status === "planned" && !Array.isArray(goal.taskIds)));
  const goalTitle = activeTask?.title || activeGoal?.shortTitle || activeGoal?.title || snapshot.stage || snapshot.projectName || "当前项目";
  const validationGoal = snapshot.goalValidation?.goal || {};
  const validationReportStatus = snapshot.goalValidationReport?.status || "missing";
  const validationStatus = goalValidationStatusFromActiveGoal(activeGoal, validationGoal, validationReportStatus);
  const goalMeta = runningCount || (activeGoal?.status === "planned" && goalTodos.length)
    ? "进行中"
    : goalMetaFromStatus(activeGoal?.status || validationStatus, validationReportStatus, goalTodos, snapshot.phase);
  const goalCountMeta = `${allGoals.length ? activeGoalIndex + 1 : 0}/${allGoals.length || 0}`;
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
  const viewingCompletedGoal = goalSignedOff && viewingHistoryGoalId === activeGoal?.id;
  const showGoalDetail = hasActiveWorkGoal || viewingCompletedGoal;
  const visibleGoalTodos = viewingCompletedGoal ? goalTodos : displayedTodos;
  const visibleTaskFilterLabel = viewingCompletedGoal ? "记录" : taskFilterLabel;
  const visibleTaskFilterCount = visibleGoalTodos.length;
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
    setViewingHistoryGoalId("");
    setNewGoalOpen(false);
    setNewGoalTitle("");
    setNewGoalSummary("");
  };

  const selectGoalFromMenu = (goal) => {
    setViewingHistoryGoalId(goal?.status === "done" ? goal.id : "");
    onSwitchGoal?.(goal.id);
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
        <RailDisclosure
          title="目标"
          meta={(
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="goalHeaderSwitcher" type="button">
                  <span>{goalCountMeta}</span>
                  <ChevronDown strokeWidth={2} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="goalSwitcherMenu">
                <GoalMenuGroup activeGoalId={showGoalDetail ? activeGoal?.id : ""} title="进行中" goals={openGoals} onSwitchGoal={selectGoalFromMenu} />
                <GoalMenuGroup activeGoalId={showGoalDetail ? activeGoal?.id : ""} title="待确认" goals={draftGoals} onSwitchGoal={selectGoalFromMenu} />
                <GoalMenuGroup activeGoalId={viewingCompletedGoal ? activeGoal?.id : ""} title="已完成" goals={recentCompletedGoals} onSwitchGoal={selectGoalFromMenu} muted />
                {completedGoals.length > recentCompletedGoals.length ? (
                  <DropdownMenuItem className="goalMenuHint" onSelect={(event) => event.preventDefault()}>
                    更多历史在工程文件里查看
                  </DropdownMenuItem>
                ) : null}
                {allGoals.length ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem className="goalMenuAction" onSelect={() => setNewGoalOpen(true)}>
                  <Plus strokeWidth={2.1} aria-hidden="true" />
                  <span>新目标</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        >
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="goalTaskFilter" type="button">
                        <span>任务拆解 · {visibleTaskFilterLabel}</span>
                        <ChevronDown strokeWidth={2} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="goalTaskFilterMenu">
                      <DropdownMenuItem onSelect={() => setTaskFilter("todo")}>待办</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTaskFilter("all")}>全部</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTaskFilter("done")}>已完成</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span>{visibleTaskFilterCount}</span>
                </div>
                {visibleGoalTodos.length ? (
                  <ol className="goalTodoList">
                    {visibleGoalTodos.map((todo, index) => (
                      <GoalTaskItem
                        active={todo.id === activeTaskId}
                        description={todo.description}
                        displayStatus={todo.displayStatus}
                        index={index}
                        key={todo.id}
                        status={todo.status}
                        subtasks={todo.subtasks}
                        title={todo.title}
                        onSelect={() => onSelectTask(todo.id)}
                      />
                    ))}
                  </ol>
                ) : (
                  <div className="goalEmpty">{viewingCompletedGoal ? "还没有任务记录。" : taskFilter === "done" ? "还没有完成任务。" : "当前没有待办任务。"}</div>
                )}
              </>
            ) : null}
          </div>
        </RailDisclosure>

        <RailDisclosure className="railHistory" title="对话" meta={conversations.length}>
          <div className="queue">
            {conversations.length ? (
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
                      onDeleteConversation={onDeleteConversation}
                      onSelectConversation={onSelectConversation}
                    />
                  ))}
                </div>
              ))
            ) : (
              <Notice variant="muted">普通聊天会保存在这里；确认执行后才会进入任务。</Notice>
            )}
          </div>
        </RailDisclosure>

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

function RailDisclosure({ children, className = "", defaultOpen = false, meta, title }) {
  const metaIsAction = React.isValidElement(meta);

  return (
    <SectionGroup
      actions={metaIsAction ? meta : undefined}
      bodyClassName="railDisclosureBody"
      className={`railSection railDisclosure ${className}`}
      defaultOpen={defaultOpen}
      meta={metaIsAction ? undefined : meta}
      title={title}
    >
      {children}
    </SectionGroup>
  );
}

function ConversationHistoryItem({ conversation, active, onDeleteConversation, onSelectConversation }) {
  return (
    <Panel as="article" className={`conversationHistoryItem${active ? " active" : ""}`} padding="none">
      <button
        aria-label={`打开对话：${conversation.title}`}
        className="conversationHistoryButton"
        type="button"
        onClick={() => onSelectConversation(conversation.id)}
      >
        <div className="conversationHistoryHead">
          <strong>{conversation.title}</strong>
          <span>{conversation.updatedAt}</span>
        </div>
      </button>
      <Tooltip content="删除对话">
        <button
          aria-label={`删除对话：${conversation.title}`}
          className="conversationHistoryDelete"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteConversation(conversation.id);
          }}
        >
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </Tooltip>
    </Panel>
  );
}

function GoalMenuGroup({ activeGoalId, goals, muted = false, onSwitchGoal, title }) {
  if (!goals.length) return null;
  return (
    <>
      <div className="goalMenuGroupTitle">{title}</div>
      {goals.map((goal) => (
        <DropdownMenuItem className={`${muted ? "goalMenuItem muted" : "goalMenuItem"}${goal.id === activeGoalId ? " active" : ""}`} key={goal.id} onSelect={() => onSwitchGoal?.(goal)}>
          <span className="goalMenuTitle">{goal.shortTitle || compactGoalTitle(goal.title)}</span>
          {goal.id === activeGoalId ? <span className="goalMenuCurrent">当前</span> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function GoalStatusIcon({ displayStatus, status }) {
  const currentStatus = displayStatus || status;
  const done = currentStatus === taskStatuses.done;
  const running = currentStatus === taskStatuses.running || currentStatus === taskStatuses.waitingApproval;
  const failed = currentStatus === taskStatuses.failed;
  const label = failed ? "失败" : running ? "进行中" : done ? "已完成" : "待开始";
  return (
    <span className="goalTodoStatus" aria-label={label}>
      {done ? <Check strokeWidth={2.25} aria-hidden="true" /> : running ? <Loader2 strokeWidth={2} aria-hidden="true" /> : null}
    </span>
  );
}

function GoalTaskItem({ active, description, displayStatus, index, onSelect, status, subtasks = [], title }) {
  const currentStatus = displayStatus || status;
  const done = currentStatus === taskStatuses.done;
  const running = currentStatus === taskStatuses.running || currentStatus === taskStatuses.waitingApproval;
  const failed = currentStatus === taskStatuses.failed;
  const content = (
    <>
      <span className="goalTodoIndex">{index + 1}</span>
      <span className="goalTodoText">
        <span className="goalTodoTitle">{title}</span>
        {!done && description && !subtasks.length ? <span className="goalTodoDescription">{description}</span> : null}
      </span>
      <GoalStatusIcon displayStatus={displayStatus} status={status} />
    </>
  );

  return (
    <li className={`goalTodoItem${active ? " active" : ""}${done ? " done" : ""}${running ? " running" : ""}${failed ? " failed" : ""}`}>
      {onSelect ? (
        <button className="goalTodoButton" type="button" onClick={onSelect}>
          {content}
        </button>
      ) : (
        <div className="goalTodoButton">{content}</div>
      )}
      {!done && subtasks.length ? (
        <ol className="goalSubtaskList">
          {subtasks.map((subtask) => (
            <li className={`goalSubtask${subtask.status === taskStatuses.done ? " done" : ""}`} key={subtask.id}>
              <span>{subtask.title}</span>
              <GoalStatusIcon status={subtask.status} />
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function TaskQueueItem({ task, active, onSelectTask, onMarkTaskWaiting }) {
  const approveDisabled = task.status !== taskStatuses.planned;

  return (
    <Panel as="article" className={`queueCard taskQueueItem${active ? " active" : ""}`} padding="none">
      <button
        aria-label={`打开对话：${task.title}`}
        className="taskQueueButton"
        type="button"
        onClick={() => onSelectTask(task.id)}
      >
        <div className="queueHead">
          <strong>{task.title}</strong>
          <Badge status={task.status}>{task.status}</Badge>
        </div>
        <p>{task.projectName} · {task.createdAt}</p>
      </button>
      <div className="taskActions">
        <Button size="sm" variant="primary" type="button" onClick={() => onMarkTaskWaiting(task.id)} disabled={approveDisabled}>
          开始执行
        </Button>
      </div>
    </Panel>
  );
}

function ProviderPanel({ provider, modelCatalog, source, onSaveProvider, onSaveProviderSecret, onDeleteProviderProfile, providerError }) {
  const [form, setForm] = useState(provider);
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [detectedModels, setDetectedModels] = useState([]);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [modelTestLoading, setModelTestLoading] = useState(false);
  const [modelTestMessage, setModelTestMessage] = useState("");
  const catalogProviders =
    Array.isArray(modelCatalog?.providers) && modelCatalog.providers.length
      ? modelCatalog.providers
      : fallbackModelCatalog.providers;
  const profiles = Array.isArray(provider.profiles) ? provider.profiles : [];
  const activePreset =
    catalogProviders.find((preset) => preset.apiBase === form.apiBase && preset.apiKeyEnv === form.apiKeyEnv) ||
    catalogProviders.find((preset) => preset.id === selectedProviderId) ||
    catalogProviders.find((preset) => preset.id === form.profileId) ||
    catalogProviders.find((preset) => preset.id === "gateway") ||
    catalogProviders[0];
  const modelOptions = Array.from(new Set([
    form.model,
    ...(detectedModels.length ? detectedModels : (activePreset?.models || [])),
  ].filter(Boolean)));
  const isPreview = source !== "tauri";
  const savedProfile = profiles.find((profile) => profile.id === form.profileId);
  const isCreatingProfile = Boolean(form.profileId) && !savedProfile;
  const currentHasApiKey = isCreatingProfile ? Boolean(apiKey.trim()) : Boolean(savedProfile?.hasApiKey ?? provider.hasApiKey);
  const currentConnectionName = form.profileName || activeProviderProfileName(provider);
  const usesCatalogPreset = Boolean(
    activePreset &&
    form.apiBase === activePreset.apiBase &&
    form.apiKeyEnv === activePreset.apiKeyEnv
  );
  const advancedFieldsReadOnly = usesCatalogPreset && !isCreatingProfile;

  useEffect(() => {
    setForm({
      ...provider,
      profileId: provider.activeProfileId || provider.profileId || "",
      profileName:
        provider.profiles?.find((profile) => profile.id === provider.activeProfileId)?.name ||
        provider.profileName ||
        "",
      profileNote:
        provider.profiles?.find((profile) => profile.id === provider.activeProfileId)?.note ||
        provider.profileNote ||
        "",
      profileWebsite:
        provider.profiles?.find((profile) => profile.id === provider.activeProfileId)?.website ||
        provider.profileWebsite ||
        "",
    });
    setSelectedProviderId(
      catalogProviders.find((preset) => preset.apiBase === provider.apiBase && preset.apiKeyEnv === provider.apiKeyEnv)?.id ||
      provider.profileId ||
      provider.activeProfileId ||
      "gateway"
    );
    setDetectedModels([]);
    setProbeError("");
    setModelTestMessage("");
    setCustomModel(false);
  }, [provider, modelCatalog]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const createProfile = () => {
    const id = `profile-${Date.now()}`;
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const preset = activePreset || catalogProviders.find((item) => item.id === "gateway") || catalogProviders[0];
    setApiKey("");
    setCustomModel(true);
    setDetectedModels([]);
    setProbeError("");
    setModelTestMessage("");
    setSelectedProviderId(preset?.id || "gateway");
    setForm((current) => ({
      ...current,
      provider: preset?.provider || "openai-compatible",
      model: "",
      apiBase: "",
      apiKeyEnv: `OMNIDESK_API_KEY_${suffix}`,
      enabled: true,
      profileId: id,
      profileName: "",
      profileNote: "",
      profileWebsite: "",
    }));
  };

  const applyPreset = (preset) => {
    setSelectedProviderId(preset.id);
    setForm((current) => ({
      ...current,
      provider: preset.provider || "openai-compatible",
      model: preset.models.includes(current.model) ? current.model : preset.models[0],
      apiBase: preset.apiBase,
      apiKeyEnv: preset.apiKeyEnv,
      enabled: true,
      profileId: current.profileId || provider.activeProfileId || preset.id,
      profileName: current.profileName || preset.label,
      profileNote: preset.note || "",
      profileWebsite: preset.website || "",
    }));
  };

  const selectProfile = (event) => {
    const profile = profiles.find((item) => item.id === event.target.value);
    if (!profile) return;
    editProfile(profile);
  };

  const editProfile = (profile) => {
    setSelectedProviderId(
      catalogProviders.find((preset) => preset.apiBase === profile.apiBase && preset.apiKeyEnv === profile.apiKeyEnv)?.id ||
      "gateway"
    );
    setCustomModel(false);
    setForm((current) => ({
      ...current,
      profileId: profile.id,
      profileName: profile.name,
      profileNote: profile.note || "",
      profileWebsite: profile.website || "",
      provider: profile.provider,
      model: profile.model,
      apiBase: profile.apiBase,
      apiKeyEnv: profile.apiKeyEnv,
      enabled: true,
    }));
  };

  const deleteProfile = async (profile) => {
    if (!profile) return;
    const confirmed = window.confirm(`删除连接「${profile.name || "未命名连接"}」？\n如果这个 Key 没有被其他连接共用，也会从 .env.local 移除。`);
    if (!confirmed) return;
    const ok = await onDeleteProviderProfile?.(profile.id);
    if (ok) {
      setApiKey("");
      setCustomModel(false);
      setDetectedModels([]);
      setProbeError("");
      setModelTestMessage("");
    }
  };

  const selectPreset = (event) => {
    const preset = catalogProviders.find((item) => item.id === event.target.value);
    if (preset) {
      setCustomModel(false);
      applyPreset(preset);
    }
  };

  const selectModel = (event) => {
    if (event.target.value === "__custom") {
      setCustomModel(true);
      updateField("model", "");
      return;
    }
    setCustomModel(false);
    updateField("model", event.target.value);
  };

  const probeModels = async () => {
    if (isPreview) {
      setProbeError("");
      setModelTestMessage("");
      return false;
    }
    setProbeError("");
    setModelTestMessage("");
    setProbeLoading(true);
    try {
      const previousModel = form.model;
      const result = await invokeWorkspaceCommand("probe_provider_models", {
        input: {
          apiBase: form.apiBase,
          apiKeyEnv: form.apiKeyEnv,
          apiKey,
        },
      });
      const models = Array.isArray(result.models) ? result.models : [];
      setDetectedModels(models);
      if (models.length && previousModel && models.includes(previousModel)) {
        setModelTestMessage(`已读取 ${models.length} 个模型，当前模型 ${previousModel} 可见。`);
      } else if (models.length && previousModel) {
        setCustomModel(false);
        updateField("model", models[0]);
        setModelTestMessage(`已读取 ${models.length} 个模型，${previousModel} 不在当前 Key 可见列表中，已切到 ${models[0]}。`);
      } else if (models.length) {
        setCustomModel(false);
        updateField("model", models[0]);
        setModelTestMessage(`已读取 ${models.length} 个模型，已选择 ${models[0]}。`);
      } else {
        setModelTestMessage("已连接，但没有读取到可见模型。");
      }
      return true;
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setProbeLoading(false);
    }
  };

  const testCurrentModel = async () => {
    if (isPreview) {
      setModelTestMessage("");
      return false;
    }
    setProbeError("");
    setModelTestMessage("");
    setModelTestLoading(true);
    try {
      const result = await invokeWorkspaceCommand("test_provider_model", {
        input: {
          apiBase: form.apiBase,
          apiKeyEnv: form.apiKeyEnv,
          model: form.model,
          apiKey,
        },
      });
      setModelTestMessage(result.message || `${form.model} 可用`);
      return true;
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setModelTestLoading(false);
    }
  };

  const submitProvider = async (event) => {
    event.preventDefault();
    if (isPreview) {
      setProbeError("");
      return;
    }

    if (apiKey.trim()) {
      await probeModels();
    }

    const ok = await onSaveProvider(form);
    if (ok && apiKey.trim()) {
      const saved = await onSaveProviderSecret(form.apiKeyEnv, apiKey);
      if (saved) {
        setApiKey("");
      }
    }
  };

  return (
	    <Panel as="form" className={`providerPanel${isCreatingProfile ? " providerPanel-creating" : ""}`} onSubmit={submitProvider}>
	      <ProviderStatusRow
	        enabled={form.enabled}
	        hasApiKey={currentHasApiKey}
	        keyLabel={isCreatingProfile ? "Key 待填写" : undefined}
	        modelLabel={form.model || "未选模型"}
	        profileLabel={currentConnectionName}
	        statusLabel={isCreatingProfile ? "正在新建" : undefined}
	        variant={isCreatingProfile ? "creating" : "default"}
	      />
      {isPreview ? (
        <InfoCallout>当前是浏览器预览；保存 Key、刷新模型和写入配置需要在桌面 App 窗口中操作，删除已保存连接可在预览中验证。</InfoCallout>
      ) : null}
      <div className="providerSavedConnections" aria-label="已保存连接">
        <div className="providerSectionTitle">
          <span>已保存连接</span>
          <Button className="textAction" size="sm" variant="ghost" type="button" onClick={probeModels} disabled={probeLoading || isPreview}>
            {probeLoading ? "测试中" : "测试当前"}
          </Button>
        </div>
        {profiles.length ? (
          <div className="providerConnectionList">
            {profiles.map((profile) => {
              const active = profile.id === form.profileId;
              return (
                <div className={`providerConnectionItem${active ? " active" : ""}`} key={profile.id}>
                  <button className="providerConnectionMain" type="button" onClick={() => editProfile(profile)}>
                    <strong>{providerConnectionLabel(profile)}</strong>
                  </button>
                  <button
                    className="tileRemoveButton providerConnectionRemove"
                    type="button"
                    onClick={() => deleteProfile(profile)}
                    aria-label={`删除连接 ${providerConnectionLabel(profile)}`}
                  >
                    <X strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button className="providerConnectionItem providerConnectionAdd" type="button" onClick={createProfile} aria-label="新建连接">
              <Plus strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button className="providerConnectionItem providerConnectionAdd providerConnectionAdd-empty" type="button" onClick={createProfile}>
            <Plus strokeWidth={2.25} aria-hidden="true" />
            <span>新建连接</span>
          </button>
        )}
        {providerError ? <Notice className="providerError providerConnectionError" variant="danger">{providerError}</Notice> : null}
      </div>
      <div className="providerSectionTitle">基础设置</div>
      <Field label="连接名称" hint="只用于识别，不影响实际调用。">
        {({ id }) => <Input
          id={id}
          value={form.profileName || ""}
          onChange={(event) => updateField("profileName", event.target.value)}
          placeholder="例如：公司网关、我的 OpenAI"
        />}
      </Field>
      <Field label={<RequiredLabel>服务商</RequiredLabel>}>
        {({ id }) => <Select id={id} value={selectedProviderId || activePreset?.id || "gateway"} onChange={selectPreset}>
          {catalogProviders.map((preset) => (
            <option value={preset.id} key={preset.id}>{preset.label}</option>
          ))}
        </Select>}
      </Field>
      <Field label={<RequiredLabel>API 地址</RequiredLabel>}>
        {({ id }) => <Input id={id} value={form.apiBase} onChange={(event) => updateField("apiBase", event.target.value)} placeholder="https://api.example.com/v1" />}
      </Field>
      <Field label={<RequiredLabel>API Key</RequiredLabel>} hint={currentHasApiKey && !isCreatingProfile ? "已保存，可留空；填写新 Key 会覆盖当前连接。" : "新连接需要填写 API Key。"}>
        {({ id }) => <Input
          id={id}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={currentHasApiKey && !isCreatingProfile ? "已保存；留空则不修改" : "粘贴你的 API Key"}
        />}
      </Field>
      <div className="providerSectionTitle">
        <span>模型</span>
        <span className="modelActions">
          <Button className="textAction" size="sm" variant="ghost" type="button" onClick={probeModels} disabled={probeLoading || isPreview}>
            {probeLoading ? "检测中" : "刷新列表"}
          </Button>
        </span>
      </div>
      <Field label={<RequiredLabel>模型</RequiredLabel>}>
        {({ id }) => <Select id={id} value={!customModel && modelOptions.includes(form.model) ? form.model : "__custom"} onChange={selectModel}>
          {modelOptions.map((model) => (
            <option value={model} key={model}>{model}</option>
          ))}
          <option value="__custom">自定义</option>
        </Select>}
      </Field>
      {customModel || !modelOptions.includes(form.model) ? (
        <Field label={<RequiredLabel>自定义模型</RequiredLabel>}>
          {({ id }) => <Input
            id={id}
            value={form.model}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="例如：gpt-4o-mini"
          />}
        </Field>
      ) : null}
      {modelTestMessage ? <Notice className="providerSuccess" variant="success">{modelTestMessage}</Notice> : null}
      <details className="advancedProvider">
        <summary>
          <span>高级设置</span>
          {usesCatalogPreset ? <small>来自服务商预设</small> : <small>自定义连接</small>}
        </summary>
        <Field label="备注">
          {({ id }) => <Input
            id={id}
            value={form.profileNote || ""}
            onChange={(event) => updateField("profileNote", event.target.value)}
            placeholder="例如：团队共用"
            readOnly={advancedFieldsReadOnly}
          />}
        </Field>
        <Field className="providerReadOnly" label="接入方式">
          {({ id }) => <Input id={id} value={form.provider} onChange={(event) => updateField("provider", event.target.value)} readOnly={advancedFieldsReadOnly} />}
        </Field>
        <Field label="Key 保存变量名">
          {({ id }) => <Input id={id} value={form.apiKeyEnv} onChange={(event) => updateField("apiKeyEnv", event.target.value)} readOnly={advancedFieldsReadOnly} />}
        </Field>
        <Field label="官网链接">
          {({ id }) => <Input
            id={id}
            value={form.profileWebsite || ""}
            onChange={(event) => updateField("profileWebsite", event.target.value)}
            placeholder="https://..."
            readOnly={advancedFieldsReadOnly}
          />}
        </Field>
      </details>
      <div className="toggleRow">
        <Switch
          aria-label="启用当前连接"
          checked={form.enabled}
          onCheckedChange={(checked) => updateField("enabled", checked)}
        />
        <span>
          启用当前连接
          <small>关闭后不调用模型，改用本地规则回答。</small>
        </span>
      </div>
      <Button variant="primary" type="submit" disabled={isPreview}>保存并启用</Button>
      {probeError ? <Notice className="providerError" variant="danger">{probeError}</Notice> : null}
    </Panel>
  );
}

function RequiredLabel({ children }) {
  return (
    <span className="requiredLabel">
      {children}
      <span aria-hidden="true" className="requiredMark">*</span>
    </span>
  );
}

function StatusBar({ snapshot, source }) {
  return (
    <footer className="bottombar">
      <span>{source === "tauri" ? "本地模式" : "浏览器预览"}</span>
      <span className="safe">本地安全</span>
      <span>{snapshot.projectName}</span>
    </footer>
  );
}

function ProjectProfileItem({ body, missing, title }) {
  return (
    <div className={`contextItem${missing ? " missing" : ""}`}>
      <div>
        <strong>{title}</strong>
        <p>{body || "待补充到项目文档"}</p>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const sidebarSizing = {
  leftDefault: 248,
  leftMin: 220,
  leftMax: 420,
  rightDefault: 248,
  rightMin: 220,
  rightMax: 420,
};

function clampSidebarWidth(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function App() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [readonlyPlan, setReadonlyPlan] = useState(fallbackPlan);
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [chatTurns, setChatTurns] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(() => `conv-${Date.now()}`);
  const [provider, setProvider] = useState(fallbackProvider);
  const [modelCatalog, setModelCatalog] = useState(fallbackModelCatalog);
  const [composerModels, setComposerModels] = useState([]);
  const [composerModelsKey, setComposerModelsKey] = useState("");
  const [composerModelsSource, setComposerModelsSource] = useState("");
  const [composerModelsLoading, setComposerModelsLoading] = useState(false);
  const [composerModelTests, setComposerModelTests] = useState({});
  const [composerModelTesting, setComposerModelTesting] = useState(false);
  const [source, setSource] = useState("preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [runnerLoadingId, setRunnerLoadingId] = useState("");
  const [runnerError, setRunnerError] = useState("");
  const [terminalRunningId, setTerminalRunningId] = useState("");
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalText, setTerminalText] = useState("");
  const [terminalChunks, setTerminalChunks] = useState([]);
  const [terminalSession, setTerminalSession] = useState(null);
  const [terminalError, setTerminalError] = useState("");
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [validatingGoal, setValidatingGoal] = useState(false);
  const [signingGoal, setSigningGoal] = useState(false);
  const [goalRefinementMode, setGoalRefinementMode] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [toast, setToast] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [projectActivities, setProjectActivities] = useState({});
  const [conversationResetKey, setConversationResetKey] = useState(0);
  const [selectedEngineeringFile, setSelectedEngineeringFile] = useState(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(sidebarSizing.leftDefault);
  const [rightWidth, setRightWidth] = useState(sidebarSizing.rightDefault);
  const activePlanRequestRef = React.useRef(null);
  const workspaceWatcherRefreshRef = React.useRef(0);

  const showToast = (message, variant = "success") => {
    setToast({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, message, variant });
  };

  const beginActionFeedback = (key, message) => {
    setActionFeedback({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key,
      message,
      status: "running",
    });
  };

  const finishActionFeedback = (key, status, message) => {
    setActionFeedback((current) => {
      if (current?.key && current.key !== key) return current;
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        key,
        message,
        status,
      };
    });
    showToast(message, status === "failed" ? "danger" : "success");
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!actionFeedback || actionFeedback.status === "running") return undefined;
    const timer = window.setTimeout(() => setActionFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => {
    const projectId = snapshot.currentProjectId;
    if (!projectId) return;
    const relatedTasks = tasks.filter((task) => {
      if (task.projectId && task.projectId === projectId) return true;
      if (task.projectPath && task.projectPath === snapshot.currentProjectPath) return true;
      return task.projectName && task.projectName === snapshot.projectName;
    });
    let nextActivity = null;
    if (planLoading || relatedTasks.some((task) => task.id === terminalRunningId)) {
      nextActivity = { tone: "running", label: "进行中" };
    } else if (relatedTasks.some((task) => [taskStatuses.failed, "interrupted", "canceled", "cancelled", "error"].includes(task.status))) {
      nextActivity = { tone: "danger", label: "任务或会话中断" };
    }
    setProjectActivities((current) => {
      const next = { ...current };
      if (nextActivity) {
        next[projectId] = nextActivity;
      } else {
        delete next[projectId];
      }
      return next;
    });
  }, [snapshot.currentProjectId, snapshot.currentProjectPath, snapshot.projectName, tasks, planLoading, terminalRunningId]);

  const markProjectActivitySeen = (projectId) => {
    if (!projectId) return;
    setProjectActivities((current) => {
      const activity = current[projectId];
      if (!activity?.tone || ["danger", "running"].includes(activity.tone)) return current;
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  };

  const beginSidebarResize = (side, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    const min = side === "left" ? sidebarSizing.leftMin : sidebarSizing.rightMin;
    const max = side === "left" ? sidebarSizing.leftMax : sidebarSizing.rightMax;

    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = side === "left" ? startWidth + delta : startWidth - delta;
      const clamped = clampSidebarWidth(nextWidth, min, max);
      if (side === "left") {
        setLeftWidth(clamped);
      } else {
        setRightWidth(clamped);
      }
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("isResizingSidebar");
    };

    document.body.classList.add("isResizingSidebar");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const updateChatTurns = (nextTurns) => {
    setChatTurns(nextTurns);
    if (!nextTurns.length) return;
    const now = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setConversations((current) => {
      const title = conversationTitle(nextTurns);
      const record = {
        id: activeConversationId,
        preview: conversationPreview(nextTurns),
        title,
        turns: nextTurns.map((turn) => ({
          actions: turn.actions,
          id: turn.id,
          role: turn.role,
          text: turn.text,
        })),
        updatedAt: now,
      };
      const merged = current
        .filter((conversation) => conversation.id !== activeConversationId && conversation.title !== title);
      const next = [record, ...merged].slice(0, 50);
      try {
        window.localStorage?.setItem(projectScopedStorageKey(snapshot, "conversations.v1"), JSON.stringify(next));
      } catch {
        // localStorage may be unavailable in some embedded contexts.
      }
      return next;
    });
  };

  const resetWorkspaceEphemeralState = (nextSnapshot) => {
    setActiveConversationId(`conv-${Date.now()}`);
    setChatTurns([]);
    setActiveTaskId("");
    setReadonlyPlan(null);
    setSelectedEngineeringFile(null);
    setPlanError("");
    setRunnerError("");
    setPatchError("");
    setApplyError("");
    setHandoffError("");
    setTerminalLogs([]);
    setTerminalText("");
    setTerminalChunks([]);
    setTerminalSession(null);
    setTerminalError("");
    try {
      const records = JSON.parse(window.localStorage?.getItem(projectScopedStorageKey(nextSnapshot, "conversations.v1")) || "[]");
      setConversations(Array.isArray(records) ? records.slice(0, 50) : []);
    } catch {
      setConversations([]);
    }
    loadDesktopTasks()
      .then((records) => setTasks(Array.isArray(records) ? records : []))
      .catch(() => setTasks([]));
  };

  const setAndPersistTask = async (nextTask) => {
    setTasks((current) => {
      const exists = current.some((task) => task.id === nextTask.id);
      return exists
        ? current.map((task) => (task.id === nextTask.id ? nextTask : task))
        : [nextTask, ...current];
    });
    setActiveTaskId(nextTask.id);
    if (nextTask.plan) {
      setReadonlyPlan(nextTask.plan);
    }
    if (nextTask.status === taskStatuses.done) {
      const projectId = nextTask.projectId || snapshot.currentProjectId;
      if (projectId) {
        setProjectActivities((current) => ({
          ...current,
          [projectId]: {
            tone: "success",
            label: "有新完成结果",
            taskId: nextTask.id,
          },
        }));
      }
    }
    try {
      await persistDesktopTask(nextTask);
    } catch (err) {
      setRunnerError(err instanceof Error ? err.message : String(err));
    }
  };

  const applySnapshot = (nextSnapshot) => {
    setSnapshot({ ...fallbackSnapshot, ...nextSnapshot });
    setSource(isTauriRuntime() ? "tauri" : "preview");
    setError("");
  };

  const refreshSnapshotFromSource = async () => {
    const nextSnapshot = await loadWorkspaceSnapshot();
    applySnapshot(nextSnapshot);
    return nextSnapshot;
  };

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let cancelled = false;
    let unlisten = null;

    const startWatcher = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("workspace://files-changed", async (event) => {
          const now = Date.now();
          if (now - workspaceWatcherRefreshRef.current < 1200) return;
          workspaceWatcherRefreshRef.current = now;
          try {
            await refreshSnapshotFromSource();
            if (cancelled) return;
            const path = event.payload?.path ? `：${event.payload.path}` : "";
            showToast(`治理骨架已变化，页面已同步${path}`, "success");
          } catch (err) {
            if (!cancelled) {
              showToast(`治理状态自动同步失败：${err instanceof Error ? err.message : String(err)}`, "danger");
            }
          }
        });
        await invokeWorkspaceCommand("start_workspace_file_watcher");
      } catch (err) {
        if (!cancelled) {
          showToast(`工程文件监听启动失败：${err instanceof Error ? err.message : String(err)}`, "danger");
        }
      }
    };

    startWatcher();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [snapshot.currentProjectPath]);

  useEffect(() => {
    let cancelled = false;
    const handleRefreshRequest = async () => {
      const now = Date.now();
      if (now - workspaceWatcherRefreshRef.current < 800) return;
      workspaceWatcherRefreshRef.current = now;
      try {
        await refreshSnapshotFromSource();
      } catch (err) {
        if (!cancelled) {
          showToast(`治理状态刷新失败：${err instanceof Error ? err.message : String(err)}`, "danger");
        }
      }
    };
    window.addEventListener("project-os:snapshot-refresh-requested", handleRefreshRequest);
    return () => {
      cancelled = true;
      window.removeEventListener("project-os:snapshot-refresh-requested", handleRefreshRequest);
    };
  }, [snapshot.currentProjectPath]);

  useEffect(() => {
    if (isTauriRuntime()) return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const now = Date.now();
      if (now - workspaceWatcherRefreshRef.current < 30000) return;
      workspaceWatcherRefreshRef.current = now;
      try {
        await refreshSnapshotFromSource();
      } catch (err) {
        if (!cancelled) {
          showToast(`治理状态轮询失败：${err instanceof Error ? err.message : String(err)}`, "danger");
        }
      }
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [snapshot.currentProjectPath]);

  const validateGoal = async () => {
    const feedbackKey = "validate-goal";
    beginActionFeedback(feedbackKey, "正在验证目标...");
    setValidatingGoal(true);
    setError("");
    try {
      const nextSnapshot = await runGoalValidationCheck();
      applySnapshot(nextSnapshot);
      finishActionFeedback(feedbackKey, "success", "目标验收已完成。");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      finishActionFeedback(feedbackKey, "failed", `目标验收失败：${message}`);
    } finally {
      setValidatingGoal(false);
    }
  };

  const signOffGoal = async () => {
    const feedbackKey = "signoff-goal";
    beginActionFeedback(feedbackKey, "正在确认完成...");
    setSigningGoal(true);
    setError("");
    try {
      const nextSnapshot = await signOffGoalValidation();
      applySnapshot(nextSnapshot);
      setGoalRefinementMode(false);
      finishActionFeedback(feedbackKey, "success", "目标已确认完成。");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      finishActionFeedback(feedbackKey, "failed", `确认完成失败：${message}`);
    } finally {
      setSigningGoal(false);
    }
  };

  const refineGoal = () => {
    setGoalRefinementMode(true);
  };

  const createGoal = async (input) => {
    setError("");
    const title = input?.title?.trim() || "新的目标";
    const summary = input?.summary?.trim() || "新的目标已开始。";
    try {
      const nextSnapshot = await createWorkspaceGoal({
        title,
        summary,
      });
      applySnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const switchGoal = async (id) => {
    setError("");
    try {
      const nextSnapshot = await switchWorkspaceGoal({ id });
      applySnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmGoal = async (id) => {
    setError("");
    try {
      const nextSnapshot = await confirmWorkspaceGoal({ id });
      applySnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    let cancelled = false;

    loadWorkspaceSnapshot()
      .then((nextSnapshot) => {
        if (cancelled) return;
        applySnapshot(nextSnapshot);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setSource("preview");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadWorkspaceSnapshot()
        .then((nextSnapshot) => applySnapshot(nextSnapshot))
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const records = JSON.parse(window.localStorage?.getItem(projectScopedStorageKey(snapshot, "conversations.v1")) || "[]");
      if (Array.isArray(records)) {
        setConversations(records.slice(0, 50));
      }
    } catch {
      setConversations([]);
    }
  }, [snapshot.currentProjectId, snapshot.currentProjectPath]);

  useEffect(() => {
    let cancelled = false;

    loadDesktopTasks()
      .then((records) => {
        if (cancelled || !Array.isArray(records)) return;
        setTasks(records);
      })
      .catch((err) => {
        if (!cancelled) {
          setRunnerError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadProviderStatus(),
      loadModelCatalog(),
      loadModelHealth().catch(() => ({
        schemaVersion: "project-os.model-health.v0.1",
        entries: [],
      })),
    ])
      .then(([status, catalog, modelHealth]) => {
        if (!cancelled) {
          setProvider({ ...fallbackProvider, ...status });
          setModelCatalog({ ...fallbackModelCatalog, ...catalog });
          const entries = Array.isArray(modelHealth?.entries) ? modelHealth.entries : [];
          setComposerModelTests(Object.fromEntries(
            entries.map((entry) => [
              [entry.apiBase || entry.api_base || "", entry.apiKeyEnv || entry.api_key_env || "", entry.model || ""].join("|"),
              {
                checkedAt: entry.checkedAt || entry.checked_at || "",
                message: entry.message || "",
                status: entry.status || "unknown",
              },
            ])
          ));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProviderError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setTerminalText("浏览器预览不能启动本地终端。请在桌面 App 窗口里使用完整终端。");
      return undefined;
    }

    let cancelled = false;
    let unlisten = null;

    const startTerminal = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("terminal://output", (event) => {
          const payload = event.payload || {};
          if (payload.sessionId && payload.sessionId !== "main") return;
          setTerminalChunks((current) => [
            ...current,
            {
              data: payload.data || "",
              id: `${Date.now()}-${current.length}`,
            },
          ].slice(-2000));
          setTerminalText((current) => `${current}${cleanTerminalText(payload.data || "")}`.slice(-50000));
        });
        setTerminalChunks([]);
        const session = await invokeWorkspaceCommand("start_terminal_session", {
          input: { sessionId: "main", cols: 120, rows: 32 },
        });
        if (!cancelled) {
          setTerminalSession(session);
          setTerminalError("");
          setTerminalText((current) => current || `Connected to ${session.shell} at ${session.cwd}\n`);
        }
      } catch (err) {
        if (!cancelled) {
          setTerminalError(err instanceof Error ? err.message : String(err));
          setTerminalText((current) => current || "终端启动失败。");
        }
      }
    };

    startTerminal();

    return () => {
      cancelled = true;
      if (unlisten) {
        unlisten();
      }
      invokeWorkspaceCommand("stop_terminal_session", {
        input: { sessionId: "main" },
      }).catch(() => {});
    };
  }, []);

  const switchProject = async (id) => {
    const project = snapshot.projects.find((item) => item.id === id);
    if (!project || project.isCurrent) return;

    setLoading(true);
    setProjectActionError("");
    try {
      const nextSnapshot = source !== "tauri"
        ? await switchPreviewProject(id)
        : await invokeWorkspaceCommand("switch_registry_project", { id });
      applySnapshot(nextSnapshot);
      resetWorkspaceEphemeralState({ ...fallbackSnapshot, ...nextSnapshot });
      showToast(`已切换到 ${nextSnapshot.projectName || project.name}`);
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (path) => {
    setProjectActionError("");
    setLoading(true);
    try {
      const nextSnapshot = await invokeWorkspaceCommand("add_registry_project", { path });
      applySnapshot(nextSnapshot);
      resetWorkspaceEphemeralState({ ...fallbackSnapshot, ...nextSnapshot });
      showToast(`已添加 ${nextSnapshot.projectName || "项目"}`);
      return true;
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const pickProject = async () => {
    setProjectActionError("");
    try {
      const selected = await pickProjectDirectory();
      if (!selected) return;
      await addProject(Array.isArray(selected) ? selected[0] : selected);
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const relocateProject = async (id) => {
    const project = snapshot.projects.find((item) => item.id === id);
    if (!project) return;
    setProjectActionError("");
    try {
      const selected = await pickProjectDirectory();
      if (!selected) return;
      const path = Array.isArray(selected) ? selected[0] : selected;
      setLoading(true);
      const nextSnapshot = source !== "tauri"
        ? await relocatePreviewProject(id, path)
        : await invokeWorkspaceCommand("relocate_registry_project", {
          input: { id, path },
        });
      applySnapshot(nextSnapshot);
      resetWorkspaceEphemeralState({ ...fallbackSnapshot, ...nextSnapshot });
      showToast(`已重新定位 ${project.name}`);
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const removeProject = async (id) => {
    const project = snapshot.projects.find((item) => item.id === id);
    if (!project) return;
    if (snapshot.projects.length <= 1) {
      setProjectActionError("至少保留一个工作台项目；可以先添加新项目，再移除这个项目。");
      return;
    }
    setProjectActionError("");
    setLoading(true);
    try {
      const nextSnapshot = await invokeWorkspaceCommand("remove_registry_project", { id });
      applySnapshot(nextSnapshot);
      resetWorkspaceEphemeralState({ ...fallbackSnapshot, ...nextSnapshot });
      showToast(`已移除 ${project.name}`);
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const openProjectFolder = async (id) => {
    setProjectActionError("");
    try {
      await invokeWorkspaceCommand("open_project_folder", { id });
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const renameProject = async (id, name) => {
    setProjectActionError("");
    setLoading(true);
    try {
      const nextSnapshot = await invokeWorkspaceCommand("rename_registry_project", {
        input: { id, name },
      });
      applySnapshot(nextSnapshot);
      return true;
    } catch (err) {
      setProjectActionError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const selectEngineeringFile = async (file) => {
    const nextFile = {
      ...file,
      error: "",
      loading: true,
      preview: null,
    };
    setSelectedEngineeringFile(nextFile);
    setActiveTaskId("");
    setReadonlyPlan(null);
    setPlanError("");

    if (file.virtual && Array.isArray(file.relatedFiles)) {
      setSelectedEngineeringFile({
        ...nextFile,
        loading: false,
        topic: {
          id: file.id,
          title: file.title || file.path,
          description: file.description,
          governanceRole: file.governanceRole,
          maturity: file.maturity,
          nextAction: file.nextAction,
          relatedFiles: file.relatedFiles,
          statusSource: file.statusSource,
          updatesWhen: file.updatesWhen,
        },
      });
      return;
    }

    if (file.virtual) {
      setSelectedEngineeringFile({
        ...nextFile,
        loading: false,
        preview: {
          content: "这个入口属于 OmniDesk 全局记忆，不属于当前项目文件。\n\n建议后续保存到应用级本地配置：\n- user-profile.json：用户画像\n- global-preferences.json：全局偏好\n\n这样它会跨项目生效，不污染当前项目的 .project-os/。",
          language: "text",
          name: file.path.replace("OmniDesk global: ", ""),
          size: 0,
          truncated: false,
        },
      });
      return;
    }

    try {
      const preview = await invokeWorkspaceCommand("read_engineering_file", {
        input: { path: file.path },
      });
      setSelectedEngineeringFile({
        ...nextFile,
        loading: false,
        preview,
      });
    } catch (err) {
      setSelectedEngineeringFile({
        ...nextFile,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  };

  const createRepairTask = async (failedTaskId) => {
    const failedTask = tasks.find((task) => task.id === failedTaskId);
    if (!failedTask) return false;
    const failedRuns = (failedTask.runs || []).filter((run) => run && run.success === false);
    const failedLabels = failedRuns.map((run) => run.label || run.id || run.command).filter(Boolean);
    const failureSummary =
      failedTask.applyResult?.message ||
      failedRuns[0]?.output ||
      failedTask.verificationSummary ||
      "失败原因待进一步定位。";
    const sourceTitle = failedTask.title || "失败任务";
    const repairPlan = {
      candidateChanges: failedTask.plan?.candidateChanges || [],
      checks: failedTask.plan?.checks || [],
      filesToRead: [
        ...(failedTask.plan?.filesToRead || []),
        ".project-os/runs/desktop-summary.md",
        "HANDOFF.md",
      ].filter(Boolean),
      guardrails: [
        "先定位失败原因，再生成 Patch 草案。",
        "不要绕过原任务的验证检查。",
        "修复任务仍需用户确认后才应用改动。",
      ],
      mode: "repair-task",
      projectName: failedTask.projectName || snapshot.projectName,
      steps: [
        `复盘失败任务：${sourceTitle}`,
        failedLabels.length ? `定位失败检查：${failedLabels.slice(0, 3).join("、")}` : "定位失败检查或应用错误。",
        "生成最小修复方案。",
        "重新运行失败检查并更新执行结果。",
      ],
      summary: `修复失败任务：${sourceTitle}`,
      task: `修复失败任务：${sourceTitle}`,
      trace: [
        `REPAIR_SOURCE_TASK: ${failedTask.id}`,
        `FAILURE_SUMMARY: ${String(failureSummary).slice(0, 240)}`,
      ],
    };
    const repairTask = {
      ...createTaskFromPlan(repairPlan, `修复失败任务：${sourceTitle}`, snapshot, {
        conversationId: failedTask.conversationId || activeConversationId,
      }),
      repairOfTaskId: failedTask.id,
      repairSourceTitle: sourceTitle,
    };
    await setAndPersistTask(repairTask);
    showToast("已生成修复任务，等待确认执行。", "success");
    return true;
  };

  const createGovernanceTask = async ({ files = [], status = "" } = {}) => {
    const actionableFiles = files.filter((file) => file?.path);
    if (!actionableFiles.length) return false;
    const statusTitle = {
      changed: "审阅本地变更治理文件",
      missing: "补齐缺失治理文件",
      stale: "同步可能过期治理文件",
    }[status] || "处理治理文件";
    const statusAction = {
      changed: "逐个审阅本地变更，确认是否需要同步到项目状态或交接记录。",
      missing: "确认缺失是否合理，必要时生成补齐方案。",
      stale: "复查文件内容是否过期，必要时同步到最新项目状态。",
    }[status] || "确认治理文件状态并给出处理方案。";
    const fileList = actionableFiles.map((file) => file.path);
    const domainNames = [...new Set(actionableFiles.map((file) => file.domainTitle).filter(Boolean))];
    const governancePlan = {
      candidateChanges: status === "missing"
        ? fileList.map((file) => `必要时补齐 ${file}`)
        : fileList.map((file) => `必要时同步 ${file}`),
      checks: [
        "bash scripts/check-runtime.sh .",
        "bash scripts/check-doc-structure.sh .",
      ],
      filesToRead: fileList,
      guardrails: [
        "先只读确认问题，不自动写文件。",
        "缺失文件需要判断是否确实属于当前项目。",
        "有本地变更的治理文件要保留用户已有改动。",
        "进入 Apply 前必须生成 Patch 草案并由用户确认。",
      ],
      mode: "governance-file-task",
      projectName: snapshot.projectName,
      steps: [
        `聚焦治理域：${domainNames.slice(0, 4).join("、") || "治理文件"}`,
        statusAction,
        "生成最小处理方案和 Patch 草案。",
        "运行治理检查并更新执行结果。",
      ],
      summary: `${statusTitle}：${fileList.slice(0, 3).join("、")}${fileList.length > 3 ? ` 等 ${fileList.length} 个文件` : ""}`,
      task: statusTitle,
      trace: [
        `GOVERNANCE_FILE_STATUS: ${status || "all"}`,
        `GOVERNANCE_FILE_COUNT: ${fileList.length}`,
      ],
    };
    const task = createTaskFromPlan(governancePlan, statusTitle, snapshot, {
      conversationId: activeConversationId,
    });
    await setAndPersistTask({
      ...task,
      governanceFileStatus: status,
      governanceFiles: actionableFiles,
    });
    showToast(`已生成治理文件任务：${statusTitle}`, "success");
    return true;
  };

  const createDesignGovernanceTask = async ({ files = [], topic = {} } = {}) => {
    const actionableFiles = files.filter((file) => file?.path);
    if (!actionableFiles.length) return false;
    const topicConfig = designImplementationTopics[topic?.id] || {};
    const taskTitle = topicConfig.task || `审阅${topic?.title || "设计实现"}`;
    const fileList = actionableFiles.map((file) => file.path);
    const statusSummary = [...new Set(actionableFiles.map((file) => governanceFileHealthLabel(file.status)).filter(Boolean))];
    const designPlan = {
      candidateChanges: fileList.map((file) => `必要时同步 ${file}`),
      checks: [
        "npm --prefix desktop run web:build",
        "bash scripts/check-runtime.sh .",
        "bash scripts/check-doc-structure.sh .",
      ],
      filesToRead: fileList,
      guardrails: [
        "先判断架构、契约、规范和实现是否一致，不直接重构。",
        "只生成最小治理任务和 Patch 草案，进入 Apply 前必须由用户确认。",
        "涉及代码结构时保留现有模块边界，不做无关 UI 优化。",
      ],
      mode: "design-implementation-governance",
      projectName: snapshot.projectName,
      steps: [
        `聚焦设计实现入口：${topic?.title || "设计实现"}`,
        statusSummary.length ? `确认资产状态：${statusSummary.join("、")}` : "确认设计实现资产状态。",
        "比对架构、数据契约、界面规范和实现结构是否一致。",
        "生成最小处理方案，并运行构建和治理检查。",
      ],
      summary: `${taskTitle}：${fileList.slice(0, 3).join("、")}${fileList.length > 3 ? ` 等 ${fileList.length} 个文件` : ""}`,
      task: taskTitle,
      trace: [
        `DESIGN_GOVERNANCE_TOPIC: ${topic?.id || "design-implementation"}`,
        `DESIGN_GOVERNANCE_FILE_COUNT: ${fileList.length}`,
      ],
    };
    const task = createTaskFromPlan(designPlan, taskTitle, snapshot, {
      conversationId: activeConversationId,
    });
    await setAndPersistTask({
      ...task,
      designGovernanceFiles: actionableFiles,
      designGovernanceTopic: topic?.id || "design-implementation",
    });
    showToast(`已生成设计实现治理任务：${taskTitle}`, "success");
    return true;
  };

  const generatePlan = async (request) => {
    const input = typeof request === "string" ? { task: request, attachments: [] } : request;
    const requestId = input.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const feedbackKey = `generate-plan-${requestId}`;
    activePlanRequestRef.current = requestId;
    beginActionFeedback(feedbackKey, "正在生成计划...");
    setPlanError("");
    setPlanLoading(true);
    try {
      let plan = buildPreviewPlan(input, snapshot);
      if (isTauriRuntime()) {
        try {
          plan = await invokeWorkspaceCommand("generate_readonly_plan", { input });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const isOldGeneratePlanArgs =
            message.includes("generate_readonly_plan") &&
            message.includes("missing required key") &&
            message.includes("task");
          if (!isOldGeneratePlanArgs) {
            throw err;
          }
          const attachmentNote = input.attachments?.length
            ? `\n\n附带截图：${input.attachments.map((attachment) => attachment.name).join("、")}\n提示：当前桌面端后端还未重启到多模态版本，本次先按文字和附件名称生成计划。`
            : "";
          plan = await invokeWorkspaceCommand("generate_readonly_plan", {
            task: `${input.task}${attachmentNote}`,
          });
        }
      }
      if (activePlanRequestRef.current !== requestId) return false;
      const nextTask = createTaskFromPlan(plan, input.task, snapshot, {
        conversationId: input.conversationId || activeConversationId,
      });
      setReadonlyPlan(plan);
      await setAndPersistTask(nextTask);
      finishActionFeedback(feedbackKey, "success", "已生成计划，等待确认执行。");
      return true;
    } catch (err) {
      if (activePlanRequestRef.current !== requestId) return false;
      const message = err instanceof Error ? err.message : String(err);
      setPlanError(message);
      finishActionFeedback(feedbackKey, "failed", `生成计划失败：${message}`);
      return false;
    } finally {
      if (activePlanRequestRef.current === requestId) {
        activePlanRequestRef.current = null;
        setPlanLoading(false);
      }
    }
  };

  const stopPlanGeneration = () => {
    activePlanRequestRef.current = null;
    setPlanLoading(false);
  };

  const runChatAction = async (action) => {
    if (action?.id === "confirm-active-task") {
      const targetTask = tasks.find((task) => task.id === activeTaskId);
      if (!targetTask) return false;
      markTaskWaiting(targetTask.id);
      return true;
    }
    if (action?.id === "open-topic" && action.target) {
      if (action.target === "task-queue") {
        window.dispatchEvent(new Event("project-os:open-execution"));
        const topic = topicPayloadFromOutline(action.target);
        if (topic) setSelectedEngineeringFile(topic);
        return true;
      }
      const topic = topicPayloadFromOutline(action.target);
      if (topic) {
        setSelectedEngineeringFile(topic);
        return true;
      }
      return false;
    }
    if (action?.id !== "generate-plan" || !action.task) return false;
    const ok = await generatePlan({ task: action.task, attachments: [] });
    if (ok) {
      setSelectedEngineeringFile(null);
    }
    return ok;
  };

  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  const selectTask = (id) => {
    const queueItem = snapshot.queue?.find((item) => item.id === id);
    const task = tasks.find((item) => item.id === id) || (queueItem ? {
      createdAt: "",
      id: queueItem.id,
      plan: {
        candidateChanges: [],
        checks: [],
        filesToRead: [],
        guardrails: ["这是目标拆解里的待办，开始执行前仍需确认具体改动范围。"],
        mode: "planned-task",
        projectName: snapshot.projectName,
        steps: [queueItem.body || "补齐任务执行方案。"],
        summary: queueItem.body || "",
        task: queueItem.title,
        trace: [`GOAL_TASK: ${queueItem.goalId || "current"}`],
      },
      projectId: snapshot.currentProjectId || "",
      projectName: snapshot.projectName,
      projectPath: snapshot.currentProjectPath || "",
      status: queueItem.status || taskStatuses.planned,
      title: queueItem.title,
    } : null);
    if (!task) return;
    markProjectActivitySeen(task.projectId || snapshot.currentProjectId);
    setActiveTaskId(id);
    setReadonlyPlan(task.plan);
    setSelectedEngineeringFile(null);
    window.dispatchEvent(new CustomEvent("project-os:open-execution", {
      detail: { taskId: id, source: "current-progress" },
    }));
  };

  const selectConversation = (id) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    markProjectActivitySeen(snapshot.currentProjectId);
    setActiveConversationId(id);
    setChatTurns(Array.isArray(conversation.turns) ? conversation.turns : []);
    setActiveTaskId("");
    setReadonlyPlan(null);
    setSelectedEngineeringFile(null);
  };

  const deleteConversation = (id) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    const ok = window.confirm(`删除「${conversation.title}」？`);
    if (!ok) return;

    const nextConversations = conversations.filter((item) => item.id !== id);
    setConversations(nextConversations);
    try {
      window.localStorage?.setItem(projectScopedStorageKey(snapshot, "conversations.v1"), JSON.stringify(nextConversations));
    } catch {
      // localStorage may be unavailable in some embedded contexts.
    }

    if (activeConversationId !== id) return;
    const nextConversation = nextConversations[0];
    if (nextConversation) {
      setActiveConversationId(nextConversation.id);
      setChatTurns(Array.isArray(nextConversation.turns) ? nextConversation.turns : []);
      setActiveTaskId("");
      setReadonlyPlan(null);
      setSelectedEngineeringFile(null);
      return;
    }
    startNewConversation();
  };

  const startNewConversation = () => {
    setActiveConversationId(`conv-${Date.now()}`);
    setChatTurns([]);
    setActiveTaskId("");
    setReadonlyPlan(null);
    setSelectedEngineeringFile(null);
    setPlanError("");
    setRunnerError("");
    setPatchError("");
    setApplyError("");
    setConversationResetKey((key) => key + 1);
  };

  const markTaskWaiting = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setAndPersistTask({ ...task, status: taskStatuses.running });
  };

  const runGuardedCheck = async (taskId, checkId) => {
    const feedbackKey = `check-${taskId}-${checkId}`;
    const checkLabel = guardedChecks.find((check) => check.id === checkId)?.label || checkId;
    beginActionFeedback(feedbackKey, `正在运行检查：${checkLabel}`);
    setRunnerError("");
    setRunnerLoadingId(checkId);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status: taskStatuses.running } : task
      )
    );

    try {
      const result = await invokeWorkspaceCommand("run_guarded_check", {
        input: { checkId },
      });
      const finishedRun = {
        ...result,
        finishedAt: new Date().toISOString(),
      };
      appendTerminalLog(result);
      const task = tasks.find((item) => item.id === taskId);
      if (task) {
        await setAndPersistTask({
          ...task,
          status: result.success ? taskStatuses.done : taskStatuses.failed,
          runs: [finishedRun, ...(task.runs || [])],
        });
      }
      finishActionFeedback(
        feedbackKey,
        result.success ? "success" : "failed",
        result.success ? `${checkLabel} 通过。` : `${checkLabel} 失败。`
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendTerminalLog({
        id: checkId,
        command: guardedChecks.find((check) => check.id === checkId)?.command || checkId,
        output: message,
        success: false,
      });
      setRunnerError(message);
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, status: taskStatuses.failed } : task
        )
      );
      finishActionFeedback(feedbackKey, "failed", `${checkLabel} 失败：${message}`);
      return false;
    } finally {
      setRunnerLoadingId("");
    }
  };

  const appendTerminalLog = (result) => {
    const now = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setTerminalLogs((current) => [
      {
        command: result.command || result.id || "unknown command",
        id: `${Date.now()}-${result.id || "terminal"}`,
        output: result.output || (result.success ? "Command completed." : "Command failed."),
        status: result.success ? "success" : "failed",
        timestamp: now,
      },
      ...current,
    ].slice(0, 8));
    setTerminalText((current) => `${current}\n$ ${result.command || result.id || "command"}\n${cleanTerminalText(result.output || "")}\n`.slice(-50000));
  };

  const writeTerminalData = async (data) => {
    if (!data) return false;
    try {
      await invokeWorkspaceCommand("write_terminal_session", {
        input: { sessionId: "main", data },
      });
      setTerminalError("");
      return true;
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const resizeTerminalSession = async (cols, rows) => {
    if (!isTauriRuntime() || !cols || !rows) return false;
    try {
      await invokeWorkspaceCommand("resize_terminal_session", {
        input: { sessionId: "main", cols, rows },
      });
      return true;
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const restartTerminalSession = async () => {
    if (!isTauriRuntime()) return false;
    setTerminalError("");
    try {
      await invokeWorkspaceCommand("stop_terminal_session", {
        input: { sessionId: "main" },
      });
      setTerminalText("");
      setTerminalChunks([]);
      setTerminalSession(null);
      const session = await invokeWorkspaceCommand("start_terminal_session", {
        input: { sessionId: "main", cols: 120, rows: 32 },
      });
      setTerminalSession(session);
      setTerminalText(`Connected to ${session.shell} at ${session.cwd}\n`);
      return true;
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const runTerminalCheck = async (checkId) => {
    setRunnerError("");
    setTerminalRunningId(checkId);
    try {
      const result = await invokeWorkspaceCommand("run_guarded_check", {
        input: { checkId },
      });
      appendTerminalLog(result);
      return true;
    } catch (err) {
      appendTerminalLog({
        id: checkId,
        command: guardedChecks.find((check) => check.id === checkId)?.command || checkId,
        output: err instanceof Error ? err.message : String(err),
        success: false,
      });
      return false;
    } finally {
      setTerminalRunningId("");
    }
  };

  const runTerminalCommand = async (command) => {
    setRunnerError("");
    setTerminalRunningId("terminal");
    try {
      const result = await invokeWorkspaceCommand("run_terminal_command", {
        input: { command },
      });
      appendTerminalLog(result);
      return true;
    } catch (err) {
      appendTerminalLog({
        id: "terminal",
        command,
        output: err instanceof Error ? err.message : String(err),
        success: false,
      });
      return false;
    } finally {
      setTerminalRunningId("");
    }
  };

  const generatePatchDraft = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;

    const feedbackKey = `patch-${taskId}`;
    beginActionFeedback(feedbackKey, "正在生成改动草稿...");
    setPatchError("");
    setPatchLoading(true);
    try {
      const patchDraft = await invokeWorkspaceCommand("generate_patch_draft", {
        input: { task },
      });
      await setAndPersistTask({
        ...task,
        status: taskStatuses.waitingApproval,
        patchDraft,
      });
      finishActionFeedback(feedbackKey, "success", "改动草稿已生成。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPatchError(message);
      finishActionFeedback(feedbackKey, "failed", `生成改动失败：${message}`);
      return false;
    } finally {
      setPatchLoading(false);
    }
  };

  const applyPatchDraft = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;

    const feedbackKey = `apply-${taskId}`;
    beginActionFeedback(feedbackKey, "正在应用改动并验证...");
    setApplyError("");
    setRunnerError("");
    setApplyLoading(true);
    try {
      const applyResult = await invokeWorkspaceCommand("apply_patch_draft", {
        input: { task },
      });
      const appliedTask = {
        ...task,
        status: taskStatuses.running,
        applyResult: {
          ...applyResult,
          finishedAt: new Date().toISOString(),
        },
      };
      await setAndPersistTask(appliedTask);

      const checks = checksForPlan(task.plan);
      if (!checks.length) {
        const doneTask = { ...appliedTask, status: taskStatuses.done };
        const runSummary = await invokeWorkspaceCommand("write_run_summary", {
          input: { task: doneTask },
        });
        await setAndPersistTask({ ...doneTask, runSummary });
        finishActionFeedback(feedbackKey, "success", "改动已应用，已写入运行摘要。");
        return true;
      }

      const verificationRuns = [];
      for (const check of checks) {
        setRunnerLoadingId(check.id);
        const result = await invokeWorkspaceCommand("run_guarded_check", {
          input: { checkId: check.id },
        });
        verificationRuns.push({
          ...result,
          finishedAt: new Date().toISOString(),
          auto: true,
        });
      }

      const allPassed = verificationRuns.every((run) => run.success);
      const verifiedTask = {
        ...appliedTask,
        status: allPassed ? taskStatuses.done : taskStatuses.failed,
        runs: [...verificationRuns, ...(task.runs || [])],
        verificationSummary: allPassed ? "自动验证通过" : "自动验证有失败项",
      };
      const runSummary = await invokeWorkspaceCommand("write_run_summary", {
        input: { task: verifiedTask },
      });
      await setAndPersistTask({ ...verifiedTask, runSummary });
      finishActionFeedback(
        feedbackKey,
        allPassed ? "success" : "failed",
        allPassed ? "改动已应用，自动验证通过。" : "改动已应用，但自动验证有失败项。"
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApplyError(message);
      setRunnerError(message);
      const failedTask = tasks.find((item) => item.id === taskId) || task;
      await setAndPersistTask({ ...failedTask, status: taskStatuses.failed });
      finishActionFeedback(feedbackKey, "failed", `应用改动失败：${message}`);
      return false;
    } finally {
      setApplyLoading(false);
      setRunnerLoadingId("");
    }
  };

  const mergeHandoff = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;

    const feedbackKey = `handoff-${taskId}`;
    beginActionFeedback(feedbackKey, "正在更新交接...");
    setHandoffError("");
    setHandoffLoading(true);
    try {
      const handoffMerge = await invokeWorkspaceCommand("merge_run_summary_to_handoff", {
        input: { task },
      });
      await setAndPersistTask({
        ...task,
        handoffMerge,
      });
      finishActionFeedback(feedbackKey, "success", "交接已更新。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHandoffError(message);
      finishActionFeedback(feedbackKey, "failed", `更新交接失败：${message}`);
      return false;
    } finally {
      setHandoffLoading(false);
    }
  };

  const saveProvider = async (form) => {
    const feedbackKey = "save-provider";
    beginActionFeedback(feedbackKey, "正在保存连接...");
    setProviderError("");
    try {
      const status = await invokeWorkspaceCommand("save_provider_config", { input: form });
      setProvider({ ...fallbackProvider, ...status });
      finishActionFeedback(feedbackKey, "success", "连接配置已保存。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProviderError(message);
      finishActionFeedback(feedbackKey, "failed", `保存连接失败：${message}`);
      return false;
    }
  };

  const loadComposerModels = async () => {
    const key = providerModelKey(provider);
    if (composerModelsKey === key && composerModels.length) return;

    const fallbackModels = catalogModelsForProvider(provider, modelCatalog);
    setComposerModelsLoading(true);
    setComposerModelsSource(fallbackModels.length > 1 ? "来自本地模型列表" : "当前模型");
    setComposerModels(fallbackModels);

    if (source !== "tauri" || !provider?.apiBase || !provider?.apiKeyEnv) {
      setComposerModelsKey(key);
      setComposerModelsLoading(false);
      return;
    }

    try {
      const result = await invokeWorkspaceCommand("probe_provider_models", {
        input: {
          apiBase: provider.apiBase,
          apiKeyEnv: provider.apiKeyEnv,
          apiKey: "",
        },
      });
      const models = Array.isArray(result.models) ? result.models.filter(Boolean) : [];
      setComposerModels(models.length ? models : fallbackModels);
      setComposerModelsSource(models.length ? "来自当前 API 可见模型" : "来自本地模型列表");
      setComposerModelsKey(key);
    } catch {
      setComposerModels(fallbackModels);
      setComposerModelsSource(fallbackModels.length > 1 ? "来自本地模型列表" : "当前模型");
      setComposerModelsKey(key);
    } finally {
      setComposerModelsLoading(false);
    }
  };

  const selectComposerModel = async (model) => {
    if (!model || model === provider.model) return;
    if (source !== "tauri") {
      setProvider((current) => ({ ...current, model }));
      return;
    }
    await saveProvider({ ...provider, model });
  };

  const testComposerModel = async (model) => {
    const targetModel = model || provider?.model;
    if (source !== "tauri" || !targetModel || !provider?.apiBase || !provider?.apiKeyEnv) return false;
    const key = modelAvailabilityKey(provider, targetModel);
    setComposerModelTesting(true);
    try {
      const result = await invokeWorkspaceCommand("test_provider_model_with_cache", {
        input: {
          apiBase: provider.apiBase,
          apiKeyEnv: provider.apiKeyEnv,
          model: targetModel,
          apiKey: "",
        },
      });
      setComposerModelTests((current) => ({
        ...current,
        [key]: {
          checkedAt: Date.now(),
          message: result.message || `${targetModel} 可用`,
          status: "available",
        },
      }));
      return true;
    } catch (err) {
      setComposerModelTests((current) => ({
        ...current,
        [key]: {
          checkedAt: Date.now(),
          message: err instanceof Error ? err.message : String(err),
          status: "unavailable",
        },
      }));
      return false;
    } finally {
      setComposerModelTesting(false);
    }
  };

  const saveProviderSecret = async (apiKeyEnv, apiKey) => {
    const feedbackKey = "save-provider-secret";
    beginActionFeedback(feedbackKey, "正在保存 API Key...");
    setProviderError("");
    try {
      const status = await invokeWorkspaceCommand("save_provider_secret", {
        input: { apiKeyEnv, apiKey },
      });
      setProvider({ ...fallbackProvider, ...status });
      finishActionFeedback(feedbackKey, "success", "API Key 已保存。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProviderError(message);
      finishActionFeedback(feedbackKey, "failed", `保存 API Key 失败：${message}`);
      return false;
    }
  };

  const deleteProviderProfile = async (profileId) => {
    const feedbackKey = "delete-provider";
    beginActionFeedback(feedbackKey, "正在删除连接...");
    setProviderError("");
    try {
      const status = source !== "tauri"
        ? await deleteProviderProfilePreview(profileId)
        : await invokeWorkspaceCommand("delete_provider_profile", {
            input: { profileId },
          });
      setProvider({ ...fallbackProvider, ...status });
      finishActionFeedback(feedbackKey, "success", "连接已删除。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const displayMessage =
        message.includes("delete_provider_profile") && message.includes("not found")
          ? "当前桌面进程还没加载删除连接命令，请重启桌面 dev 进程后再删。"
          : message;
      setProviderError(displayMessage);
      finishActionFeedback(feedbackKey, "failed", `删除连接失败：${displayMessage}`);
      return false;
    }
  };

  const composerModelOptions = composerModels.length
    ? composerModels
    : catalogModelsForProvider(provider, modelCatalog);
  const composerModelAvailability = Object.fromEntries(
    composerModelOptions.map((model) => [model, composerModelTests[modelAvailabilityKey(provider, model)]])
  );

  return (
    <TooltipProvider>
    <div className="shell">
      <TopBar
        snapshot={snapshot}
        source={source}
        error={error}
        provider={provider}
        modelCatalog={modelCatalog}
        onSaveProvider={saveProvider}
        onSaveProviderSecret={saveProviderSecret}
        onDeleteProviderProfile={deleteProviderProfile}
        providerError={providerError}
        onStartConversation={startNewConversation}
      />
      <main
        className={`workspace${leftCollapsed ? " leftCollapsed" : ""}${rightCollapsed ? " rightCollapsed" : ""}`}
        style={{
          "--desktop-layout-sidebar-left": `${leftWidth}px`,
          "--desktop-layout-sidebar-right": `${rightWidth}px`,
        }}
      >
        <ProjectSidebar
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
          onProjectActionError={setProjectActionError}
          onProjectActivitySeen={markProjectActivitySeen}
          onProjectPathCopied={() => showToast("已复制项目路径。")}
          projectActionError={projectActionError}
          selectedEngineeringFile={selectedEngineeringFile}
        />
        <AgentWorkspace
          snapshot={snapshot}
          selectedEngineeringFile={selectedEngineeringFile}
          chatTurns={chatTurns}
          terminalLogs={terminalLogs}
          terminalRunningId={terminalRunningId}
          terminalText={terminalText}
          terminalChunks={terminalChunks}
          terminalSession={terminalSession}
          terminalError={terminalError}
          loading={loading}
          error={error}
          readonlyPlan={readonlyPlan}
          activeTask={activeTask}
          tasks={tasks}
          planLoading={planLoading}
          planError={planError}
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
          onConfirmTask={markTaskWaiting}
          onGeneratePatchDraft={generatePatchDraft}
          onApplyPatchDraft={applyPatchDraft}
          onMergeHandoff={mergeHandoff}
          onRunChatAction={runChatAction}
          onRunGuardedCheck={runGuardedCheck}
          onRunTerminalCheck={runTerminalCheck}
          onRunTerminalCommand={runTerminalCommand}
          onWriteTerminalData={writeTerminalData}
          onResizeTerminalSession={resizeTerminalSession}
          onRestartTerminalSession={restartTerminalSession}
          onProfileUpdated={applySnapshot}
          onStopPlan={stopPlanGeneration}
          provider={provider}
          composerModelAvailability={composerModelAvailability}
          composerModelOptions={composerModelOptions}
          composerModelsLoading={composerModelsLoading}
          composerModelsSource={composerModelsSource}
          composerModelTesting={composerModelTesting}
          onLoadComposerModels={loadComposerModels}
          onSelectComposerModel={selectComposerModel}
          onTestComposerModel={testComposerModel}
          goalRefinementMode={goalRefinementMode}
          onSelectEngineeringFile={selectEngineeringFile}
          onSelectConversation={selectConversation}
          onSelectTask={selectTask}
          onCreateRepairTask={createRepairTask}
          onCreateGovernanceTask={createGovernanceTask}
          onCreateDesignGovernanceTask={createDesignGovernanceTask}
        />
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
          onDeleteConversation={deleteConversation}
          onSelectTask={selectTask}
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
      </main>
      {actionFeedback ? <ActionFeedbackToast feedback={actionFeedback} /> : null}
      {!actionFeedback && toast ? <div className={`appToast appToast-${toast.variant}`}>{toast.message}</div> : null}
      <StatusBar snapshot={snapshot} source={source} />
    </div>
    </TooltipProvider>
  );
}

function ActionFeedbackToast({ feedback }) {
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

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

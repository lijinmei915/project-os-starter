import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Brain, Check, ChevronRight, ClipboardList, Copy, Eraser, Loader2, MoreHorizontal, Package, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, RotateCcw, Square, TerminalSquare, X } from "lucide-react";
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
import { SectionTitle } from "./components/ui/section-title";
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
      title: "打磨右侧工作流",
      status: "进行中",
      body: "目标、任务、对话、背景分清楚。",
      tone: "accent",
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
  trace: [
    "BOOT: browser preview fallback.",
    "INDEX: waiting for Tauri Local Agent Core.",
    "GUARD: write actions require diff review.",
  ],
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
    return fallbackSnapshot;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_workspace_snapshot");
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

async function loadDesktopTasks() {
  if (!isTauriRuntime()) {
    return [];
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
    return task;
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
  providerError,
  onStartConversation,
}) {
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
            <Button className="modelStatusButton" variant="subtle" type="button" aria-label="模型设置">
              <span className="dot mutedDot" />
              {provider.profileName || provider.model || "模型设置"}
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

function ProjectSidebar({ collapsed, onResizeStart, onToggleCollapsed, snapshot, onSwitchProject, onPickProject, onOpenProjectFolder, onRenameProject, onRemoveProject, onSelectEngineeringFile, projectActionError, selectedEngineeringFile }) {
  const [renameProject, setRenameProject] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(true);

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
    try {
      await navigator.clipboard.writeText(projectPath);
      setProjectActionError("");
    } catch (err) {
      setProjectActionError(`复制路径失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const projectStatusTone = (project) => {
    if (project.health === "ready") return "success";
    if (project.health === "missing") return "danger";
    if (project.health === "partial") return "running";
    return "";
  };

  if (collapsed) {
    return (
      <aside className="left left-collapsed" aria-label="左侧工作区已折叠">
        <div className="collapsedRail">
          <button className="collapsedRailItem active" type="button" onClick={onToggleCollapsed} aria-label="项目">
            <Package strokeWidth={2.15} aria-hidden="true" />
          </button>
          <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label="项目流程">
            <ClipboardList strokeWidth={2.15} aria-hidden="true" />
          </button>
          <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label="记忆">
            <Brain strokeWidth={2.15} aria-hidden="true" />
          </button>
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
        <div className="leftRailSection">
          <SectionTitle
            title="项目"
            meta={snapshot.projects.length}
            open={projectsOpen}
            onToggle={() => setProjectsOpen((value) => !value)}
            toggleLabel={projectsOpen ? "收起项目" : "展开项目"}
          />
          {projectsOpen ? (
            <div className="projectList" aria-label="已接入项目">
              {snapshot.projects.map((project) => (
                <div className="projectTileWrap" key={project.id}>
                  <button
                    className={`projectTile${project.isCurrent ? " active" : ""}`}
                    type="button"
                    onClick={() => onSwitchProject(project.id)}
                    aria-label={`切换到项目 ${project.name}`}
                  >
                    {projectStatusTone(project) ? <span className={`projectStatusDot projectStatusDot-${projectStatusTone(project)}`} /> : null}
                    <span className="projectMark">{project.name.slice(0, 2).toUpperCase()}</span>
                  </button>
                  <div className="projectHoverCard" role="group" aria-label={`${project.name} 项目信息`}>
                    <div className="projectHoverMain">
                      <strong title={project.name}>{project.name}</strong>
                      <span title={project.path}>{project.path}</span>
                    </div>
                    <button className="projectCopyPath" type="button" onClick={() => copyProjectPath(project.path)} aria-label={`复制 ${project.name} 路径`} title="复制路径">
                      <Copy strokeWidth={2.15} aria-hidden="true" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="projectMenuButton" size="icon" variant="ghost" type="button" aria-label={`项目菜单：${project.name}`}>
                          <MoreHorizontal strokeWidth={2.25} aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => onOpenProjectFolder(project.id)}>查看本地文件</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openRenameDialog(project)}>修改名称</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="dangerMenuItem" onSelect={() => onRemoveProject(project.id)}>
                          从工作台移除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              <Tooltip content="新建或添加项目">
                <button className="projectTile projectTile-add" type="button" onClick={onPickProject} aria-label="新建或添加项目">
                  <Plus strokeWidth={2.25} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          ) : null}
          {projectActionError ? <div className="projectError">{projectActionError}</div> : null}
        </div>
        <Dialog open={Boolean(renameProject)} onOpenChange={(open) => {
          if (!open) {
            setRenameProject(null);
            setRenameName("");
          }
        }}>
          <DialogContent
            title="修改项目名称"
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

        <WorkspaceTree
          activeTopicPath={selectedEngineeringFile?.path}
          onSelectTopic={onSelectEngineeringFile}
          outline={projectGovernanceOutline}
        />
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

function createTaskFromPlan(plan, taskText, projectName) {
  const title = taskText?.trim() || plan?.summary || "未命名任务";

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: title.length > 48 ? `${title.slice(0, 48)}...` : title,
    status: taskStatuses.planned,
    createdAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    projectName,
    plan,
    runs: [],
  };
}

function taskStatusLabel(status) {
  return {
    [taskStatuses.planned]: "待确认",
    [taskStatuses.waitingApproval]: "待批准",
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

function previewChatResult(message, hasAttachments) {
  const normalized = message.trim().replace(/[。！？!?,，\s]/g, "").toLowerCase();
  const lowerMessage = message.toLowerCase();
  const explicitTask = [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
  ].some((keyword) => lowerMessage.includes(keyword));
  const greeting = ["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(normalized);
  const questionLike = [
    "为什么", "怎么", "哪些", "还有哪些", "是什么", "吗", "呢", "看一下", "看看",
    "检查当前项目还有哪些风险", "有哪些风险",
  ].some((keyword) => message.includes(keyword));
  const shouldCreatePlan = explicitTask || (hasAttachments && !questionLike);
  const riskLike = message.includes("风险") || lowerMessage.includes("risk");
  return {
    intent: shouldCreatePlan ? "task" : questionLike ? "question" : "chat",
    reply: shouldCreatePlan
      ? "可以。我先整理下一步，等你确认后再动手。"
      : greeting
        ? "你好，我在。你可以直接问项目情况，也可以说想改哪里。"
        : riskLike
          ? "主要风险有三类：交接记录可能继续膨胀；对话和执行状态容易混在一起；模型或检查失败时反馈还不够像人话。我建议先把普通问答和执行任务彻底分开，再打磨失败提示。"
          : "我先直接回答。需要我动手时，说“生成计划”或“帮我改”。",
    shouldCreatePlan,
  };
}

function isExecutionWorkspaceTab(tab, actionMode) {
  if (tab.id === "plan" || tab.kind === "terminal" || tab.kind === "file") return true;
  return actionMode;
}

function actionPromptsForMessage(message, intent) {
  const text = safeDisplayText(message).trim();
  if (!text || intent === "task") return [];
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
  return text.length > 6 ? `${text.slice(0, 5)}...` : text;
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
  if (todos.every((todo) => todo.status === taskStatuses.done)) return "已完成";
  if (todos.some((todo) => todo.status === taskStatuses.failed)) return "需处理";
  if (todos.some((todo) => todo.status === taskStatuses.running)) return "进行中";
  if (todos.some((todo) => todo.status === taskStatuses.waitingApproval)) return "待确认";
  return phaseLabel(fallbackPhase);
}

function progressFromTodos(todos) {
  if (!todos.length) return 0;
  const score = todos.reduce((total, todo) => {
    if (todo.status === taskStatuses.done) return total + 1;
    if (todo.status === taskStatuses.running || todo.status === taskStatuses.waitingApproval) return total + 0.5;
    return total;
  }, 0);
  return Math.round((score / todos.length) * 100);
}

function snapshotQueueTodos(snapshot) {
  return (snapshot.queue || [])
    .filter((item) => !isNoiseTask(item))
    .map((item, index) => ({
      description: item.body || item.projectName || "",
      id: item.id || `snapshot-queue-${index}`,
      status: item.status || taskStatuses.planned,
      title: item.title || "未命名任务",
    }));
}

function projectProfileItems(snapshot) {
  const profile = snapshot.projectProfile || {};
  const missingFields = new Set(profile.missingFields || []);
  return [
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
  ].map((item) => ({
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
  return `file:${file?.path || file?.preview?.path || file?.topic?.title || "preview"}`;
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
      setActiveWorkspaceTab("plan");
    }
  }, [selectedEngineeringFile]);

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

  useEffect(() => {
    if (actionMode) {
      ensureExecutionTabs();
    }
  }, [actionMode]);

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
        chatResult = previewChatResult(nextInput, submittedAttachments.length > 0);
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

    if (!chatResult?.shouldCreatePlan) {
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
      requestId,
      task: nextInput || "请根据截图帮我分析并修改。",
    }).then((ok) => {
      if (activeRequestRef.current !== requestId) return;
      if (ok) {
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
        {workspaceTabs.filter((tab) => isExecutionWorkspaceTab(tab, actionMode)).map((tab) => (
          <TabsTrigger className={`tab workspaceTab ${tab.kind === "file" ? "fileTab" : ""}`} key={tab.id} value={tab.id}>
            <span>{tab.title}</span>
            {tab.closable ? (
              <button
                aria-label={`关闭 ${tab.title}`}
                className="workspaceTabClose"
                type="button"
                onClick={(event) => closeWorkspaceTab(event, tab.id)}
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </TabsTrigger>
        ))}
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
                <span>正在思考</span>
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
              <EngineeringFileTab selectedEngineeringFile={tab.file} />
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
          modelLabel={compactModelLabel(provider?.model)}
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
  modelLabel,
  planLoading,
  taskInput,
}) {
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
        modelLabel={modelLabel}
        placeholder="问项目情况、描述想法，或说要改什么..."
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

function EngineeringFileTab({ selectedEngineeringFile }) {
  if (selectedEngineeringFile.topic) {
    return (
      <Panel className="engineeringFilePreview filePreviewPanel" variant="soft">
        <div className="engineeringFileHeader">
          <div>
            <strong>{selectedEngineeringFile.topic.title}</strong>
            <p>{selectedEngineeringFile.topic.description}</p>
          </div>
          <Badge>{selectedEngineeringFile.group}</Badge>
        </div>
        <div className="topicPreview">
          <Notice variant="info">这是项目治理地图。用户只看事项，OmniDesk 在背后维护对应文件、状态来源和更新时机。</Notice>
          {(selectedEngineeringFile.topic.statusSource || selectedEngineeringFile.topic.updatesWhen) ? (
            <div className="topicGovernanceMeta">
              {selectedEngineeringFile.topic.statusSource ? (
                <div>
                  <span>状态来源</span>
                  <code>{selectedEngineeringFile.topic.statusSource}</code>
                </div>
              ) : null}
              {selectedEngineeringFile.topic.updatesWhen ? (
                <div>
                  <span>更新时机</span>
                  <p>{selectedEngineeringFile.topic.updatesWhen}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="topicFileList">
            <strong>关联工程文件</strong>
            <div>
              {selectedEngineeringFile.topic.relatedFiles.map((file) => (
                <code key={file}>{file}</code>
              ))}
            </div>
          </div>
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
}) {
  const runnableChecks = checksForPlan(task.plan);

  return (
    <Panel as="article" className="activeTask" variant="soft">
      <div className="activeTaskHeader">
        <div>
          <strong>{task.title}</strong>
          <span>{task.projectName} · {task.createdAt}</span>
        </div>
        <Badge status={task.status}>{taskStatusLabel(task.status)}</Badge>
      </div>
      <ReadonlyPlan plan={task.plan} />
      <details className="executionTools">
        <summary>更多操作</summary>
        <Panel className="diffPanel" variant="info">
          <div className="runnerHeader">
            <strong>改动草稿</strong>
            <span>先预览，不直接写入</span>
          </div>
          <TaskCommandBar
            actions={[
              {
                disabled: patchLoading,
                key: "generate-patch",
                label: patchLoading ? "生成中" : task.patchDraft ? "重新生成" : "生成改动",
                onClick: () => onGeneratePatchDraft(task.id),
              },
              {
                disabled: applyLoading || !task.patchDraft,
                key: "apply-patch",
                label: applyLoading ? "应用中" : "应用改动",
                onClick: () => onApplyPatchDraft(task.id),
                variant: "primary",
              },
              {
                disabled: handoffLoading || !task.runSummary || Boolean(task.handoffMerge),
                key: "merge-handoff",
                label: handoffLoading ? "合并中" : task.handoffMerge ? "已更新交接" : "更新交接",
                onClick: () => onMergeHandoff(task.id),
              },
            ]}
            meta={task.patchDraft?.files?.length ? `${task.patchDraft.files.length} 个文件` : "还没有生成改动。"}
          />
          {patchError ? <Notice className="planError" variant="danger">{patchError}</Notice> : null}
          {applyError ? <Notice className="planError" variant="danger">{applyError}</Notice> : null}
          {handoffError ? <Notice className="planError" variant="danger">{handoffError}</Notice> : null}
          {task.applyResult ? <Notice className="providerSuccess" variant="success">{task.applyResult.message}</Notice> : null}
          {task.verificationSummary ? (
            <Notice className={task.status === taskStatuses.failed ? "providerError" : "providerSuccess"} variant={task.status === taskStatuses.failed ? "danger" : "success"}>
              {task.verificationSummary}
            </Notice>
          ) : null}
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
}) {
  const visibleTasks = tasks.filter((task) => !isNoiseTask(task));
  const conversationGroups = groupedConversations(conversations);
  const activeTask = visibleTasks.find((task) => task.id === activeTaskId);
  const snapshotTodos = snapshotQueueTodos(snapshot);
  const todoMeta = visibleTasks.length || snapshotTodos.length;
  const goalTodos = visibleTasks.length
    ? visibleTasks.map((task) => ({
        description: task.plan?.summary || task.projectName || "",
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
  const goalTitle = activeTask?.title || snapshot.stage || snapshot.projectName || "当前项目";
  const goalDescription = activeTask?.plan?.summary || snapshot.projectName || "暂无目标描述。";
  const goalMeta = goalStatusLabel(goalTodos, snapshot.phase);
  const doneCount = goalTodos.filter((todo) => todo.status === taskStatuses.done).length;
  const runningCount = goalTodos.filter((todo) => todo.status === taskStatuses.running || todo.status === taskStatuses.waitingApproval).length;
  const pendingCount = Math.max(goalTodos.length - doneCount - runningCount, 0);
  const goalSteps = goalTodos.length
    ? [`完成 ${doneCount}`, `进行 ${runningCount}`, `待办 ${pendingCount}`]
    : ["暂无任务", "等待拆解", "待确认"];
  const profileItems = projectProfileItems(snapshot);
  const recordedProfileCount = profileItems.filter((item) => !item.missing).length;

  if (collapsed) {
    return (
      <aside className="right right-collapsed" aria-label="右侧状态栏已折叠">
        <div className="collapsedRail collapsedRail-right">
          <button className="collapsedRailItem active" type="button" onClick={onToggleCollapsed} aria-label={`目标 ${progressValue}%`}>
            <span className="collapsedProgress">{progressValue}</span>
          </button>
          <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label={`任务 ${todoMeta}`}>
            <ClipboardList strokeWidth={2.15} aria-hidden="true" />
          </button>
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
        <RailDisclosure title="目标" meta={goalMeta}>
          <div className="goalStack">
            <div className="goalProgress">
              <div className="goalProgressHeader">
                <strong>{goalTitle}</strong>
                <span>{goalDescription}</span>
              </div>
              <div className="goalProgressBar" aria-hidden="true">
                <span style={{ width: `${progressValue}%` }} />
              </div>
              <div className="goalSteps">
                {goalSteps.map((step) => (
                  <span key={step}>{step}</span>
                ))}
              </div>
            </div>
            <div className="goalTaskHeader">
              <span>任务</span>
              <span>{goalTodos.length}</span>
            </div>
            {goalTodos.length ? (
              <ol className="goalTodoList">
                {goalTodos.map((todo, index) => (
                  <GoalTaskItem
                    active={todo.id === activeTaskId}
                    description={todo.description}
                    index={index}
                    key={todo.id}
                    status={todo.status}
                    subtasks={todo.subtasks}
                    title={todo.title}
                    onSelect={visibleTasks.length ? () => onSelectTask(todo.id) : undefined}
                  />
                ))}
              </ol>
            ) : (
              <div className="goalEmpty">还没有任务拆解。说出想做的事后，这里会变成 todo。</div>
            )}
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
  return (
    <details className={`railSection railDisclosure ${className}`} open={defaultOpen}>
      <summary className="railDisclosureSummary">
        <span className="railDisclosureTitle">
          <ChevronRight className="railDisclosureIcon" strokeWidth={2.25} aria-hidden="true" />
          <span>{title}</span>
        </span>
        <span className="railDisclosureMeta">{meta}</span>
      </summary>
      <div className="railDisclosureBody">{children}</div>
    </details>
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

function GoalStatusIcon({ status }) {
  const done = status === taskStatuses.done;
  const running = status === taskStatuses.running || status === taskStatuses.waitingApproval;
  const failed = status === taskStatuses.failed;
  const label = failed ? "失败" : running ? "进行中" : done ? "已完成" : "待开始";
  return (
    <span className="goalTodoStatus" aria-label={label}>
      {done ? <Check strokeWidth={2.25} aria-hidden="true" /> : running ? <Loader2 strokeWidth={2} aria-hidden="true" /> : null}
    </span>
  );
}

function GoalTaskItem({ active, description, index, onSelect, status, subtasks = [], title }) {
  const done = status === taskStatuses.done;
  const running = status === taskStatuses.running || status === taskStatuses.waitingApproval;
  const failed = status === taskStatuses.failed;
  const content = (
    <>
      <span className="goalTodoIndex">{index + 1}</span>
      <span className="goalTodoText">
        <span className="goalTodoTitle">{title}</span>
        {description && !subtasks.length ? <span className="goalTodoDescription">{description}</span> : null}
      </span>
      <GoalStatusIcon status={status} />
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
      {subtasks.length ? (
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
          确认计划
        </Button>
      </div>
    </Panel>
  );
}

function ProviderPanel({ provider, modelCatalog, source, onSaveProvider, onSaveProviderSecret, providerError }) {
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
    catalogProviders.find((preset) => preset.id === selectedProviderId) ||
    catalogProviders.find((preset) => preset.id === form.profileId) ||
    catalogProviders.find((preset) => preset.apiBase === form.apiBase && preset.apiKeyEnv === form.apiKeyEnv) ||
    catalogProviders.find((preset) => preset.id === "gateway") ||
    catalogProviders[0];
  const modelOptions = detectedModels.length ? detectedModels : (activePreset?.models || [form.model]);
  const isPreview = source !== "tauri";
  const savedProfile = profiles.find((profile) => profile.id === form.profileId);
  const isCreatingProfile = Boolean(form.profileId) && !savedProfile;
  const currentHasApiKey = isCreatingProfile ? Boolean(apiKey.trim()) : Boolean(savedProfile?.hasApiKey ?? provider.hasApiKey);

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
      provider.profileId ||
      provider.activeProfileId ||
      catalogProviders.find((preset) => preset.apiBase === provider.apiBase && preset.apiKeyEnv === provider.apiKeyEnv)?.id ||
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
      model: preset.models[0],
      apiBase: preset.apiBase,
      apiKeyEnv: preset.apiKeyEnv,
      enabled: true,
      profileId: preset.id,
      profileName: preset.label,
      profileNote: preset.note || "",
      profileWebsite: preset.website || "",
    }));
  };

  const selectProfile = (event) => {
    const profile = profiles.find((item) => item.id === event.target.value);
    if (!profile) return;
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
      return false;
    }
    setProbeError("");
    setProbeLoading(true);
    try {
      const result = await invokeWorkspaceCommand("probe_provider_models", {
        input: {
          apiBase: form.apiBase,
          apiKeyEnv: form.apiKeyEnv,
          apiKey,
        },
      });
      setDetectedModels(Array.isArray(result.models) ? result.models : []);
      if (Array.isArray(result.models) && result.models.length && !result.models.includes(form.model)) {
        setCustomModel(false);
        updateField("model", result.models[0]);
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
	        statusLabel={isCreatingProfile ? "正在新建" : undefined}
	        variant={isCreatingProfile ? "creating" : "default"}
	      />
      {isPreview ? (
        <InfoCallout>当前是浏览器预览，只能查看界面。保存 Key、刷新模型和写入配置需要在桌面 App 窗口中操作。</InfoCallout>
      ) : null}
      {profiles.length ? (
        <Field label="API 档案">
          {({ id }) => (
            <div className="providerProfileRow">
              <Select id={id} value={form.profileId || provider.activeProfileId || ""} onChange={selectProfile}>
                {isCreatingProfile ? (
                  <option value={form.profileId}>
                    {form.profileName || "新 API"} · 未保存
                  </option>
                ) : null}
                {profiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}{profile.hasApiKey ? " · Key 已保存" : ""}
                  </option>
                ))}
              </Select>
              <Button className="textAction" size="sm" variant="ghost" type="button" onClick={createProfile}>
                新建
              </Button>
            </div>
          )}
        </Field>
      ) : (
        <Button className="textAction providerCreateFirst" size="sm" variant="ghost" type="button" onClick={createProfile}>
          新建 API 档案
        </Button>
      )}
      <div className="providerSectionTitle">连接设置</div>
      <Field label={<RequiredLabel>接入预设</RequiredLabel>}>
        {({ id }) => <Select id={id} value={selectedProviderId || activePreset?.id || "gateway"} onChange={selectPreset}>
          {catalogProviders.map((preset) => (
            <option value={preset.id} key={preset.id}>{preset.label}</option>
          ))}
        </Select>}
      </Field>
      <Field label={<RequiredLabel>API Key</RequiredLabel>} hint={currentHasApiKey && !isCreatingProfile ? "已保存时可留空；填写新 Key 会覆盖当前档案。" : "新档案必须填写 API Key。"}>
        {({ id }) => <Input
          id={id}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={currentHasApiKey && !isCreatingProfile ? "已保存；留空则不修改" : "粘贴你的 API Key"}
        />}
      </Field>
      <Field label={<RequiredLabel>API 请求地址</RequiredLabel>}>
        {({ id }) => <Input id={id} value={form.apiBase} onChange={(event) => updateField("apiBase", event.target.value)} placeholder="https://api.example.com/v1" />}
      </Field>
      <div className="providerSectionTitle">
        <span>模型</span>
        <span className="modelActions">
          <Button className="textAction" size="sm" variant="ghost" type="button" onClick={probeModels} disabled={probeLoading || isPreview}>
            {probeLoading ? "检测中" : "刷新列表"}
          </Button>
          <Button className="textAction" size="sm" variant="ghost" type="button" onClick={testCurrentModel} disabled={modelTestLoading || isPreview || !form.model}>
            {modelTestLoading ? "测试中" : "测试当前"}
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
      {detectedModels.length ? (
        <Notice className="providerHint" variant="info">已从网关读取 {detectedModels.length} 个模型。下拉列表里的是这个 API Key 当前能看到的模型池。</Notice>
      ) : null}
      {modelTestMessage ? <Notice className="providerSuccess" variant="success">{modelTestMessage}</Notice> : null}
      <div className="providerSectionTitle">档案信息（可选）</div>
      <div className="providerSplit">
        <Field label="档案名称">
          {({ id }) => <Input
            id={id}
            value={form.profileName || (!isCreatingProfile ? activePreset?.label : "") || ""}
            onChange={(event) => updateField("profileName", event.target.value)}
            placeholder="例如：公司 API"
          />}
        </Field>
        <Field label="备注">
          {({ id }) => <Input
            id={id}
            value={form.profileNote || ""}
            onChange={(event) => updateField("profileNote", event.target.value)}
            placeholder="例如：公司专用账号"
          />}
        </Field>
      </div>
      <Field label="官网链接">
        {({ id }) => <Input
          id={id}
          value={form.profileWebsite || ""}
          onChange={(event) => updateField("profileWebsite", event.target.value)}
          placeholder="https://..."
        />}
      </Field>
      <details className="advancedProvider">
        <summary>高级设置</summary>
        <Field className="providerReadOnly" label="接入方式">
          {({ id }) => <Input id={id} value={form.provider} onChange={(event) => updateField("provider", event.target.value)} />}
        </Field>
        <Field label="Key 保存变量名">
          {({ id }) => <Input id={id} value={form.apiKeyEnv} onChange={(event) => updateField("apiKeyEnv", event.target.value)} />}
        </Field>
      </details>
      <div className="toggleRow">
        <Switch
          aria-label="启用当前 API 档案"
          checked={form.enabled}
          onCheckedChange={(checked) => updateField("enabled", checked)}
        />
        <span>
          启用当前档案
          <small>关闭后不调用模型，改用本地规则回答。</small>
        </span>
      </div>
      <Button variant="primary" type="submit" disabled={isPreview}>保存并启用</Button>
      {probeError ? <Notice className="providerError" variant="danger">{probeError}</Notice> : null}
      {providerError ? <Notice className="providerError" variant="danger">{providerError}</Notice> : null}
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
  rightDefault: 320,
  rightMin: 280,
  rightMax: 460,
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
  const [providerError, setProviderError] = useState("");
  const [conversationResetKey, setConversationResetKey] = useState(0);
  const [selectedEngineeringFile, setSelectedEngineeringFile] = useState(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(sidebarSizing.leftDefault);
  const [rightWidth, setRightWidth] = useState(sidebarSizing.rightDefault);
  const activePlanRequestRef = React.useRef(null);

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
        window.localStorage?.setItem("omnidesk.conversations.v1", JSON.stringify(next));
      } catch {
        // localStorage may be unavailable in some embedded contexts.
      }
      return next;
    });
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
    try {
      const records = JSON.parse(window.localStorage?.getItem("omnidesk.conversations.v1") || "[]");
      if (Array.isArray(records)) {
        setConversations(records.slice(0, 50));
      }
    } catch {
      setConversations([]);
    }
  }, []);

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

    Promise.all([loadProviderStatus(), loadModelCatalog()])
      .then(([status, catalog]) => {
        if (!cancelled) {
          setProvider({ ...fallbackProvider, ...status });
          setModelCatalog({ ...fallbackModelCatalog, ...catalog });
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
      const nextSnapshot = await invokeWorkspaceCommand("switch_registry_project", { id });
      applySnapshot(nextSnapshot);
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
      setActiveTaskId("");
      setReadonlyPlan(null);
      setSelectedEngineeringFile(null);
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
          title: file.title || file.path,
          description: file.description,
          relatedFiles: file.relatedFiles,
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

    if (!isTauriRuntime()) {
      setSelectedEngineeringFile({
        ...nextFile,
        error: "浏览器预览不能读取本地文件，请在桌面 App 窗口里查看。",
        loading: false,
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

  const generatePlan = async (request) => {
    const input = typeof request === "string" ? { task: request, attachments: [] } : request;
    const requestId = input.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    activePlanRequestRef.current = requestId;
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
      const nextTask = createTaskFromPlan(plan, input.task, snapshot.projectName);
      setReadonlyPlan(plan);
      await setAndPersistTask(nextTask);
      return true;
    } catch (err) {
      if (activePlanRequestRef.current !== requestId) return false;
      setPlanError(err instanceof Error ? err.message : String(err));
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
    if (action?.id !== "generate-plan" || !action.task) return false;
    const ok = await generatePlan({ task: action.task, attachments: [] });
    if (ok) {
      setSelectedEngineeringFile(null);
    }
    return ok;
  };

  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  const selectTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setActiveTaskId(id);
    setReadonlyPlan(task.plan);
    setSelectedEngineeringFile(null);
  };

  const selectConversation = (id) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
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
      window.localStorage?.setItem("omnidesk.conversations.v1", JSON.stringify(nextConversations));
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
    setAndPersistTask({ ...task, status: taskStatuses.waitingApproval });
  };

  const runGuardedCheck = async (taskId, checkId) => {
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
      return true;
    } catch (err) {
      appendTerminalLog({
        id: checkId,
        command: guardedChecks.find((check) => check.id === checkId)?.command || checkId,
        output: err instanceof Error ? err.message : String(err),
        success: false,
      });
      setRunnerError(err instanceof Error ? err.message : String(err));
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, status: taskStatuses.failed } : task
        )
      );
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
      return true;
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setPatchLoading(false);
    }
  };

  const applyPatchDraft = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;

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
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApplyError(message);
      setRunnerError(message);
      const failedTask = tasks.find((item) => item.id === taskId) || task;
      await setAndPersistTask({ ...failedTask, status: taskStatuses.failed });
      return false;
    } finally {
      setApplyLoading(false);
      setRunnerLoadingId("");
    }
  };

  const mergeHandoff = async (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;

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
      return true;
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setHandoffLoading(false);
    }
  };

  const saveProvider = async (form) => {
    setProviderError("");
    try {
      const status = await invokeWorkspaceCommand("save_provider_config", { input: form });
      setProvider({ ...fallbackProvider, ...status });
      return true;
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const saveProviderSecret = async (apiKeyEnv, apiKey) => {
    setProviderError("");
    try {
      const status = await invokeWorkspaceCommand("save_provider_secret", {
        input: { apiKeyEnv, apiKey },
      });
      setProvider({ ...fallbackProvider, ...status });
      return true;
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

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
          onSwitchProject={switchProject}
          onPickProject={pickProject}
          onOpenProjectFolder={openProjectFolder}
          onRenameProject={renameProject}
          onRemoveProject={removeProject}
          onSelectEngineeringFile={selectEngineeringFile}
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
        />
      </main>
      <StatusBar snapshot={snapshot} source={source} />
    </div>
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

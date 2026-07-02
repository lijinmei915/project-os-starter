import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, BookOpen, Brain, CheckCircle2, ClipboardList, FileStack, Package, Plus, Settings, ShieldCheck, TerminalSquare, Wrench } from "lucide-react";
import omnideskLogo from "./assets/omnidesk-logo.svg";
import { ChatComposer } from "./components/workbench/chat-composer";
import { Conversation, ConversationArtifact, ConversationMessage } from "./components/workbench/conversation";
import { InfoCallout } from "./components/workbench/info-callout";
import { ProviderStatusRow } from "./components/workbench/provider-status-row";
import { TaskCard } from "./components/workbench/task-card";
import { TaskCommandBar } from "./components/workbench/task-command-bar";
import { ThemeMenu } from "./components/workbench/theme-menu";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "./components/ui/dialog";
import { Field } from "./components/ui/field";
import { Input } from "./components/ui/input";
import { Notice } from "./components/ui/notice";
import { Panel } from "./components/ui/panel";
import { SectionTitle } from "./components/ui/section-title";
import { Select } from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Tooltip, TooltipProvider } from "./components/ui/tooltip";
import "./styles.css";

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
      title: "接入本地项目 registry",
      status: "建议下一步",
      body: "让桌面工作台记住已接入项目，并作为后续模型计划层的入口。",
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

const engineeringFlow = [
  {
    title: "认识项目",
    meta: "当前",
    icon: BookOpen,
    description: "项目身份、阶段和本地状态。",
    files: ["PROJECT.md", ".project-os/state.json", "README.md"],
  },
  {
    title: "定义目标",
    meta: "路线",
    icon: ClipboardList,
    description: "产品目标、桌面端方向和近期重点。",
    files: ["docs/PRODUCT_PLAN.md", "docs/DESKTOP_APP.md", "HANDOFF.md"],
  },
  {
    title: "约束协作",
    meta: "规则",
    icon: ShieldCheck,
    description: "AI 行为边界、路由和文档维护规则。",
    files: ["AGENTS.md", "docs/ROUTING.md", "docs/DOCUMENTATION.md", "docs/NAMING.md"],
  },
  {
    title: "设计实现",
    meta: "方案",
    icon: Wrench,
    description: "架构、代码结构和设计系统。",
    files: ["docs/ARCHITECTURE.md", "docs/CODE_STRUCTURE.md", "docs/DESIGN_STANDARDS.md", "docs/design/tokens.md"],
  },
  {
    title: "验证质量",
    meta: "检查",
    icon: CheckCircle2,
    description: "测试、运行手册和可执行检查。",
    files: ["docs/TESTING.md", "docs/RUNBOOK.md", "scripts/check-runtime.sh", "scripts/check-ai-project.sh"],
  },
  {
    title: "Agent 能力",
    meta: "能力",
    icon: Bot,
    description: "Agent 规则、技能、适配和模型连接。",
    files: [".agents/skills/*", "AGENTS.md", "adapters/*", ".project-os/desktop-provider.json"],
  },
  {
    title: "工程资源",
    meta: "资源",
    icon: Package,
    description: "脚本、模板、schema 和可分发资源。",
    files: ["scripts/*", "schemas/*", "templates/*", "templates/project-docs/*"],
  },
  {
    title: "记忆沉淀",
    meta: "记忆",
    icon: Brain,
    description: "交接、经验、决策和结构化知识。",
    files: ["HANDOFF.md", "docs/LESSONS.md", "docs/DECISIONS.md", ".project-os/runs/*", "docs/data/knowledge-registry.json"],
  },
];

const workspaceAreas = [
  {
    title: "项目治理",
    meta: "流程",
    icon: ClipboardList,
    description: "按真实研发流程管理项目工程文件。",
    files: ["认识项目", "定义目标", "约束协作", "设计实现", "验证质量", "记忆沉淀"],
  },
  {
    title: "记忆",
    meta: "上下文",
    icon: Brain,
    description: "长期经验、偏好、决策和运行记录。",
    files: ["HANDOFF.md", "docs/LESSONS.md", "docs/DECISIONS.md", ".project-os/runs/*"],
  },
  {
    title: "Agent 能力",
    meta: "技能",
    icon: Bot,
    description: "Agent 规则、技能包、适配器和模型连接。",
    files: [".agents/skills/*", "AGENTS.md", "adapters/*", ".project-os/desktop-provider.json"],
  },
  {
    title: "工程文件",
    meta: "资产",
    icon: FileStack,
    description: "项目运行、文档治理和交付所需的关键文件。",
    files: ["PROJECT.md", "docs/*", "schemas/*", "templates/*"],
  },
  {
    title: "运行检查",
    meta: "验证",
    icon: TerminalSquare,
    description: "检查脚本、测试入口和受控 runner。",
    files: ["scripts/check-runtime.sh", "scripts/check-ai-project.sh", "scripts/check-template-sync.sh", "scripts/project-runner.sh"],
  },
  {
    title: "设置",
    meta: "配置",
    icon: Settings,
    description: "模型、主题、项目 registry 和本地配置。",
    files: [".project-os/desktop-provider.json", ".project-os/desktop-theme.json", ".project-os/desktop-registry.json"],
  },
];

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
  if (!window.__TAURI_INTERNALS__) {
    return fallbackSnapshot;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_workspace_snapshot");
}

async function loadProviderStatus() {
  if (!window.__TAURI_INTERNALS__) {
    return loadPreviewProviderStatus();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_provider_status");
}

async function loadModelCatalog() {
  if (!window.__TAURI_INTERNALS__) {
    return loadPreviewJson("/.project-os/model-catalog.json", fallbackModelCatalog);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("get_model_catalog");
}

async function loadDesktopTasks() {
  if (!window.__TAURI_INTERNALS__) {
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
  if (!window.__TAURI_INTERNALS__) {
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
  if (!window.__TAURI_INTERNALS__) {
    return task;
  }
  return invokeWorkspaceCommand("save_desktop_task", { input: { task } });
}

async function pickProjectDirectory() {
  if (!window.__TAURI_INTERNALS__) {
    throw new Error("浏览器预览模式暂不支持系统目录选择器");
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  return open({
    directory: true,
    multiple: false,
    title: "选择要接入 Project OS Desktop 的项目目录",
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
          <img src={omnideskLogo} alt="" />
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

function ProjectSidebar({ snapshot, onSwitchProject, onPickProject, onSelectEngineeringFile, projectActionError, selectedEngineeringFile }) {
  const [activeArea, setActiveArea] = useState(workspaceAreas[0].title);
  const [activeFlow, setActiveFlow] = useState(engineeringFlow[0].title);

  const renderFileSummary = (item) => (
    <div className="treeDetail" aria-label={`${item.title}工程文件`}>
      <div className="treeDescription">{item.description}</div>
      <div className="treeFileList">
        {item.files.map((file) => (
          <button
            className={`treeFile${selectedEngineeringFile?.path === file ? " active" : ""}`}
            key={file}
            onClick={() => onSelectEngineeringFile({ path: file, group: item.title, description: item.description })}
            title={file}
            type="button"
          >
            {file}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <aside className="left">
      <div className="leftScroll">
        <SectionTitle
          title="项目"
          meta={snapshot.projects.length}
          actions={(
            <Tooltip content="添加本地项目">
              <Button className="sectionIconAction" size="icon" variant="ghost" type="button" onClick={onPickProject} aria-label="添加本地项目">
                <Plus strokeWidth={2.25} aria-hidden="true" />
              </Button>
            </Tooltip>
          )}
        />
        <div className="projectList" aria-label="已接入项目">
          {snapshot.projects.map((project) => (
            <button
              className={`projectItem${project.isCurrent ? " active" : ""}`}
              type="button"
              key={project.id}
              title={project.path}
              onClick={() => onSwitchProject(project.id)}
            >
              <span className="projectMark">{project.name.slice(0, 2).toUpperCase()}</span>
              <span className="projectMeta">
                <strong>{project.name}</strong>
              </span>
            </button>
          ))}
        </div>
        {projectActionError ? <div className="projectError">{projectActionError}</div> : null}

        <SectionTitle title="工作区" />
        <nav className="flowNav workspaceTree" aria-label="工作区">
          {workspaceAreas.map((item) => {
            const Icon = item.icon;
            const isActive = item.title === activeArea;
            const showGovernanceFlow = isActive && item.title === "项目治理";

            return (
              <div className="workspaceGroup treeNode treeNode-root" key={item.title}>
                <button
                  className={`flowItem treeRow${isActive ? " active" : ""}`}
                  onClick={() => setActiveArea(item.title)}
                  type="button"
                >
                  <span className="flowIcon" aria-hidden="true">
                    <Icon strokeWidth={2.25} />
                  </span>
                  <span className="flowText">{item.title}</span>
                  <span className="flowMeta">{item.meta}</span>
                </button>
                {showGovernanceFlow ? (
                  <div className="inlineFlowDetail treeChildren">
                    <nav className="flowNav governanceNav" aria-label="项目治理流程">
                      {engineeringFlow.map((flow) => {
                        const FlowIcon = flow.icon;
                        const flowActive = flow.title === activeFlow;

                        return (
                          <div className="flowTreeNode treeNode" key={flow.title}>
                            <button
                              className={`flowItem flowItem-compact treeRow${flowActive ? " active" : ""}`}
                              onClick={() => setActiveFlow(flow.title)}
                              type="button"
                            >
                              <span className="flowIcon" aria-hidden="true">
                                <FlowIcon strokeWidth={2.25} />
                              </span>
                              <span className="flowText">{flow.title}</span>
                              <span className="flowMeta">{flow.meta}</span>
                            </button>
                            {flowActive ? (
                              <div className="flowNodeDetail treeChildren">
                                {renderFileSummary(flow)}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </nav>
                  </div>
                ) : isActive ? (
                  <div className="inlineFlowDetail">
                    {renderFileSummary(item)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
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

function checksForPlan(plan) {
  const checks = Array.isArray(plan?.checks) ? plan.checks : [];
  return guardedChecks.filter((check) =>
    checks.some((item) => item.includes(check.command) || item.includes(check.id) || item.includes(check.label))
  );
}

function AgentWorkspace({
  snapshot,
  selectedEngineeringFile,
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
  conversationResetKey,
  onGeneratePlan,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onRunGuardedCheck,
}) {
  const [taskInput, setTaskInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [pendingTurn, setPendingTurn] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("plan");
  const composerRef = React.useRef(null);
  const isConversationEmpty = !activeTask && !readonlyPlan && !loading && !error && !pendingTurn;

  useEffect(() => {
    setTaskInput("");
    setAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      return [];
    });
    setPendingTurn(null);
    setActiveWorkspaceTab("plan");
    composerRef.current?.focus();
  }, [conversationResetKey]);

  useEffect(() => {
    if (selectedEngineeringFile) {
      setActiveWorkspaceTab("file");
    } else {
      setActiveWorkspaceTab("plan");
    }
  }, [selectedEngineeringFile]);

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

  const submitTask = (event) => {
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
    setPendingTurn({
      attachments: submittedAttachments,
      text: nextInput || "请根据截图帮我分析并修改。",
    });
    setTaskInput("");
    setAttachments([]);
    onGeneratePlan({
      attachments: submittedAttachments.map((attachment) => ({
        dataUrl: attachment.dataUrl,
        mimeType: attachment.mimeType,
        name: attachment.name,
      })),
      task: nextInput || "请根据截图帮我分析并修改。",
    }).then((ok) => {
      if (ok) {
        setPendingTurn(null);
        submittedAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      }
    });
  };

  return (
    <Tabs className="center" value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab}>
      <TabsList className="tabs" aria-label="工作区视图">
        <TabsTrigger className="tab" value="plan">对话</TabsTrigger>
        {selectedEngineeringFile ? (
          <TabsTrigger className="tab fileTab" value="file">{selectedEngineeringFile.preview?.name || "文件"}</TabsTrigger>
        ) : null}
        <TabsTrigger className="tab" value="diff">改动预览</TabsTrigger>
        <TabsTrigger className="tab" value="checks">运行检查</TabsTrigger>
        <TabsTrigger className="tab" value="trace">记录</TabsTrigger>
      </TabsList>

      <TabsContent className="workspaceTabContent agentCanvas" value="plan">
        {isConversationEmpty ? (
          <div className="conversationStart">
            <h2>有什么新点子？</h2>
          </div>
        ) : (
          <Conversation>
            {activeTask || readonlyPlan || loading || error ? (
              <ConversationMessage
                meta={loading ? "连接中" : error ? "需要检查" : snapshot.phase}
                role="assistant"
                title="OmniDesk"
              >
                {loading
                  ? "正在连接本地工作模式，读取项目、任务队列和运行记录。"
                  : error
                    ? `本地能力暂时不可用：${error}`
                    : "你可以直接在下面说想改什么。我会先理解需求，给出计划，再生成改动预览和运行检查。"}
              </ConversationMessage>
            ) : null}

            {activeTask || readonlyPlan ? (
              <ConversationMessage
                meta={activeTask ? activeTask.status : "计划已生成"}
                role="assistant"
                title="OmniDesk"
              >
                {activeTask
                  ? "我已经把这个请求放进当前对话，下面是计划、改动草案和受控检查。"
                  : "这是刚生成的执行计划。确认后可以继续生成改动草案。"}
                <ConversationArtifact title={activeTask ? "当前对话" : "执行计划"}>
                  {activeTask ? (
                    <ActiveTask
                      task={activeTask}
                      runnerLoadingId={runnerLoadingId}
                      runnerError={runnerError}
                      patchLoading={patchLoading}
                      patchError={patchError}
                      applyLoading={applyLoading}
                      applyError={applyError}
                      onGeneratePatchDraft={onGeneratePatchDraft}
                      onApplyPatchDraft={onApplyPatchDraft}
                      onRunGuardedCheck={onRunGuardedCheck}
                    />
                  ) : (
                    <ReadonlyPlan plan={readonlyPlan} />
                  )}
                </ConversationArtifact>
                {planError ? <Notice className="planError" variant="danger">{planError}</Notice> : null}
              </ConversationMessage>
            ) : null}

          {pendingTurn ? (
            <>
              <ConversationMessage role="user">
                <div>{pendingTurn.text}</div>
                {pendingTurn.attachments.length ? (
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
              <ConversationMessage className="conversationMessage-thinking" grouped role="assistant" title="OmniDesk">
                正在思考...
              </ConversationMessage>
            </>
          ) : null}

          {activeTask || readonlyPlan ? (
            <ConversationMessage className="conversationMessage-compact" meta="local log" role="assistant" title="记录">
              <div className="terminal conversationTerminal">
                {snapshot.trace.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </ConversationMessage>
          ) : null}
          </Conversation>
        )}
      </TabsContent>

      {selectedEngineeringFile ? (
        <TabsContent className="workspaceTabContent fileCanvas" value="file">
          <EngineeringFileTab selectedEngineeringFile={selectedEngineeringFile} />
        </TabsContent>
      ) : null}

      <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" value="diff">
        <Notice variant="muted">改动预览会在生成 patch 草案后显示。</Notice>
      </TabsContent>

      <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" value="checks">
        <Notice variant="muted">运行检查会在确认计划后显示可执行项。</Notice>
      </TabsContent>

      <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" value="trace">
        <div className="terminal conversationTerminal">
          {snapshot.trace.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </TabsContent>

      {activeWorkspaceTab === "plan" ? (
        <ChatComposer
          attachments={attachments}
          inputRef={composerRef}
          disabled={planLoading}
          onFilesSelected={addImageFiles}
          onChange={(event) => setTaskInput(event.target.value)}
          onPaste={handlePaste}
          onRemoveAttachment={removeAttachment}
          onSubmit={submitTask}
          placeholder="说说你想改什么，例如：把 Provider 配置改成更小白的流程..."
          sending={planLoading}
          value={taskInput}
        />
      ) : null}
    </Tabs>
  );
}

function EngineeringFileTab({ selectedEngineeringFile }) {
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
  onGeneratePatchDraft,
  onApplyPatchDraft,
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
        <Badge status={task.status}>{task.status}</Badge>
      </div>
      <ReadonlyPlan plan={task.plan} />
      <Panel className="diffPanel" variant="info">
        <div className="runnerHeader">
          <strong>Diff Draft</strong>
          <span>只生成草案，不写入文件</span>
        </div>
        <TaskCommandBar
          actions={[
            {
              disabled: patchLoading,
              key: "generate-patch",
              label: patchLoading ? "Generating" : task.patchDraft ? "Regenerate Patch" : "Generate Patch",
              onClick: () => onGeneratePatchDraft(task.id),
            },
            {
              disabled: applyLoading || !task.patchDraft,
              key: "apply-patch",
              label: applyLoading ? "Applying" : "Apply Patch",
              onClick: () => onApplyPatchDraft(task.id),
              variant: "primary",
            },
          ]}
          meta={task.patchDraft?.files?.length ? `${task.patchDraft.files.length} files` : "等待生成 patch 草案。"}
        />
        {patchError ? <Notice className="planError" variant="danger">{patchError}</Notice> : null}
        {applyError ? <Notice className="planError" variant="danger">{applyError}</Notice> : null}
        {task.applyResult ? <Notice className="providerSuccess" variant="success">{task.applyResult.message}</Notice> : null}
        {task.verificationSummary ? (
          <Notice className={task.status === taskStatuses.failed ? "providerError" : "providerSuccess"} variant={task.status === taskStatuses.failed ? "danger" : "success"}>
            {task.verificationSummary}
          </Notice>
        ) : null}
        {task.runSummary ? <Notice className="providerHint" variant="info">{task.runSummary.message}：{task.runSummary.path}</Notice> : null}
        {task.patchDraft ? <PatchDraft draft={task.patchDraft} /> : null}
      </Panel>
      <Panel className="runnerPanel" variant="code">
        <div className="runnerHeader">
          <strong>Guarded Runner</strong>
          <span>只运行白名单检查</span>
        </div>
        <TaskCommandBar
          actions={runnableChecks.map((check) => ({
            disabled: Boolean(runnerLoadingId),
            key: check.id,
            label: runnerLoadingId === check.id ? "Running" : check.label,
            onClick: () => onRunGuardedCheck(task.id, check.id),
          }))}
        >
          {runnableChecks.length ? (
            null
          ) : (
            <span>当前计划没有匹配到可运行检查。</span>
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
                <em>{run.success ? "passed" : `failed ${run.code ?? ""}`}</em>
                <pre>{run.output || "No output."}</pre>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
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
          <strong>{plan.mode}</strong>
          <span>{plan.projectName}</span>
        </div>
        <Badge>只读</Badge>
      </div>
      <p>{plan.summary}</p>
      <div className="planColumns">
        <PlanList title="Steps" items={plan.steps} />
        <PlanList title="Read" items={plan.filesToRead} />
        <PlanList title="Changes" items={plan.candidateChanges} />
        <PlanList title="Checks" items={plan.checks} mono />
        <PlanList title="Guardrails" items={plan.guardrails} />
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
  snapshot,
  tasks,
  activeTaskId,
  onSelectTask,
  onMarkTaskWaiting,
}) {
  const todoMeta = tasks.length || snapshot.queue.length;
  const progressValue = Math.min(86, 48 + Math.min(snapshot.recommendationCount, 8) * 4 + Math.min(snapshot.runCount, 6) * 3);

  return (
    <aside className="right">
      <div className="rightScroll">
        <details className="railSection" open>
          <summary>
            <SectionTitle title="目标进度" meta={`${progressValue}%`} />
          </summary>
          <Panel className="goalProgress" variant="soft" padding="sm">
            <div className="goalProgressHeader">
              <strong>Desktop v0.1 工作台</strong>
              <span>{snapshot.stage}</span>
            </div>
            <div className="goalProgressBar" aria-hidden="true">
              <span style={{ width: `${progressValue}%` }} />
            </div>
            <div className="goalSteps">
              <span>已接入项目</span>
              <span>治理中</span>
              <span>待跑检查</span>
            </div>
          </Panel>
        </details>

        <details className="railSection" open>
          <summary>
            <SectionTitle title="待办" meta={todoMeta} />
          </summary>
          <div className="queue">
            {tasks.length ? (
              tasks.map((task) => (
                <TaskQueueItem
                  active={task.id === activeTaskId}
                  key={task.id}
                  task={task}
                  onSelectTask={onSelectTask}
                  onMarkTaskWaiting={onMarkTaskWaiting}
                />
              ))
            ) : (
              snapshot.queue.map((item, index) => (
                <TaskCard
                  body={item.body}
                  key={item.title}
                  progress={index === 0 ? 62 : undefined}
                  status={item.status}
                  title={item.title}
                  tone={item.tone}
                />
              ))
            )}
          </div>
        </details>

        <details className="railSection contextSection">
          <summary>
            <SectionTitle title="对话背景" meta={snapshot.memory.length} />
          </summary>
          <div className="memory">
          {snapshot.memory.map((item) => (
            <MemoryItem marker={item.marker} title={item.title} muted={item.muted} key={item.title}>
              {item.body}
            </MemoryItem>
          ))}
          </div>
        </details>
      </div>

    </aside>
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
    <Panel as="form" className="providerPanel" onSubmit={submitProvider}>
      <ProviderStatusRow enabled={provider.enabled} hasApiKey={provider.hasApiKey} />
      {isPreview ? (
        <InfoCallout>当前是浏览器预览，只能查看界面。保存 Key、刷新模型和写入配置需要在桌面 App 窗口中操作。</InfoCallout>
      ) : null}
      {profiles.length ? (
        <Field label="配置档案">
          {({ id }) => <Select id={id} value={form.profileId || provider.activeProfileId || ""} onChange={selectProfile}>
            {profiles.map((profile) => (
              <option value={profile.id} key={profile.id}>
                {profile.name}{profile.hasApiKey ? " · Key 已保存" : ""}
              </option>
            ))}
          </Select>}
        </Field>
      ) : null}
      <div className="providerSectionTitle">连接设置</div>
      <Field label="服务商">
        {({ id }) => <Select id={id} value={selectedProviderId || activePreset?.id || "gateway"} onChange={selectPreset}>
          {catalogProviders.map((preset) => (
            <option value={preset.id} key={preset.id}>{preset.label}</option>
          ))}
        </Select>}
      </Field>
      <Field label="API Key">
        {({ id }) => <Input
          id={id}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={provider.hasApiKey ? "已保存；留空则不修改" : "粘贴你的 API Key"}
        />}
      </Field>
      <Field label="API 请求地址">
        {({ id }) => <Input id={id} value={form.apiBase} onChange={(event) => updateField("apiBase", event.target.value)} />}
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
      <Field label="模型名称">
        {({ id }) => <Select id={id} value={!customModel && modelOptions.includes(form.model) ? form.model : "__custom"} onChange={selectModel}>
          {modelOptions.map((model) => (
            <option value={model} key={model}>{model}</option>
          ))}
          <option value="__custom">Custom</option>
        </Select>}
      </Field>
      {customModel || !modelOptions.includes(form.model) ? (
        <Field label="自定义模型">
          {({ id }) => <Input
            id={id}
            value={form.model}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="your-model-name"
          />}
        </Field>
      ) : null}
      {detectedModels.length ? (
        <Notice className="providerHint" variant="info">已从网关读取 {detectedModels.length} 个模型。下拉列表里的是这个 API Key 当前能看到的模型池。</Notice>
      ) : null}
      {modelTestMessage ? <Notice className="providerSuccess" variant="success">{modelTestMessage}</Notice> : null}
      <div className="providerSectionTitle">账号资料</div>
      <div className="providerSplit">
        <Field label="供应商名称">
          {({ id }) => <Input
            id={id}
            value={form.profileName || activePreset?.label || ""}
            onChange={(event) => updateField("profileName", event.target.value)}
            placeholder="例如：My Codex"
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
          value={form.profileWebsite || activePreset?.website || ""}
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
          aria-label="启用 provider"
          checked={form.enabled}
          onCheckedChange={(checked) => updateField("enabled", checked)}
        />
        启用 provider
      </div>
      <Button variant="primary" type="submit" disabled={isPreview}>保存并启用</Button>
      {probeError ? <Notice className="providerError" variant="danger">{probeError}</Notice> : null}
      {providerError ? <Notice className="providerError" variant="danger">{providerError}</Notice> : null}
    </Panel>
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

function MemoryItem({ marker, title, muted, children }) {
  return (
    <div className="memoryRow">
      <div className={`memoryDot${muted ? " muted" : ""}`}>{marker}</div>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
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

function App() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [readonlyPlan, setReadonlyPlan] = useState(fallbackPlan);
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState("");
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
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [providerError, setProviderError] = useState("");
  const [conversationResetKey, setConversationResetKey] = useState(0);
  const [selectedEngineeringFile, setSelectedEngineeringFile] = useState(null);

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
    setSource(window.__TAURI_INTERNALS__ ? "tauri" : "preview");
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
    let cancelled = false;

    loadDesktopTasks()
      .then((records) => {
        if (cancelled || !Array.isArray(records)) return;
        setTasks(records);
        if (records[0]?.id) {
          setActiveTaskId(records[0].id);
          setReadonlyPlan(records[0].plan || null);
        }
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

    if (!window.__TAURI_INTERNALS__) {
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
    setPlanError("");
    setPlanLoading(true);
    try {
      let plan;
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
      const nextTask = createTaskFromPlan(plan, input.task, snapshot.projectName);
      setReadonlyPlan(plan);
      await setAndPersistTask(nextTask);
      return true;
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setPlanLoading(false);
    }
  };

  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  const selectTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setActiveTaskId(id);
    setReadonlyPlan(task.plan);
    setSelectedEngineeringFile(null);
  };

  const startNewConversation = () => {
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
      <main className="workspace">
        <ProjectSidebar
          snapshot={snapshot}
          onSwitchProject={switchProject}
          onPickProject={pickProject}
          onSelectEngineeringFile={selectEngineeringFile}
          projectActionError={projectActionError}
          selectedEngineeringFile={selectedEngineeringFile}
        />
        <AgentWorkspace
          snapshot={snapshot}
          selectedEngineeringFile={selectedEngineeringFile}
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
          conversationResetKey={conversationResetKey}
          onGeneratePlan={generatePlan}
          onGeneratePatchDraft={generatePatchDraft}
          onApplyPatchDraft={applyPatchDraft}
          onRunGuardedCheck={runGuardedCheck}
        />
        <RightRail
          snapshot={snapshot}
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelectTask={selectTask}
          onMarkTaskWaiting={markTaskWaiting}
        />
      </main>
      <StatusBar snapshot={snapshot} source={source} />
    </div>
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);

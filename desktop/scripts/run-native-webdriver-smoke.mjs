import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webdriverPort = Number(process.env.OMNIDESK_WEBDRIVER_PORT || 4447);
const webdriverUrl = `http://127.0.0.1:${webdriverPort}`;
const webdriverRequestTimeoutMs = 15_000;
const diagnoseTerminal = process.env.OMNIDESK_NATIVE_TEST_TRACE_TERMINAL === "1";
const diagnosticReportPath = diagnoseTerminal
  ? path.join(os.tmpdir(), `omnidesk-native-terminal-diagnostic-${process.pid}.json`)
  : "";
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-native-webdriver-"));
let app;
let sessionId;

function writeFixture() {
  fs.mkdirSync(path.join(fixture, ".omnidesk", "data"), { recursive: true });
  fs.writeFileSync(path.join(fixture, "AGENTS.md"), "# Native WebDriver fixture\n", "utf8");
  fs.writeFileSync(path.join(fixture, "PROJECT.md"), "# Native WebDriver fixture\n", "utf8");
  fs.writeFileSync(path.join(fixture, ".omnidesk", "namespace.json"), JSON.stringify({
    schemaVersion: "omnidesk.state-namespace.v1",
    activeNamespace: "omnidesk",
    readMode: "omnidesk-primary",
  }), "utf8");
  fs.writeFileSync(path.join(fixture, ".omnidesk", "data", "state.json"), JSON.stringify({
    name: "Native WebDriver fixture",
    phase: "stabilizing",
    status: "testing"
  }), "utf8");
}

async function request(route, options = {}) {
  let response;
  try {
    response = await fetch(`${webdriverUrl}${route}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: AbortSignal.timeout(webdriverRequestTimeoutMs),
      ...options
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`WebDriver 请求超时或断开：${route}（${message}）`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.value?.error) {
    throw new Error(payload.value?.message || payload.value?.error || `WebDriver 请求失败：${response.status} ${route}`);
  }
  return payload.value;
}

async function waitForDriver() {
  const deadline = Date.now() + 120_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const status = await request("/status", { headers: {} });
      if (status.ready) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`原生 WebDriver 未在两分钟内就绪：${lastError}`);
}

function elementId(value) {
  return value["element-6066-11e4-a52e-4f735466cecf"];
}

async function find(selector) {
  const value = await request(`/session/${sessionId}/element`, {
    method: "POST",
    body: JSON.stringify({ using: "css selector", value: selector })
  });
  const id = elementId(value);
  if (!id) throw new Error(`找不到原生控件：${selector}`);
  return id;
}

async function waitForElement(selector) {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      return await find(selector);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`原生窗口未在 30 秒内渲染控件 ${selector}：${lastError}`);
}

async function script(source) {
  return request(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: JSON.stringify({ script: source, args: [] })
  });
}

async function clickButtonByText(text, rootSelector = "body") {
  const deadline = Date.now() + 12_000;
  let result;
  while (Date.now() < deadline) {
    result = await script(`const root = document.querySelector(${JSON.stringify(rootSelector)}); const buttons = [...(root?.querySelectorAll('button') || [])]; const button = buttons.find((item) => item.textContent.trim().includes(${JSON.stringify(text)})); if (!button) return { clicked: false, labels: buttons.map((item) => item.textContent.trim()).filter(Boolean).slice(0, 40) }; button.click(); return { clicked: true };`);
    if (result?.clicked) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`找不到按钮：${text}；当前按钮：${JSON.stringify(result?.labels || [])}`);
}

async function readTerminalTrace() {
  return script("return JSON.parse(window.localStorage.getItem('omnidesk.native-terminal-trace') || '[]')");
}

function readPersistedTerminalTrace() {
  try {
    return JSON.parse(fs.readFileSync(path.join(fixture, ".omnidesk", "cache", "native-terminal-trace.json"), "utf8"));
  } catch {
    return [];
  }
}

async function waitForPersistedTerminalStage(stage) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const trace = readPersistedTerminalTrace();
    if (trace.some((entry) => entry?.stage === stage)) return trace;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return readPersistedTerminalTrace();
}

function writeDiagnosticReport(payload) {
  if (!diagnosticReportPath) return;
  fs.writeFileSync(diagnosticReportPath, JSON.stringify({
    ...payload,
    recordedAt: new Date().toISOString(),
  }, null, 2), "utf8");
}

function childProcessIds(parentPid) {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([pid, ppid]) => Number.isInteger(pid) && Number.isInteger(ppid));
  const children = new Map();
  for (const [pid, ppid] of rows) {
    const entries = children.get(ppid) || [];
    entries.push(pid);
    children.set(ppid, entries);
  }
  const ids = [];
  const visit = (pid) => {
    for (const child of children.get(pid) || []) visit(child);
    ids.push(pid);
  };
  visit(parentPid);
  return ids;
}

function stopApp({ cleanup = false } = {}) {
  if (!app || app.exitCode !== null) {
    if (cleanup) fs.rmSync(fixture, { recursive: true, force: true });
    return;
  }
  for (const pid of childProcessIds(app.pid)) {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
  app = undefined;
  if (cleanup) fs.rmSync(fixture, { recursive: true, force: true });
}

function startApp() {
  app = spawn("npm", ["exec", "tauri", "--", "dev", "--features", "webdriver", "--no-watch", "--config", "src-tauri/tauri.webdriver.conf.json"], {
    cwd: desktopRoot,
    detached: true,
    env: {
      ...process.env,
      TAURI_WEBDRIVER_PORT: String(webdriverPort),
      OMNIDESK_WEBDRIVER_WORKSPACE_ROOT: fixture
    },
    stdio: diagnoseTerminal ? "inherit" : "ignore"
  });
}

async function openSession() {
  await waitForDriver();
  const session = await request("/session", {
    method: "POST",
    body: JSON.stringify({ capabilities: { alwaysMatch: {} } })
  });
  sessionId = session.sessionId;
}

async function closeSession() {
  if (sessionId) await request(`/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
  sessionId = undefined;
}

async function invokeNative(command, payload = {}) {
  const source = `const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(payload)}).then(done, (error) => done({ __omnideskError: String(error) }));`;
  const value = await request(`/session/${sessionId}/execute/async`, {
    method: "POST",
    body: JSON.stringify({ script: source, args: [] })
  });
  if (value?.__omnideskError) throw new Error(value.__omnideskError);
  return value;
}

let failure;
let currentStage = "创建原生夹具";
try {
  writeFixture();
  currentStage = "启动原生应用";
  startApp();
  currentStage = "创建 WebDriver 会话";
  await openSession();

  currentStage = "定位对话输入框";
  const input = await waitForElement('textarea[aria-label="任务输入"]');
  const send = await waitForElement('button[aria-label="发送"]');
  const initialDisabled = await request(`/session/${sessionId}/element/${send}/enabled`);
  if (initialDisabled !== false) throw new Error("空输入时发送按钮应不可用。");

  const prompt = "原生 WebDriver 输入验证";
  currentStage = "输入框状态同步";
  await request(`/session/${sessionId}/element/${input}/value`, {
    method: "POST",
    body: JSON.stringify({ text: prompt, value: [...prompt] })
  });
  const currentValue = await script('return document.querySelector(\'textarea[aria-label="任务输入"]\').value');
  if (currentValue !== prompt) throw new Error("原生输入事件没有更新 React 状态。");
  const enabledAfterInput = await request(`/session/${sessionId}/element/${send}/enabled`);
  if (enabledAfterInput !== true) throw new Error("填写输入后发送按钮应可用。");
  const startupTrace = await waitForPersistedTerminalStage("terminal-session.effect-start");
  const startupLocalTrace = await readTerminalTrace();
  if (!startupTrace.some((entry) => entry?.stage === "terminal-session.effect-start")
    && !startupLocalTrace.some((entry) => entry?.stage === "terminal-session.effect-start")) {
    const runtimeIdentity = await script("return { hasBridge: Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_METADATA__), href: window.location.href, port: window.location.port }").catch(() => ({}));
    throw new Error(`原生测试构建没有写入终端启动阶段记录：${JSON.stringify({ runtimeIdentity, startupLocalTrace, startupTrace })}`);
  }

  currentStage = "读取原生 Agent 工具能力";
  const toolRegistry = await invokeNative("get_agent_tool_registry");
  const expectedTools = ["git_status", "list_files", "read_file", "search_project"];
  const discoveredTools = (toolRegistry?.tools || []).map((tool) => tool.name).sort();
  if (toolRegistry?.schemaVersion !== "omnidesk.tool-registry.v0.1"
    || JSON.stringify(discoveredTools) !== JSON.stringify(expectedTools)
    || toolRegistry.tools.some((tool) => tool.source !== "builtin"
      || tool.risk !== "read-only"
      || tool.requiresApproval
      || tool.inputSchema?.additionalProperties !== false)) {
    throw new Error(`原生工具能力发现未遵守版本、风险或封闭 schema 契约：${JSON.stringify(toolRegistry)}`);
  }

  currentStage = "持久化原生 MCP Server 配置";
  await invokeNative("add_registry_project", { input: { path: fixture, accessMode: "controlled" } });
  await invokeNative("update_project_capability", { input: {
    capabilityId: "agent-configuration", status: "enabled", modules: [], candidateModules: [],
  } });
  const mcpExecutionMarker = path.join(fixture, "mcp-config-must-not-execute");
  const savedMcpRegistry = await invokeNative("save_mcp_server", { input: {
    schemaVersion: "omnidesk.mcp-server.v0.1",
    id: "native-fixture",
    name: "Native Fixture",
    transport: "stdio",
    command: "/usr/bin/touch",
    args: [mcpExecutionMarker],
    env: [{ name: "API_KEY", sourceEnv: "OMNIDESK_MCP_FIXTURE_KEY" }],
    enabled: true,
    approvalPolicy: "always",
  } });
  const loadedMcpRegistry = await invokeNative("get_mcp_server_registry");
  if (savedMcpRegistry?.schemaVersion !== "omnidesk.mcp-servers.v0.1"
    || loadedMcpRegistry?.servers?.[0]?.id !== "native-fixture"
    || loadedMcpRegistry?.servers?.[0]?.approvalPolicy !== "always"
    || fs.existsSync(mcpExecutionMarker)) {
    throw new Error(`MCP 配置未安全持久化，或保存配置时错误启动了进程：${JSON.stringify(loadedMcpRegistry)}`);
  }
  currentStage = "创建原生 MCP 能力发现审批";
  const mcpDiscoveryRun = await invokeNative("request_mcp_discovery", { input: { serverId: "native-fixture" } });
  if (mcpDiscoveryRun?.status !== "awaiting-approval"
    || mcpDiscoveryRun?.approval?.name !== "mcp_discover"
    || mcpDiscoveryRun?.approval?.status !== "pending"
    || fs.existsSync(mcpExecutionMarker)) {
    throw new Error(`MCP 发现请求绕过审批或提前启动了进程：${JSON.stringify(mcpDiscoveryRun)}`);
  }
  await invokeNative("cancel_agent_run", { input: { id: mcpDiscoveryRun.id } });
  const removedMcpRegistry = await invokeNative("remove_mcp_server", { input: { id: "native-fixture" } });
  if (removedMcpRegistry?.servers?.length !== 0 || fs.existsSync(mcpExecutionMarker)) {
    throw new Error("删除 MCP 配置后仍有残留，或配置进程被错误启动。");
  }

  currentStage = "执行原生 MCP 发现与调用审批闭环";
  const mcpCallMarker = path.join(fixture, "mcp-call-approved");
  const mcpScript = path.join(fixture, "native-mcp.sh");
  fs.writeFileSync(mcpScript, `#!/bin/sh
IFS= read -r initialize
printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}}}}'
IFS= read -r initialized
IFS= read -r request
case "$request" in
  *tools/list*) printf '%s\n' '{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"lookup","inputSchema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}]}}' ;;
  *tools/call*) touch '${mcpCallMarker}'; printf '%s\n' '{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"found"}],"isError":false}}' ;;
esac
`, { mode: 0o700 });
  await invokeNative("save_mcp_server", { input: {
    schemaVersion: "omnidesk.mcp-server.v0.1", id: "native-callable", name: "Native Callable",
    transport: "stdio", command: mcpScript, args: [], env: [], enabled: true, approvalPolicy: "always",
  } });
  const discoveryPending = await invokeNative("request_mcp_discovery", { input: { serverId: "native-callable" } });
  const discoveryApproved = await invokeNative("approve_agent_run", { input: { id: discoveryPending.id } });
  await invokeNative("execute_approved_agent_tool", { input: { id: discoveryApproved.id, token: discoveryApproved.approvalToken } });
  const discoveryEvidence = await invokeNative("get_mcp_discovery_evidence", { input: { serverId: "native-callable" } });
  if (discoveryEvidence?.projectId == null || discoveryEvidence?.result?.tools?.[0]?.remoteName !== "lookup") {
    throw new Error(`原生 MCP 发现证据没有按当前项目投影：${JSON.stringify(discoveryEvidence)}`);
  }

  currentStage = "通过原生 MCP 管理界面创建调用审批";
  await clickButtonByText("Agent 配置", 'nav[aria-label="工作区能力"]');
  await clickButtonByText("工具白名单", 'nav[aria-label="Agent 配置子项"]');
  await waitForElement("[data-mcp-management]");
  await waitForElement(".mcpToolRow");
  const mcpSurfaceText = await script("return document.querySelector('[data-mcp-management]')?.textContent || ''");
  if (!mcpSurfaceText.includes("Native Callable") || !mcpSurfaceText.includes("lookup")) {
    throw new Error(`原生 MCP 管理界面没有显示 Server 或发现工具：${mcpSurfaceText}`);
  }
  await clickButtonByText("准备调用", "[data-mcp-management]");
  const queryInput = await waitForElement(".mcpToolForm .uiInput");
  await request(`/session/${sessionId}/element/${queryInput}/value`, {
    method: "POST",
    body: JSON.stringify({ text: "docs", value: [..."docs"] })
  });
  const callSubmit = await waitForElement('.mcpToolForm button[type="submit"]');
  await request(`/session/${sessionId}/element/${callSubmit}/click`, { method: "POST" });
  const callPendingDeadline = Date.now() + 10_000;
  let callPending;
  while (Date.now() < callPendingDeadline) {
    const runs = await invokeNative("list_agent_runs");
    callPending = runs.find((run) => run?.approval?.name === "mcp_call" && run?.status === "awaiting-approval");
    if (callPending) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (callPending?.status !== "awaiting-approval" || callPending?.approval?.name !== "mcp_call" || fs.existsSync(mcpCallMarker)) {
    throw new Error(`MCP 工具调用没有停在独立审批前：${JSON.stringify(callPending)}`);
  }
  await waitForElement(`[data-mcp-run-id="${callPending.id}"]`);
  await clickButtonByText("批准并执行", `[data-mcp-run-id="${callPending.id}"]`);
  const callCompletedDeadline = Date.now() + 10_000;
  let callCompleted;
  while (Date.now() < callCompletedDeadline) {
    const runs = await invokeNative("list_agent_runs");
    callCompleted = runs.find((run) => run.id === callPending.id);
    if (callCompleted?.status === "succeeded") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const callResult = callCompleted?.checkpoint?.toolResult;
  if (!fs.existsSync(mcpCallMarker) || callCompleted?.status !== "succeeded" || callResult?.remoteName !== "lookup" || callResult?.content?.[0]?.text !== "found") {
    throw new Error(`MCP 工具调用审批后没有形成受控结果：${JSON.stringify(callCompleted)}`);
  }
  await invokeNative("remove_mcp_server", { input: { id: "native-callable" } });

  currentStage = "创建结构化追问夹具";
  const closeMcpTab = await waitForElement(".workspaceTab.fileTab .workspaceTabClose");
  await request(`/session/${sessionId}/element/${closeMcpTab}/click`, { method: "POST" });
  await waitForElement("[data-conversation-id]");
  const conversationId = await script("return document.querySelector('[data-conversation-id]')?.dataset.conversationId || ''");
  if (!conversationId) throw new Error("原生对话没有暴露稳定的 conversationId。");
  const interactionRun = await invokeNative("seed_native_agent_interaction", { input: { conversationId } });
  if (interactionRun?.status !== "awaiting-user-input" || interactionRun?.approval != null
    || interactionRun?.checkpoint?.interaction?.kind !== "ask_user") {
    throw new Error(`原生追问夹具没有进入安全等待态：${JSON.stringify(interactionRun)}`);
  }
  await script("window.dispatchEvent(new Event('omnidesk:agent-runs-changed')); return true");
  currentStage = "提交对话内结构化追问";
  const teamOption = await waitForElement('.conversationUserForm input[type="radio"][value="team"]');
  await request(`/session/${sessionId}/element/${teamOption}/click`, { method: "POST" });
  const formSubmit = await waitForElement(".conversationUserForm .uiButton-primary");
  await request(`/session/${sessionId}/element/${formSubmit}/click`, { method: "POST" });
  const interactionDeadline = Date.now() + 15_000;
  let submittedInteraction;
  while (Date.now() < interactionDeadline) {
    submittedInteraction = await invokeNative("read_native_agent_interaction");
    if (submittedInteraction?.interactions?.[0]?.status === "submitted") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const persistedForm = submittedInteraction?.interactions?.[0];
  if (persistedForm?.response?.answers?.scope !== "team" || submittedInteraction?.approval != null
    || submittedInteraction?.checkpoint?.toolResult?.type !== "ask_user_result") {
    throw new Error(`结构化追问没有持久化回答或错误创建了审批：${JSON.stringify(submittedInteraction)}`);
  }
  const sameReply = await invokeNative("submit_agent_interaction", { input: {
    action: "submit", answers: { scope: "team" }, formId: persistedForm.id, id: submittedInteraction.id,
  } });
  if (sameReply?.revision !== submittedInteraction.revision) throw new Error("相同表单回答没有保持幂等。");
  let conflictingReplyRejected = false;
  try {
    await invokeNative("submit_agent_interaction", { input: {
      action: "submit", answers: { scope: "personal" }, formId: persistedForm.id, id: submittedInteraction.id,
    } });
  } catch (error) {
    conflictingReplyRejected = String(error).includes("已经提交");
  }
  if (!conflictingReplyRejected) throw new Error("冲突的重复表单回答没有被拒绝。");

  currentStage = "重建等待中的追问用于重启恢复";
  const pendingBeforeRestart = await invokeNative("seed_native_agent_interaction", { input: { conversationId } });
  if (pendingBeforeRestart?.status !== "awaiting-user-input") throw new Error("无法创建重启恢复追问夹具。");

  currentStage = "创建恢复夹具";
  const seeded = await invokeNative("seed_native_agent_run_for_recovery");
  const expectedAuthorizedFiles = ["README.md", "AGENTS.md", "PROJECT.md", "docs/TESTING.md"];
  if (seeded?.status !== "awaiting-approval" || seeded?.approval?.token !== "native-recovery-approval"
    || JSON.stringify(seeded?.checkpoint?.allowedFiles) !== JSON.stringify(expectedAuthorizedFiles)) {
    throw new Error(`原生恢复夹具未创建等待审批 Run：${JSON.stringify(seeded)}`);
  }
  currentStage = "创建原生 Agent 调度夹具";
  const schedulerBeforeRestart = await invokeNative("seed_native_agent_scheduler");
  const queuedBeforeRestart = schedulerBeforeRestart?.entries?.find((entry) => entry.runId === "native-scheduler-queued");
  const capQueuedBeforeRestart = schedulerBeforeRestart?.entries?.find((entry) => entry.runId === "native-scheduler-cap-queued");
  if (schedulerBeforeRestart?.activeCount !== 2 || schedulerBeforeRestart?.maxConcurrentRuns !== 2
    || queuedBeforeRestart?.status !== "queued" || queuedBeforeRestart?.queuePosition !== 1
    || capQueuedBeforeRestart?.status !== "queued" || capQueuedBeforeRestart?.queuePosition !== 2) {
    throw new Error(`原生调度夹具没有保留跨项目并发上限、项目互斥和队列位置：${JSON.stringify(schedulerBeforeRestart)}`);
  }
  currentStage = "重启原生应用";
  await closeSession();
  stopApp();
  await new Promise((resolve) => setTimeout(resolve, 500));
  startApp();
  await openSession();
  currentStage = "等待重启后的窗口渲染";
  await waitForElement('textarea[aria-label="任务输入"]');
  const restoredForm = await waitForElement('.conversationUserForm input[type="radio"][value="team"]');
  if (!restoredForm) throw new Error("重启后没有恢复对话内的待回答表单。");
  const restoredInteraction = await invokeNative("read_native_agent_interaction");
  if (restoredInteraction?.status !== "awaiting-user-input" || restoredInteraction?.approval != null
    || restoredInteraction?.checkpoint?.interaction?.status !== "pending") {
    throw new Error(`重启后追问状态不正确：${JSON.stringify(restoredInteraction)}`);
  }
  currentStage = "验证恢复审批";
  const interrupted = await invokeNative("read_native_agent_run_for_recovery");
  if (interrupted?.status !== "interrupted" || interrupted?.checkpoint?.nextAction !== "resume-approval"
    || interrupted?.approval?.token !== "native-recovery-approval"
    || JSON.stringify(interrupted?.checkpoint?.allowedFiles) !== JSON.stringify(expectedAuthorizedFiles)) {
    throw new Error(`原生重启未保留审批 checkpoint：${JSON.stringify(interrupted)}`);
  }
  currentStage = "验证重启后的 Agent 调度恢复";
  const schedulerAfterRestart = await invokeNative("read_native_agent_scheduler");
  const interruptedScheduler = schedulerAfterRestart?.find(
    (entry) => entry.runId === "native-scheduler-active",
  );
  const interruptedSchedulerB = schedulerAfterRestart?.find(
    (entry) => entry.runId === "native-scheduler-active-b",
  );
  const queuedScheduler = schedulerAfterRestart?.find(
    (entry) => entry.runId === "native-scheduler-queued",
  );
  const capQueuedScheduler = schedulerAfterRestart?.find(
    (entry) => entry.runId === "native-scheduler-cap-queued",
  );
  if (interruptedScheduler?.status !== "interrupted" || interruptedSchedulerB?.status !== "interrupted"
    || queuedScheduler?.status !== "queued" || capQueuedScheduler?.status !== "queued") {
    throw new Error(`重启后调度恢复不正确：${JSON.stringify(schedulerAfterRestart)}`);
  }
  const persistedRunsAfterRestart = await invokeNative("list_agent_runs");
  const queuedRunAfterRestart = persistedRunsAfterRestart?.find((run) => run.id === "native-scheduler-queued");
  const interruptedRunAfterRestart = persistedRunsAfterRestart?.find((run) => run.id === "native-scheduler-active");
  if (queuedRunAfterRestart?.status !== "queued"
    || queuedRunAfterRestart?.evidence?.[0]?.schemaVersion !== "omnidesk.run-event.v0.1"
    || queuedRunAfterRestart?.evidence?.[0]?.kind !== "scheduling"
    || interruptedRunAfterRestart?.evidence?.at(-1)?.kind !== "recovery") {
    throw new Error(`重启后 Agent Run 与 Scheduler 的 queued 状态不一致：${JSON.stringify(queuedRunAfterRestart)}`);
  }
  currentStage = "取消重启后仍在排队的 Agent Run";
  const cancelledQueuedRun = await invokeNative("cancel_agent_run", { input: { id: "native-scheduler-queued" } });
  const schedulerAfterCancel = await invokeNative("read_native_agent_scheduler");
  const cancelledScheduler = schedulerAfterCancel?.find((entry) => entry.runId === "native-scheduler-queued");
  if (cancelledQueuedRun?.status !== "cancelled" || cancelledScheduler?.status !== "cancelled"
    || cancelledQueuedRun?.evidence?.at(-1)?.kind !== "cancellation") {
    throw new Error(`显式取消没有同步 Agent Run 与 Scheduler：${JSON.stringify({ cancelledQueuedRun, cancelledScheduler })}`);
  }
  currentStage = "导出脱敏 Agent Run 时间线";
  const timelineExport = await invokeNative("export_agent_run_timeline", {
    input: { id: "native-scheduler-queued" },
  });
  const exportedTimeline = timelineExport?.timeline;
  const serializedEvents = JSON.stringify(exportedTimeline?.events);
  if (exportedTimeline?.schemaVersion !== "omnidesk.run-timeline-export.v0.1"
    || exportedTimeline?.redaction?.policy !== "metadata-only"
    || !exportedTimeline?.metrics?.eventCount
    || !Array.isArray(exportedTimeline?.events)
    || !timelineExport?.path?.endsWith("/native-scheduler-queued.json")) {
    throw new Error(`原生时间线导出缺少 schema、指标或脱敏策略：${JSON.stringify(timelineExport)}`);
  }
  for (const excludedContent of [
    "Native scheduler fixture; do not execute tools.",
    "observations",
    "diff --git",
  ]) {
    if (serializedEvents.includes(excludedContent)) {
      throw new Error(`脱敏时间线泄露了排除内容：${excludedContent}`);
    }
  }
  const resumed = await invokeNative("resume_agent_run", { input: { id: "native-recovery-run" } });
  if (resumed?.status !== "awaiting-approval" || resumed?.approval?.token !== "native-recovery-approval") {
    throw new Error(`原生恢复没有回到原审批：${JSON.stringify(resumed)}`);
  }

  if (diagnoseTerminal) {
    let trace = [];
    try {
      writeDiagnosticReport({ phase: "before-terminal-tab" });
      await script("window.localStorage.removeItem('omnidesk.native-terminal-trace'); return true");
      // Radix Tabs does not expose the trigger value as a DOM attribute; aria-controls
      // is the stable contract linking the workspace trigger to the terminal panel.
      const terminalTab = await waitForElement('button[role="tab"][aria-controls*="terminal"]');
      writeDiagnosticReport({ phase: "terminal-tab-found" });
      await request(`/session/${sessionId}/element/${terminalTab}/click`, { method: "POST" });
      writeDiagnosticReport({ phase: "terminal-tab-clicked" });
      await new Promise((resolve) => setTimeout(resolve, 750));
      trace = await readTerminalTrace();
      const persistedTrace = readPersistedTerminalTrace();
      writeDiagnosticReport({ phase: "terminal-trace-read", persistedTrace, trace });
      console.log(`原生终端诊断阶段：${JSON.stringify({ persistedTrace, trace })}`);
    } catch (error) {
      try { trace = await readTerminalTrace(); } catch {}
      const persistedTrace = readPersistedTerminalTrace();
      writeDiagnosticReport({
        error: error instanceof Error ? error.message : String(error),
        phase: "terminal-diagnostic-error",
        persistedTrace,
        trace,
      });
      console.error(`原生终端诊断中断；最后可读取阶段：${JSON.stringify({ persistedTrace, trace })}`);
      throw error;
    }
  }

  console.log(`原生 WebDriver smoke 通过：可发现版本化内置工具及其风险/schema，MCP 配置零自动执行，发现与调用分别取得项目互斥和独立审批，tools/call 审批前 marker 不存在、批准后才执行并写回有界结果；提交持久化 ask_user 表单并验证幂等，验证跨项目并发与稳定队列位置，并在重启后恢复表单与原审批；Run Timeline 可按 metadata-only 策略脱敏导出${diagnoseTerminal ? "，并完成终端诊断" : ""}；未写入工程文件。`);
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
  console.error(`原生 WebDriver smoke 失败（${currentStage}）：${failure.message}`);
} finally {
  await closeSession();
  stopApp({ cleanup: true });
}

if (failure) process.exitCode = 1;

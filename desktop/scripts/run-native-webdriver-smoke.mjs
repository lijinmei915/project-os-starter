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

  currentStage = "创建结构化追问夹具";
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

  console.log(`原生 WebDriver smoke 通过：可提交持久化 ask_user 表单、验证幂等并在重启后恢复表单与原审批${diagnoseTerminal ? "，并完成终端诊断" : ""}；未写入工程文件。`);
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
  console.error(`原生 WebDriver smoke 失败（${currentStage}）：${failure.message}`);
} finally {
  await closeSession();
  stopApp({ cleanup: true });
}

if (failure) process.exitCode = 1;

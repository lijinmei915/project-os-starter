import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webdriverPort = Number(process.env.OMNIDESK_WEBDRIVER_PORT || 4447);
const webdriverUrl = `http://127.0.0.1:${webdriverPort}`;
const diagnoseTerminal = process.env.OMNIDESK_NATIVE_TEST_TRACE_TERMINAL === "1";
const diagnosticReportPath = diagnoseTerminal
  ? path.join(os.tmpdir(), `omnidesk-native-terminal-diagnostic-${process.pid}.json`)
  : "";
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-native-webdriver-"));
let app;
let sessionId;

function writeFixture() {
  fs.mkdirSync(path.join(fixture, ".project-os"), { recursive: true });
  fs.writeFileSync(path.join(fixture, "AGENTS.md"), "# Native WebDriver fixture\n", "utf8");
  fs.writeFileSync(path.join(fixture, "PROJECT.md"), "# Native WebDriver fixture\n", "utf8");
  fs.writeFileSync(path.join(fixture, ".project-os", "state.json"), JSON.stringify({
    name: "Native WebDriver fixture",
    phase: "stabilizing",
    status: "testing"
  }), "utf8");
}

async function request(route, options = {}) {
  const response = await fetch(`${webdriverUrl}${route}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
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
  const candidates = [
    path.join(fixture, ".omnidesk", "cache", "native-terminal-trace.json"),
    path.join(fixture, ".project-os", "native-terminal-trace.json"),
  ];
  for (const tracePath of candidates) {
    try {
      return JSON.parse(fs.readFileSync(tracePath, "utf8"));
    } catch {
      // A legacy fixture may not have activated the namespace yet.
    }
  }
  return [];
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

function stopApp() {
  if (!app || app.exitCode !== null) {
    fs.rmSync(fixture, { recursive: true, force: true });
    return;
  }
  for (const pid of childProcessIds(app.pid)) {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
  fs.rmSync(fixture, { recursive: true, force: true });
}

let failure;
try {
  writeFixture();
  app = spawn("npm", ["exec", "tauri", "--", "dev", "--features", "webdriver", "--no-watch", "--config", "src-tauri/tauri.webdriver.conf.json"], {
    cwd: desktopRoot,
    detached: true,
    env: {
      ...process.env,
      TAURI_WEBDRIVER_PORT: String(webdriverPort),
      OMNIDESK_WEBDRIVER_WORKSPACE_ROOT: fixture
    },
    stdio: "ignore"
  });

  await waitForDriver();
  const session = await request("/session", {
    method: "POST",
    body: JSON.stringify({ capabilities: { alwaysMatch: {} } })
  });
  sessionId = session.sessionId;

  const input = await waitForElement('textarea[aria-label="任务输入"]');
  const send = await waitForElement('button[aria-label="发送"]');
  const initialDisabled = await request(`/session/${sessionId}/element/${send}/enabled`);
  if (initialDisabled !== false) throw new Error("空输入时发送按钮应不可用。");

  const prompt = "原生 WebDriver 输入验证";
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

  console.log(`原生 WebDriver smoke 通过：可定位并驱动输入与发送状态${diagnoseTerminal ? "，并完成终端诊断" : ""}；未提交消息，未写入 fixture。`);
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
  console.error(`原生 WebDriver smoke 失败：${failure.message}`);
} finally {
  if (sessionId) await request(`/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
  stopApp();
}

if (failure) process.exitCode = 1;

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeProviderUsage,
  validateProviderFallbackRuntimeResult,
} from "../src/agent-runtime/provider-evaluation.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "..");
const cargoManifest = path.join(desktopRoot, "src-tauri", "Cargo.toml");
const cargoTargetRoot = process.env.CARGO_TARGET_DIR
  ? path.resolve(repositoryRoot, process.env.CARGO_TARGET_DIR)
  : path.join(desktopRoot, "src-tauri", "target");
const runtimeBinaryPath = path.join(
  cargoTargetRoot,
  "debug",
  `omnidesk-provider-fallback-eval${process.platform === "win32" ? ".exe" : ""}`,
);
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const tracePath = argument("--trace") ? path.resolve(argument("--trace")) : "";
const apiBase = String(process.env.OMNIDESK_AGENT_EVAL_API_BASE || "").trim();
const apiKey = String(process.env.OMNIDESK_AGENT_EVAL_KEY || "").trim();
const model = String(process.env.OMNIDESK_AGENT_EVAL_MODEL || "").trim();
if (!tracePath) throw new Error("Provider Fallback Eval requires --trace");
if (!apiBase || !apiKey || !model) throw new Error("Provider Fallback Eval requires API base, key, and model environment values");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-provider-fallback-"));
const projectRoot = path.join(fixtureRoot, "project");
fs.mkdirSync(projectRoot, { recursive: true });
fs.writeFileSync(path.join(projectRoot, "README.md"), "# Provider Fallback Eval\n\nRead-only fixture.\n");
const relayEvidence = { requests: [], upstream: null };
const relay = http.createServer((request, response) => {
  void handleRelayRequest(request, response).catch((error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: String(error instanceof Error ? error.message : error).slice(0, 500) } }));
  });
});
await new Promise((resolve) => relay.listen(0, "127.0.0.1", resolve));
const relayBase = `http://127.0.0.1:${relay.address().port}/v1`;
const startedAt = new Date().toISOString();
const started = Date.now();

let runtimeResult = null;
let failure = null;
try {
  const build = await buildRuntime();
  if (build.code !== 0) throw new Error(build.stderr || `Provider Fallback Runtime build exited ${build.code}`);
  const execution = await runRuntime({
    schemaVersion: "omnidesk.provider-fallback-eval-request.v0.1",
    projectRoot,
    projectId: "provider-fallback-eval",
    proxyApiBase: relayBase,
    model,
  });
  if (execution.code !== 0) throw new Error(execution.stderr || `Provider Fallback Runtime exited ${execution.code}`);
  runtimeResult = JSON.parse(execution.stdout.trim());
  validateProviderFallbackRuntimeResult(runtimeResult);
  validateRelayEvidence(relayEvidence);
} catch (error) {
  failure = redact(String(error instanceof Error ? error.message : error), fixtureRoot);
}

await new Promise((resolve) => relay.close(resolve));
const trace = {
  schemaVersion: "omnidesk.provider-fallback-eval.v0.1",
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  status: failure ? "failed" : "passed",
  endpointHost: new URL(chatCompletionsEndpoint(apiBase)).host,
  model,
  relay: relayEvidence,
  runtime: runtimeResult,
  error: failure,
};
fs.mkdirSync(path.dirname(tracePath), { recursive: true });
fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
fs.rmSync(fixtureRoot, { recursive: true, force: true });
if (failure) throw new Error(`Provider Fallback Eval failed; trace: ${tracePath}`);
process.stdout.write(`${JSON.stringify({ status: "passed", tracePath, model, durationMs: trace.durationMs })}\n`);

async function handleRelayRequest(request, response) {
  let rawBody = "";
  for await (const chunk of request) rawBody = `${rawBody}${chunk}`.slice(-2_000_000);
  const body = JSON.parse(rawBody);
  const sequence = relayEvidence.requests.length + 1;
  relayEvidence.requests.push({
    sequence,
    hasTools: Array.isArray(body.tools),
    toolChoicePresent: body.tool_choice != null,
    stream: body.stream === true,
  });
  if (sequence === 1) {
    const error = JSON.stringify({ error: { message: "tools are unsupported by compatibility relay" } });
    response.writeHead(400, { "content-type": "application/json", "content-length": Buffer.byteLength(error) });
    response.end(error);
    return;
  }
  if (sequence === 2) {
    const upstreamStarted = Date.now();
    const upstream = await fetch(chatCompletionsEndpoint(apiBase), {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ ...body, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    const raw = await upstream.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    relayEvidence.upstream = {
      accepted: upstream.ok,
      httpStatus: upstream.status,
      durationMs: Date.now() - upstreamStarted,
      providerRequestId: upstream.headers.get("x-request-id") || "",
      contentChars: [...content].length,
      usage: normalizeProviderUsage(payload?.usage),
    };
    if (!upstream.ok || !content) throw new Error(`real Provider fallback response invalid: HTTP ${upstream.status}`);
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "close",
    });
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
    await delay(13_000);
    response.end("data: [DONE]\n\n");
    return;
  }
  if (sequence === 3) {
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "已收到部分正文" } }] })}\n\n`);
    await delay(100);
    response.socket?.destroy();
    return;
  }
  response.writeHead(500, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { message: "unexpected relay request" } }));
}

function validateRelayEvidence(evidence) {
  if (evidence.requests.length !== 3) throw new Error("Provider fallback relay expected exactly three requests");
  if (!evidence.requests[0].hasTools || !evidence.requests[0].toolChoicePresent) throw new Error("Provider fallback first request did not use native tools");
  if (evidence.requests[1].hasTools || evidence.requests[1].toolChoicePresent) throw new Error("Provider fallback retry still contained tools");
  if (evidence.requests[2].hasTools) throw new Error("Persisted compatibility mode did not suppress tools");
  if (evidence.upstream?.accepted !== true || !(evidence.upstream?.contentChars > 0)) throw new Error("Provider fallback did not receive a real upstream answer");
  if (evidence.upstream?.usage?.reported !== true) throw new Error("Provider fallback upstream usage is missing");
}

function runRuntime(request) {
  return new Promise((resolve) => {
    const child = spawn(runtimeBinaryPath, [], { cwd: repositoryRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-2_000_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-20_000); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stderr: redact(stderr, fixtureRoot), stdout });
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function buildRuntime() {
  return new Promise((resolve) => {
    const child = spawn("cargo", [
      "build",
      "--quiet",
      "--manifest-path",
      cargoManifest,
      "--bin",
      "omnidesk-provider-fallback-eval",
    ], { cwd: repositoryRoot, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 600_000);
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-20_000); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        code: timedOut ? 124 : code,
        stderr: timedOut ? "Provider Fallback Runtime build timed out after 600 seconds" : redact(stderr, fixtureRoot),
      });
    });
  });
}

function chatCompletionsEndpoint(base) {
  const normalized = base.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redact(value, root) {
  return String(value || "").split(root).join("<eval-root>").split(apiKey).join("<redacted>").slice(0, 20_000);
}

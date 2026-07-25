import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizeProviderUsage,
  validateProviderFallbackRuntimeResult,
  validateProviderTimelineRuntimeResult,
} from "../src/agent-runtime/provider-evaluation.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(desktopRoot, "scripts", "run-provider-function-eval.mjs");

test("records a redacted real-provider function-call trace", async () => {
  let requestBody = null;
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      requestBody = JSON.parse(body);
      response.writeHead(200, { "content-type": "application/json", "x-request-id": "eval-request" });
      response.end(JSON.stringify({
        choices: [{
          finish_reason: "tool_calls",
          message: {
            content: null,
            tool_calls: [{
              id: "call-1",
              type: "function",
              function: { name: "start_engineering_task", arguments: "{\"task\":\"更新 README 命令\"}" },
            }],
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-function-eval-"));
  const tracePath = path.join(root, "trace.json");
  try {
    const result = await runNode(runner, ["--trace", tracePath], {
      OMNIDESK_AGENT_EVAL_API_BASE: `http://127.0.0.1:${server.address().port}/v1`,
      OMNIDESK_AGENT_EVAL_KEY: "secret-eval-key",
      OMNIDESK_AGENT_EVAL_MODEL: "test-model",
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(requestBody.tools[0].function.name, "start_engineering_task");
    assert.equal(requestBody.tool_choice.function.name, "start_engineering_task");
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    assert.equal(trace.response.argumentsValid, true);
    assert.equal(trace.response.providerRequestId, "eval-request");
    assert.deepEqual(trace.response.usage, {
      reported: true,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      costUsd: null,
      costReported: false,
    });
    assert.equal(JSON.stringify(trace).includes("secret-eval-key"), false);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps missing Provider cost unknown and rejects incomplete token usage", () => {
  assert.deepEqual(normalizeProviderUsage({ prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }), {
    reported: true,
    inputTokens: 3,
    outputTokens: 2,
    totalTokens: 5,
    costUsd: null,
    costReported: false,
  });
  assert.equal(normalizeProviderUsage({ prompt_tokens: 3 }).reported, false);
});

test("fails closed while retaining trace when Provider token usage is missing", async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      choices: [{
        finish_reason: "tool_calls",
        message: {
          content: null,
          tool_calls: [{
            id: "call-1",
            type: "function",
            function: { name: "start_engineering_task", arguments: "{\"task\":\"更新 README 命令\"}" },
          }],
        },
      }],
    }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-function-eval-usage-"));
  const tracePath = path.join(root, "trace.json");
  try {
    const result = await runNode(runner, ["--trace", tracePath], {
      OMNIDESK_AGENT_EVAL_API_BASE: `http://127.0.0.1:${server.address().port}/v1`,
      OMNIDESK_AGENT_EVAL_KEY: "secret-eval-key",
      OMNIDESK_AGENT_EVAL_MODEL: "test-model",
    });
    assert.notEqual(result.code, 0);
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    assert.equal(trace.response.argumentsValid, true);
    assert.equal(trace.response.usage.reported, false);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("requires real ACP usage in a successful metadata-only Run Timeline", () => {
  const result = {
    schemaVersion: "omnidesk.provider-timeline-runtime-result.v0.1",
    status: "passed",
    runStatus: "succeeded",
    scheduler: { statusDuringExecution: "running", activeCountAfter: 0, remainingEntriesAfter: 0 },
    usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12, source: "acp-response" },
    timeline: {
      schemaVersion: "omnidesk.run-timeline-export.v0.1",
      status: "succeeded",
      redaction: { policy: "metadata-only" },
      metrics: { modelEventCount: 1, inputTokens: 8, outputTokens: 4, totalTokens: 12 },
    },
  };
  assert.equal(validateProviderTimelineRuntimeResult(result).status, "passed");
  result.timeline.metrics.totalTokens = 0;
  assert.throws(() => validateProviderTimelineRuntimeResult(result), /totalTokens/);
});

test("requires one persisted fallback, a stream longer than 12 seconds, and retained partial text", () => {
  const result = {
    schemaVersion: "omnidesk.provider-fallback-runtime-result.v0.1",
    fallback: {
      responseMode: "compatibility-keyword",
      shouldCreatePlan: true,
      replyChars: 20,
      deltaEvents: 2,
      durationMs: 13_000,
    },
    capability: { mode: "compatibility-keyword", source: "explicit-tool-rejection" },
    interruption: { partialReplyChars: 7, deltaEvents: 1, errorPresent: true },
  };
  assert.equal(validateProviderFallbackRuntimeResult(result).fallback.durationMs, 13_000);
  result.fallback.durationMs = 11_999;
  assert.throws(() => validateProviderFallbackRuntimeResult(result), /longer than 12 seconds/);
  result.fallback.durationMs = 13_000;
  result.interruption.partialReplyChars = 0;
  assert.throws(() => validateProviderFallbackRuntimeResult(result), /partial text/);
});

test("fails closed while retaining trace when native tools are rejected", async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "tools are unsupported" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-function-eval-reject-"));
  const tracePath = path.join(root, "trace.json");
  try {
    const result = await runNode(runner, ["--trace", tracePath], {
      OMNIDESK_AGENT_EVAL_API_BASE: `http://127.0.0.1:${server.address().port}/v1`,
      OMNIDESK_AGENT_EVAL_KEY: "secret-eval-key",
      OMNIDESK_AGENT_EVAL_MODEL: "test-model",
    });
    assert.notEqual(result.code, 0);
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    assert.equal(trace.response.accepted, false);
    assert.equal(trace.response.httpStatus, 400);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function runNode(script, args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: desktopRoot,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });
}

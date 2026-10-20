import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProviderTimelineRuntimeResult, validateProviderReadonlyFileEvidence } from "../src/agent-runtime/provider-evaluation.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const tracePath = argument("--trace") ? path.resolve(argument("--trace")) : "";
const apiBase = String(process.env.OMNIDESK_AGENT_EVAL_API_BASE || "").trim();
const model = String(process.env.OMNIDESK_AGENT_EVAL_MODEL || "").trim();
const readonlyFiles = process.argv.includes("--readonly-files");
if (!tracePath) throw new Error("Provider Timeline Eval requires --trace");
if (!apiBase || !model || !String(process.env.OMNIDESK_AGENT_EVAL_KEY || "").trim()) {
  throw new Error("Provider Timeline Eval requires API base, key, and model environment values");
}

const startedAt = new Date().toISOString();
const started = Date.now();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-provider-timeline-"));
const appRoot = path.join(fixtureRoot, "runtime");
const projectRoot = path.join(fixtureRoot, "project");
fs.mkdirSync(appRoot, { recursive: true });
fs.mkdirSync(projectRoot, { recursive: true });
const marker = randomUUID();
const fixtureSource = `# Provider Timeline Eval\n\nRead-only fixture.\n${readonlyFiles ? `Acceptance marker: ${marker}\n` : ""}`;
fs.writeFileSync(path.join(projectRoot, "README.md"), fixtureSource);

let runtimeResult = null;
let failure = null;
try {
  const execution = await runRuntime({
    schemaVersion: "omnidesk.provider-timeline-eval-request.v0.1",
    appRoot,
    projectRoot,
    projectId: "provider-timeline-eval",
    prompt: readonlyFiles
      ? "Read README.md using the read_file tool, without changing any file. Return a final result whose summary contains the exact acceptance marker found in that file. The marker is not included in this prompt; do not guess it."
      : "Read the supplied project context without changing files, then return a final result with a one-sentence summary.",
    maxSteps: 3,
    readonlyFiles,
  });
  if (execution.code !== 0) throw new Error(execution.stderr || `Provider Timeline Runtime exited ${execution.code}`);
  runtimeResult = JSON.parse(execution.stdout.trim());
  if (readonlyFiles) {
    runtimeResult.readonlyFileEvidence = {
      fixturePath: "README.md",
      markerMatched: String(runtimeResult.summary || "").includes(marker),
      fixtureSourceUnchanged: fs.readFileSync(path.join(projectRoot, "README.md"), "utf8") === fixtureSource,
      projectEntriesUnchanged: JSON.stringify(fs.readdirSync(projectRoot).sort()) === JSON.stringify(["README.md"]),
    };
  }
  validateProviderTimelineRuntimeResult(runtimeResult);
  if (readonlyFiles) validateProviderReadonlyFileEvidence(runtimeResult);
} catch (error) {
  failure = redact(String(error instanceof Error ? error.message : error), fixtureRoot);
}

const trace = {
  schemaVersion: "omnidesk.provider-timeline-eval.v0.1",
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  status: failure ? "failed" : "passed",
  endpointHost: new URL(apiBase.replace(/\/+$/, "")).host,
  model,
  acceptanceMode: readonlyFiles ? "readonly-files" : "lifecycle",
  runtime: runtimeResult,
  error: failure,
};
fs.mkdirSync(path.dirname(tracePath), { recursive: true });
fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
fs.rmSync(fixtureRoot, { recursive: true, force: true });
if (failure) throw new Error(`Provider Timeline Eval failed; trace: ${tracePath}`);
process.stdout.write(`${JSON.stringify({ status: "passed", tracePath, model, durationMs: trace.durationMs })}\n`);

function runRuntime(request) {
  return new Promise((resolve) => {
    const child = spawn("cargo", [
      "run",
      "--quiet",
      "--manifest-path",
      path.join(desktopRoot, "src-tauri", "Cargo.toml"),
      "--bin",
      "omnidesk-provider-timeline-eval",
    ], { cwd: repositoryRoot, stdio: ["pipe", "pipe", "pipe"] });
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

function redact(value, root) {
  return String(value || "").split(root).join("<eval-root>").slice(0, 20_000);
}

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createToolGateway } from "../src/agent-runtime/index.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(desktopRoot, "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};

function providerStatePath() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".omnidesk", "namespace.json"), "utf8"));
    if (manifest?.activeNamespace === "omnidesk") return path.join(root, ".omnidesk", "data", "desktop-provider.json");
  } catch {
    // Legacy workspaces remain readable until their namespace is activated.
  }
  return path.join(root, ".project-os", "desktop-provider.json");
}

function readDotenvValue(key) {
  if (!key) return "";
  const dotenv = path.join(root, ".env.local");
  if (!fs.existsSync(dotenv)) return "";
  const line = fs.readFileSync(dotenv, "utf8").split(/\r?\n/).find((value) => {
    const trimmed = value.trimStart();
    return trimmed && !trimmed.startsWith("#") && trimmed.slice(0, trimmed.indexOf("=")).trim() === key;
  });
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "") : "";
}

function providerEnvironment() {
  const fallback = { apiKeyEnv: "", model: "" };
  let provider = fallback;
  try { provider = JSON.parse(fs.readFileSync(providerStatePath(), "utf8")); } catch { /* reported below */ }
  const configuredKeyName = String(provider.apiKeyEnv || "").trim();
  const keyName = String(process.env.OMNIDESK_AGENT_EVAL_API_KEY_ENV || configuredKeyName || "").trim();
  const apiKey = process.env[keyName] || readDotenvValue(keyName);
  if (!keyName || !apiKey) throw new Error("Agent Eval 找不到当前 Provider 的 Key；请先在桌面端配置可用模型。");
  return {
    env: { ...process.env, [keyName]: apiKey, ...(configuredKeyName ? { [configuredKeyName]: apiKey } : {}) },
    model: String(process.env.OMNIDESK_AGENT_EVAL_MODEL || provider.model || "").trim(),
    provider: "omnidesk-gateway",
  };
}

const patchCases = Object.freeze({
  "readme-copy": {
    files: { "README.md": "# Eval Fixture\n\nRun the project checks with:\n\n```sh\nnpm run old-check\n```\n" },
    prompt: "Return only a unified diff that changes README.md command `npm run old-check` to `npm test`. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      return fs.readFileSync(path.join(fixture, "README.md"), "utf8").includes("npm test");
    },
  },
  "json-schema-field": {
    files: { "schema.json": "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"title\": { \"type\": \"string\" }\n  },\n  \"required\": [\"title\"]\n}\n" },
    prompt: "Return only a unified diff that adds an optional `description` string property to schema.json. Keep title as the only required field. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const schema = JSON.parse(fs.readFileSync(path.join(fixture, "schema.json"), "utf8"));
      return schema.properties?.description?.type === "string" && Array.isArray(schema.required) && schema.required.length === 1 && schema.required[0] === "title";
    },
  },
  "react-copy": {
    files: { "EmptyState.jsx": "export function EmptyState() {\n  return <p>No projects yet.</p>;\n}\n" },
    prompt: "Return only a unified diff that changes the EmptyState JSX copy in EmptyState.jsx from `No projects yet.` to `No projects connected yet.`. Do not change code structure. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const content = fs.readFileSync(path.join(fixture, "EmptyState.jsx"), "utf8");
      return content.includes("No projects connected yet.") && !content.includes("No projects yet.");
    },
  },
  "css-token": {
    files: { "card.css": ".card {\n  gap: var(--space-4);\n}\n" },
    prompt: "Return only a unified diff that changes card.css so .card uses the existing token `var(--space-3)` for gap instead of `var(--space-4)`. Do not add tokens or change other declarations. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const content = fs.readFileSync(path.join(fixture, "card.css"), "utf8");
      return content.includes("gap: var(--space-3);") && !content.includes("var(--space-4)");
    },
  },
  "rust-guard": {
    files: { "guard.rs": "pub fn accepts(value: &str) -> bool {\n    !value.is_empty()\n}\n" },
    prompt: "Return only a unified diff that changes guard.rs so accepts rejects whitespace-only input as well as empty input. Keep the function signature and the exact parameter name `value` unchanged. The resulting predicate must evaluate `!value.trim().is_empty()`. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      return fs.readFileSync(path.join(fixture, "guard.rs"), "utf8").includes("!value.trim().is_empty()");
    },
    check(fixture) {
      const compile = spawnSync("rustc", ["--crate-type=lib", "guard.rs", "-o", "guard.rlib"], { cwd: fixture, encoding: "utf8" });
      if (compile.status !== 0) return compile;
      const harness = path.join(fixture, "guard-eval.rs");
      fs.writeFileSync(harness, "mod guard;\nfn main() {\n  assert!(guard::accepts(\"value\"));\n  assert!(!guard::accepts(\"\"));\n  assert!(!guard::accepts(\"  \\t\\n\"));\n}\n");
      const binary = path.join(fixture, "guard-eval");
      const harnessCompile = spawnSync("rustc", ["guard-eval.rs", "-o", binary], { cwd: fixture, encoding: "utf8" });
      return harnessCompile.status === 0
        ? spawnSync(binary, [], { cwd: fixture, encoding: "utf8" })
        : harnessCompile;
    },
  },
  "test-regression": {
    files: { "state.test.mjs": "import assert from \"node:assert/strict\";\nimport test from \"node:test\";\n\nfunction recover(state) {\n  return state === \"running\" ? \"interrupted\" : state;\n}\n\ntest(\"recovers running state\", () => {\n  assert.equal(recover(\"running\"), \"interrupted\");\n});\n" },
    prompt: "Return only a unified diff that adds a node:test regression in state.test.mjs proving recover preserves the `waiting-approval` state. Keep existing test unchanged. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      return fs.readFileSync(path.join(fixture, "state.test.mjs"), "utf8").includes('recover("waiting-approval"), "waiting-approval"');
    },
    check(fixture) {
      return spawnSync(process.execPath, ["--test", "state.test.mjs"], { cwd: fixture, encoding: "utf8" });
    },
  },
  "goal-rebind": {
    files: {
      "task.json": "{\n  \"id\": \"task-1\",\n  \"goalId\": \"goal-old\",\n  \"goalTitle\": \"Old goal\"\n}\n",
      "goals.json": "{\n  \"goals\": [\n    { \"id\": \"goal-old\", \"title\": \"Old goal\", \"taskIds\": [\"task-1\"] },\n    { \"id\": \"goal-new\", \"title\": \"New goal\", \"taskIds\": [] }\n  ]\n}\n",
    },
    prompt: "Return only unified diffs that rebind task.json task-1 from goal-old to goal-new. Update task.json goalId and goalTitle, remove task-1 from goal-old taskIds, and add task-1 to goal-new taskIds in goals.json. Do not modify any other data. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const task = JSON.parse(fs.readFileSync(path.join(fixture, "task.json"), "utf8"));
      const goals = JSON.parse(fs.readFileSync(path.join(fixture, "goals.json"), "utf8")).goals;
      const oldGoal = goals.find((goal) => goal.id === "goal-old");
      const newGoal = goals.find((goal) => goal.id === "goal-new");
      return task.goalId === "goal-new" && task.goalTitle === "New goal" && !oldGoal.taskIds.includes("task-1") && newGoal.taskIds.includes("task-1");
    },
  },
  "conversation-archive": {
    files: { "conversation.json": "{\n  \"id\": \"conversation-1\",\n  \"taskId\": \"task-1\",\n  \"status\": \"active\",\n  \"turns\": [{ \"role\": \"user\", \"content\": \"continue\" }]\n}\n" },
    prompt: "Return only a unified diff that archives conversation.json while keeping it recoverable. Set status to `archived`, add an `archivedAt` ISO timestamp placeholder `2026-07-19T00:00:00.000Z`, and add `recoverable: true`. Keep id, taskId, and turns unchanged. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const conversation = JSON.parse(fs.readFileSync(path.join(fixture, "conversation.json"), "utf8"));
      return conversation.status === "archived" && conversation.archivedAt === "2026-07-19T00:00:00.000Z" && conversation.recoverable === true && conversation.id === "conversation-1" && conversation.taskId === "task-1" && conversation.turns?.length === 1;
    },
  },
  "provider-validation": {
    files: { "provider.js": "export function isValidBaseUrl(value) {\n  return Boolean(value);\n}\n" },
    prompt: "Return only a unified diff that makes isValidBaseUrl in provider.js accept only non-empty HTTPS URLs. Keep the export and function signature unchanged. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const content = fs.readFileSync(path.join(fixture, "provider.js"), "utf8");
      return content.includes("new URL") && (content.includes("https://") || content.includes("https:"));
    },
    check(fixture) {
      return spawnSync(process.execPath, ["--check", "provider.js"], { cwd: fixture, encoding: "utf8" });
    },
  },
  "failed-check-repair": {
    files: {
      "math.js": "export function add(left, right) {\n  return left - right;\n}\n",
      "math.test.mjs": "import assert from \"node:assert/strict\";\nimport test from \"node:test\";\nimport { add } from \"./math.js\";\n\ntest(\"adds two values\", () => {\n  assert.equal(add(2, 3), 5);\n});\n",
    },
    prompt: "The check `node --test math.test.mjs` fails because add should add values. Return only a unified diff that repairs math.js so the existing test passes. Do not modify the test. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      return fs.readFileSync(path.join(fixture, "math.js"), "utf8").includes("return left + right;");
    },
    check(fixture) {
      return spawnSync(process.execPath, ["--test", "math.test.mjs"], { cwd: fixture, encoding: "utf8" });
    },
  },
});

function seedFixture(caseId, definition) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), `omnidesk-eval-${caseId}-`));
  for (const [file, content] of Object.entries(definition.files)) fs.writeFileSync(path.join(fixture, file), content);
  execFileSync("git", ["init", "-q"], { cwd: fixture });
  execFileSync("git", ["add", "."], { cwd: fixture });
  execFileSync("git", ["-c", "user.name=OmniDesk Eval", "-c", "user.email=eval@omnidesk.local", "commit", "-qm", "seed fixture"], { cwd: fixture });
  return fixture;
}

function runGit(fixture, args, input = "") {
  return spawnSync("git", args, { cwd: fixture, encoding: "utf8", input });
}

function normalizeWithDesktopRuntime(diff, contexts) {
  const manifestPath = path.join(desktopRoot, "src-tauri", "Cargo.toml");
  const process = spawnSync(
    "cargo",
    ["run", "--quiet", "--manifest-path", manifestPath, "--bin", "omnidesk-patch-normalizer"],
    {
      cwd: desktopRoot,
      encoding: "utf8",
      input: JSON.stringify({ diff, contexts }),
      timeout: 90_000,
    },
  );
  if (process.status !== 0) {
    return {
      ok: false,
      error: String(process.stderr || process.stdout || "桌面端补丁规范化失败").trim(),
    };
  }
  try {
    const response = JSON.parse(String(process.stdout || ""));
    if (!String(response.normalizedDiff || "").trim()) throw new Error("响应缺少 normalizedDiff");
    return { ok: true, diff: response.normalizedDiff };
  } catch (error) {
    return { ok: false, error: `桌面端补丁规范化响应无效：${error instanceof Error ? error.message : String(error)}` };
  }
}

async function runPatchCase(caseId, definition) {
  const started = Date.now();
  const fixture = seedFixture(caseId, definition);
  const rawOutputPath = path.join(fixture, "raw-model-output.txt");
  const usagePath = path.join(fixture, "usage.json");
  const tracePath = path.join(fixture, "trace.json");
  const contextText = Object.entries(definition.files)
    .map(([file, content]) => `\n--- AUTHORIZED FILE: ${file} ---\n${content}`)
    .join("\n");
  const prompt = `${definition.prompt}\n\nThe following is the complete authorized file context. Use it exactly; do not invent lines or paths:${contextText}`;
  const provider = providerEnvironment();
  const model = spawnSync("hermes", ["--provider", provider.provider, "--model", provider.model, "-z", prompt, "--usage-file", usagePath], {
    cwd: fixture,
    encoding: "utf8",
    env: provider.env,
    timeout: 90_000,
  });
  const raw = String(model.stdout || "").trim();
  fs.writeFileSync(rawOutputPath, `${raw}\n`);
  const rawDiff = raw.endsWith("\n") ? raw : `${raw}\n`;
  const contexts = Object.keys(definition.files).map((file) => ({ path: file, content: fs.readFileSync(path.join(fixture, file), "utf8") }));
  const rawApplyCheck = model.status === 0 && raw ? runGit(fixture, ["apply", "--check"], rawDiff) : { status: 1, stderr: "模型未返回补丁。" };
  const normalization = model.status === 0 && raw ? normalizeWithDesktopRuntime(rawDiff, contexts) : { ok: false, error: "模型未返回补丁。" };
  const diff = normalization.ok ? normalization.diff : "";
  let applied = false;
  let approvalCount = 0;
  let applyResult = { status: "not-requested", stderr: "" };
  if (model.status === 0 && raw && normalization.ok) {
    const gateway = createToolGateway({
      accessMode: "controlled",
      projectRoot: fixture,
      handlers: {
        apply_patch: async ({ arguments: input }) => {
          const check = runGit(fixture, ["apply", "--check"], input.diff);
          if (check.status !== 0) throw new Error(String(check.stderr || check.stdout || "git apply --check failed").trim());
          const apply = runGit(fixture, ["apply"], input.diff);
          if (apply.status !== 0) throw new Error(String(apply.stderr || apply.stdout || "git apply failed").trim());
          applied = true;
          return { summary: "Patch 已应用。" };
        },
      },
    });
    const prepared = gateway.prepare({ arguments: { diff }, id: `eval-${caseId}:apply`, name: "apply_patch", requestedAt: new Date().toISOString(), runId: `eval-${caseId}` });
    if (prepared.status === "awaiting-approval") {
      approvalCount = 1;
      try {
        const executed = await awaitGateway(gateway, prepared);
        applyResult = executed;
      } catch (error) {
        applyResult = { status: "failed", stderr: error instanceof Error ? error.message : String(error) };
      }
    } else {
      applyResult = { status: prepared.status, stderr: prepared.reason || "Patch 未进入审批。" };
    }
  }
  const gitDiffCheck = applied ? runGit(fixture, ["diff", "--check"]) : { status: 1, stderr: "Patch 未应用。" };
  let fixtureCheckPassed = false;
  let fixtureCheckError = "";
  if (applied && gitDiffCheck.status === 0) {
    try {
      const commandCheck = definition.check ? definition.check(fixture) : { status: 0, stderr: "" };
      if (commandCheck.status !== 0) fixtureCheckError = String(commandCheck.stderr || commandCheck.stdout || "case check failed").trim();
      else fixtureCheckPassed = definition.verify(fixture);
    } catch (error) {
      fixtureCheckError = error instanceof Error ? error.message : String(error);
    }
  }
  let usage = {};
  try { usage = JSON.parse(fs.readFileSync(usagePath, "utf8")); } catch { /* evidence is still recorded */ }
  const trace = {
    caseId,
    fixture,
    prompt,
    model: { exitCode: model.status, signal: model.signal, stderr: String(model.stderr || "").slice(0, 4000) },
    rawOutputPath,
    usagePath,
    rawPatchApplicable: rawApplyCheck.status === 0,
    normalizedPatchApplicable: normalization.ok && applyResult.status === "completed",
    normalization: normalization.ok ? { status: "normalized", normalizedDiff: diff } : { status: "rejected", error: normalization.error },
    applyResult,
    gitDiffCheck: { exitCode: gitDiffCheck.status, stderr: String(gitDiffCheck.stderr || "").slice(0, 4000) },
    fixtureCheckPassed,
    fixtureCheckError,
    usage: { apiCalls: Number(usage.api_calls || 0), completed: Boolean(usage.completed), estimatedCostUsd: Number(usage.estimated_cost_usd || 0), model: String(usage.model || "") },
  };
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  return {
    caseId,
    success: model.status === 0 && fixtureCheckPassed,
    patchApplicable: normalization.ok && applyResult.status === "completed",
    rawPatchApplicable: rawApplyCheck.status === 0,
    normalizedPatchApplicable: normalization.ok && applyResult.status === "completed",
    checksPassed: fixtureCheckPassed,
    recovered: false,
    approvalCount,
    durationMs: Date.now() - started,
    costUsd: Number(usage.estimated_cost_usd || 0),
    execution: { executor: "hermes-cli", fixture, executedAt: new Date().toISOString(), tracePath },
  };
}

async function awaitGateway(gateway, prepared) {
  const result = await gateway.execute(prepared, { approval: { status: "approved", token: prepared.approval.token, toolCallId: prepared.toolCall.id } });
  if (!result.observation.success) throw new Error(result.observation.summary);
  return { status: result.toolCall.status, stderr: "" };
}

const caseId = argument("--case") || "readme-copy";
const outputPath = path.resolve(argument("--output") || path.join(os.tmpdir(), "omnidesk-agent-eval-hermes-results.json"));
const definition = patchCases[caseId];
if (!definition) throw new Error(`当前 runner 尚未实现 case：${caseId}`);
const result = await runPatchCase(caseId, definition);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ results: [result] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath, result })}\n`);

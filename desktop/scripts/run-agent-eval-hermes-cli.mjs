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
  return path.join(root, ".omnidesk", "data", "desktop-provider.json");
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
    prompt: "Return only a unified diff that adds a node:test regression in state.test.mjs proving recover preserves the `waiting-approval` state. Keep existing test unchanged. Your hunk must include at least the existing `test(\"recovers running state\"` block as unchanged context before the added test; do not emit an add-only hunk. Do not use tools, do not explain, and do not use markdown fences.",
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
      "task-index.json": "{\n  \"taskToGoal\": { \"task-1\": \"goal-old\" },\n  \"goalToTasks\": { \"goal-old\": [\"task-1\"], \"goal-new\": [] }\n}\n",
      "goal-audit.json": "{\n  \"entries\": [{ \"taskId\": \"task-1\", \"goalId\": \"goal-old\", \"goalTitle\": \"Old goal\", \"event\": \"bound\" }]\n}\n",
    },
    minimumChangedFiles: 4,
    prompt: "Return only unified diffs that rebind task-1 from goal-old / Old goal to goal-new / New goal consistently in all four authorized files. In task.json update goalId and goalTitle. In goals.json remove task-1 from goal-old taskIds and add it to goal-new taskIds. In task-index.json update taskToGoal.task-1, remove task-1 from goalToTasks.goal-old, and add it to goalToTasks.goal-new. In goal-audit.json update the only entry's goalId, goalTitle, and event to `rebound`. Do not modify any other data. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      const task = JSON.parse(fs.readFileSync(path.join(fixture, "task.json"), "utf8"));
      const goals = JSON.parse(fs.readFileSync(path.join(fixture, "goals.json"), "utf8")).goals;
      const index = JSON.parse(fs.readFileSync(path.join(fixture, "task-index.json"), "utf8"));
      const audit = JSON.parse(fs.readFileSync(path.join(fixture, "goal-audit.json"), "utf8")).entries?.[0];
      const oldGoal = goals.find((goal) => goal.id === "goal-old");
      const newGoal = goals.find((goal) => goal.id === "goal-new");
      return task.goalId === "goal-new" && task.goalTitle === "New goal"
        && !oldGoal.taskIds.includes("task-1") && newGoal.taskIds.includes("task-1")
        && index.taskToGoal?.["task-1"] === "goal-new"
        && !index.goalToTasks?.["goal-old"]?.includes("task-1")
        && index.goalToTasks?.["goal-new"]?.includes("task-1")
        && audit?.taskId === "task-1" && audit?.goalId === "goal-new"
        && audit?.goalTitle === "New goal" && audit?.event === "rebound";
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
  "ask-user-resume": {
    files: { "settings.js": "export const density = \"comfortable\";\n" },
    prompt: "The requested interface density is missing, so you must ask the user before editing. Return only one JSON object with type `tool_call`, name `ask_user`, and arguments containing title, description, fields, and actions. Use exactly one required `single-choice` field with id `density` and options `compact` and `comfortable`. Do not return a patch yet, do not use tools, and do not explain.",
    interaction: {
      response: { action: "submit", answers: { density: "compact" } },
      followup: "The user selected `compact`. Continue the same task and return only a unified diff that changes settings.js density from `comfortable` to `compact`. Do not use tools, do not explain, and do not use markdown fences.",
    },
    verify(fixture) {
      return fs.readFileSync(path.join(fixture, "settings.js"), "utf8").includes('density = "compact"');
    },
    check(fixture) {
      return spawnSync(process.execPath, ["--check", "settings.js"], { cwd: fixture, encoding: "utf8" });
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
  "isolated-worktree": {
    isolated: true,
    files: { "feature.js": "export function label() {\n  return \"before\";\n}\n" },
    prompt: "Return only a unified diff that changes feature.js so label returns `after`. Do not change the function signature. Do not use tools, do not explain, and do not use markdown fences.",
    verify(fixture) {
      return fs.readFileSync(path.join(fixture, "feature.js"), "utf8").includes('return "after";');
    },
    check(fixture) {
      return spawnSync(process.execPath, ["--check", "feature.js"], { cwd: fixture, encoding: "utf8" });
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

function createIsolatedFixture(caseId, definition) {
  const source = seedFixture(caseId, definition);
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), `omnidesk-eval-${caseId}-worktree-`));
  fs.rmSync(worktree, { force: true, recursive: true });
  const baseHead = String(runGit(source, ["rev-parse", "HEAD"]).stdout || "").trim();
  const created = runGit(source, ["worktree", "add", "--detach", worktree, baseHead]);
  if (created.status !== 0) throw new Error(String(created.stderr || created.stdout || "无法创建隔离工作区").trim());
  return { source, worktree, baseHead };
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
  const isolation = definition.isolated ? createIsolatedFixture(caseId, definition) : null;
  const fixture = isolation?.worktree || seedFixture(caseId, definition);
  // A detached worktree is deleted after integration. Its source must remain
  // clean until merge, so keep isolated-case evidence outside both trees.
  const evidenceFixture = isolation
    ? fs.mkdtempSync(path.join(os.tmpdir(), `omnidesk-eval-${caseId}-evidence-`))
    : fixture;
  const rawOutputPath = path.join(evidenceFixture, "raw-model-output.txt");
  const usagePath = path.join(evidenceFixture, "usage.json");
  const interactionOutputPath = path.join(evidenceFixture, "interaction-model-output.txt");
  const interactionUsagePath = path.join(evidenceFixture, "interaction-usage.json");
  const tracePath = path.join(evidenceFixture, "trace.json");
  const initialCheck = caseId === "failed-check-repair"
    ? summarizeFixtureCheck(definition.check(fixture))
    : null;
  const contextText = Object.entries(definition.files)
    .map(([file, content]) => `\n--- AUTHORIZED FILE: ${file} ---\n${content}`)
    .join("\n");
  const initialPrompt = `${definition.prompt}\n\nThe following is the complete authorized file context. Use it exactly; do not invent lines or paths:${contextText}`;
  const provider = providerEnvironment();
  let prompt = initialPrompt;
  let interactionEvidence = null;
  if (definition.interaction) {
    const interactionModel = spawnSync("hermes", ["--provider", provider.provider, "--model", provider.model, "-z", initialPrompt, "--usage-file", interactionUsagePath], {
      cwd: fixture,
      encoding: "utf8",
      env: provider.env,
      timeout: 90_000,
    });
    const interactionRaw = String(interactionModel.stdout || "").trim();
    fs.writeFileSync(interactionOutputPath, `${interactionRaw}\n`);
    const interaction = parseAskUserEnvelope(interactionRaw);
    const runId = `eval-${caseId}`;
    const checkpointPath = path.join(fixture, "agent-run-checkpoint.json");
    const checkpoint = interaction
      ? { runId, status: "awaiting-user-input", approval: null, interaction, response: definition.interaction.response }
      : null;
    if (checkpoint) fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
    interactionEvidence = {
      model: { exitCode: interactionModel.status, signal: interactionModel.signal, stderr: String(interactionModel.stderr || "").slice(0, 4000) },
      rawOutputPath: interactionOutputPath,
      usagePath: interactionUsagePath,
      checkpointPath,
      runId,
      status: checkpoint?.status || "invalid",
      interaction,
      response: definition.interaction.response,
      approvalCount: 0,
      persisted: Boolean(checkpoint && fs.existsSync(checkpointPath)),
    };
    prompt = `${definition.interaction.followup}\n\nPersisted ask_user result for the same Agent Run:\n${JSON.stringify({ runId, interactionId: interaction?.id || "", ...definition.interaction.response })}\n\nThe following is the complete authorized file context. Use it exactly; do not invent lines or paths:${contextText}`;
  }
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
  const authorizedFiles = contexts.map((context) => context.path);
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
  const changedFiles = applied
    ? String(runGit(fixture, ["diff", "--name-only"]).stdout || "").split(/\r?\n/).filter(Boolean)
    : [];
  const changedFilesAuthorized = changedFiles.every((file) => authorizedFiles.includes(file));
  const requiredChangedFileCount = Number(definition.minimumChangedFiles || 1);
  const changedRequiredFiles = changedFiles.length >= requiredChangedFileCount;
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
  let integration = null;
  if (isolation && applied && fixtureCheckPassed) {
    const approvedDiff = String(runGit(fixture, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"]).stdout || "");
    const sourceStatus = runGit(isolation.source, ["status", "--porcelain", "--untracked-files=normal"]);
    const currentDiff = String(runGit(fixture, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"]).stdout || "");
    const canIntegrate = sourceStatus.status === 0 && !String(sourceStatus.stdout || "").trim() && approvedDiff && approvedDiff === currentDiff;
    const integrationGateway = createToolGateway({
      accessMode: "controlled",
      projectRoot: isolation.source,
      handlers: {
        apply_patch: async ({ arguments: input }) => {
          const check = runGit(isolation.source, ["apply", "--check"], input.diff);
          if (check.status !== 0) throw new Error(String(check.stderr || check.stdout || "git apply --check failed").trim());
          const apply = runGit(isolation.source, ["apply"], input.diff);
          if (apply.status !== 0) throw new Error(String(apply.stderr || apply.stdout || "git apply failed").trim());
          return { summary: "隔离改动已合并。" };
        },
      },
    });
    let integrationResult = { status: "not-requested", stderr: "" };
    if (canIntegrate) {
      const prepared = integrationGateway.prepare({ arguments: { diff: approvedDiff }, id: `eval-${caseId}:integrate`, name: "apply_patch", requestedAt: new Date().toISOString(), runId: `eval-${caseId}` });
      if (prepared.status === "awaiting-approval") {
        approvalCount += 1;
        try { integrationResult = await awaitGateway(integrationGateway, prepared); }
        catch (error) { integrationResult = { status: "failed", stderr: error instanceof Error ? error.message : String(error) }; }
      } else integrationResult = { status: prepared.status, stderr: prepared.reason || "集成未进入审批。" };
    }
    const sourceVerified = integrationResult.status === "completed" && definition.verify(isolation.source);
    integration = {
      sourceRoot: isolation.source,
      worktreeRoot: isolation.worktree,
      baseHead: isolation.baseHead,
      sourceCleanBeforeIntegration: sourceStatus.status === 0 && !String(sourceStatus.stdout || "").trim(),
      approvedDiffMatchesWorktree: Boolean(approvedDiff && approvedDiff === currentDiff),
      approvalRequired: true,
      result: integrationResult,
      sourceVerified,
    };
    const removed = runGit(isolation.source, ["worktree", "remove", "--force", isolation.worktree]);
    integration.worktreeRemoved = removed.status === 0 && !fs.existsSync(isolation.worktree);
  }
  let usage = {};
  try { usage = JSON.parse(fs.readFileSync(usagePath, "utf8")); } catch { /* evidence is still recorded */ }
  const trace = {
    caseId,
    fixture,
    prompt,
    initialPrompt,
    interaction: interactionEvidence,
    model: { exitCode: model.status, signal: model.signal, stderr: String(model.stderr || "").slice(0, 4000) },
    rawOutputPath,
    usagePath,
    rawPatchApplicable: rawApplyCheck.status === 0,
    normalizedPatchApplicable: normalization.ok && applyResult.status === "completed",
    normalization: normalization.ok ? { status: "normalized", normalizedDiff: diff } : { status: "rejected", error: normalization.error },
    applyResult,
    initialCheck,
    authorizedFiles,
    changedFiles,
    changedFilesAuthorized,
    requiredChangedFileCount,
    changedRequiredFiles,
    gitDiffCheck: { exitCode: gitDiffCheck.status, stderr: String(gitDiffCheck.stderr || "").slice(0, 4000) },
    fixtureCheckPassed,
    fixtureCheckError,
    isolation: integration,
    usage: { apiCalls: Number(usage.api_calls || 0), completed: Boolean(usage.completed), estimatedCostUsd: Number(usage.estimated_cost_usd || 0), model: String(usage.model || "") },
  };
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  return {
    caseId,
    success: model.status === 0 && fixtureCheckPassed && changedFilesAuthorized && changedRequiredFiles && (!initialCheck || !initialCheck.success)
      && (!definition.isolated || (integration?.result?.status === "completed" && integration.sourceVerified && integration.worktreeRemoved))
      && (!definition.interaction || (interactionEvidence?.persisted === true && interactionEvidence?.status === "awaiting-user-input" && interactionEvidence?.approvalCount === 0)),
    patchApplicable: normalization.ok && applyResult.status === "completed",
    rawPatchApplicable: rawApplyCheck.status === 0,
    normalizedPatchApplicable: normalization.ok && applyResult.status === "completed",
    checksPassed: fixtureCheckPassed,
    recovered: Boolean(definition.interaction),
    approvalCount,
    durationMs: Date.now() - started,
    costUsd: Number(usage.estimated_cost_usd || 0),
    execution: { executor: "hermes-cli", fixture, executedAt: new Date().toISOString(), tracePath },
  };
}

function parseAskUserEnvelope(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let envelope;
  try { envelope = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (envelope?.type !== "tool_call" || envelope?.name !== "ask_user") return null;
  const fields = envelope.arguments?.fields;
  if (!Array.isArray(fields) || fields.length !== 1) return null;
  const field = fields[0];
  const options = Array.isArray(field?.options) ? field.options.map((item) => typeof item === "string" ? item : item?.value) : [];
  if (field?.id !== "density" || field?.type !== "single-choice" || field?.required !== true
    || !options.includes("compact") || !options.includes("comfortable")) return null;
  return {
    id: "ask-user-resume:1",
    kind: "ask_user",
    title: String(envelope.arguments?.title || ""),
    description: String(envelope.arguments?.description || ""),
    fields,
    actions: Array.isArray(envelope.arguments?.actions) ? envelope.arguments.actions : [],
  };
}

function summarizeFixtureCheck(result) {
  return {
    exitCode: Number.isInteger(result?.status) ? result.status : null,
    output: String(result?.stderr || result?.stdout || "").trim().slice(0, 4000),
    success: result?.status === 0,
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

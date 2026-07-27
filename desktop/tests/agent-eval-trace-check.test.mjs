import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { boundedPatchRetryPrompt, requiredFileCoverage } from "../scripts/run-agent-eval-hermes-cli.mjs";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const checker = path.join(desktopRoot, "scripts", "check-agent-eval-traces.mjs");

function writeFixture(root, traceOverrides = {}) {
  const traces = path.join(root, "traces");
  fs.mkdirSync(traces, { recursive: true });
  const results = [
    { caseId: "failed-check-repair", execution: { tracePath: "/ignored" } },
    { caseId: "goal-rebind", execution: { tracePath: "/ignored" } },
    { caseId: "interrupted-run", execution: { tracePath: "/ignored" } },
    { caseId: "ask-user-resume", execution: { tracePath: "/ignored" } },
    { caseId: "isolated-worktree", execution: { tracePath: "/ignored" } },
  ];
  fs.writeFileSync(path.join(root, "results.json"), JSON.stringify({ results }));
  fs.writeFileSync(path.join(traces, "failed-check-repair.trace.json"), JSON.stringify({ initialCheck: { exitCode: 1, success: false }, ...traceOverrides.failed }));
  fs.writeFileSync(path.join(traces, "goal-rebind.trace.json"), JSON.stringify({
    authorizedFiles: ["task.json", "goals.json", "task-index.json", "goal-audit.json"],
    changedFiles: ["task.json", "goals.json", "task-index.json", "goal-audit.json"],
    changedFilesAuthorized: true,
    changedRequiredFiles: true,
    requiredFiles: ["task.json", "goals.json", "task-index.json", "goal-audit.json"],
    missingRequiredFiles: [],
    draftAttempts: 1,
    attempts: [{ acceptedForApproval: true, attempt: 1, missingRequiredFiles: [] }],
    ...traceOverrides.goal,
  }));
  fs.writeFileSync(path.join(traces, "interrupted-run.trace.json"), JSON.stringify({
    networkInterruption: { classification: "network-unavailable", providerResponseAccepted: false },
    interrupted: { status: "interrupted" },
    resumed: { status: "awaiting-approval" },
    ...traceOverrides.interrupted,
  }));
  fs.writeFileSync(path.join(traces, "ask-user-resume.trace.json"), JSON.stringify({
    interaction: {
      status: "awaiting-user-input",
      persisted: true,
      approvalCount: 0,
      interaction: { kind: "ask_user" },
      response: { answers: { density: "compact" } },
    },
    applyResult: { status: "completed" },
    ...traceOverrides.askUser,
  }));
  fs.writeFileSync(path.join(traces, "isolated-worktree.trace.json"), JSON.stringify({
    isolation: {
      sourceCleanBeforeIntegration: true,
      approvedDiffMatchesWorktree: true,
      approvalRequired: true,
      result: { status: "completed" },
      sourceVerified: true,
      worktreeRemoved: true,
    },
    ...traceOverrides.isolated,
  }));
  return { results: path.join(root, "results.json"), traces };
}

test("requires failure and authorization evidence for real repair and multi-file traces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-eval-trace-contract-"));
  try {
    const fixture = writeFixture(root);
    execFileSync(process.execPath, [checker, "--results", fixture.results, "--trace-dir", fixture.traces], { stdio: "pipe" });

    const invalid = writeFixture(path.join(root, "invalid"), { goal: { changedFiles: ["task.json"], changedRequiredFiles: false } });
    assert.throws(
      () => execFileSync(process.execPath, [checker, "--results", invalid.results, "--trace-dir", invalid.traces], { stdio: "pipe" }),
      /Agent Eval trace evidence invalid/,
    );

    const invalidNetwork = writeFixture(path.join(root, "invalid-network"), { interrupted: { networkInterruption: { classification: "unavailable", providerResponseAccepted: false } } });
    assert.throws(
      () => execFileSync(process.execPath, [checker, "--results", invalidNetwork.results, "--trace-dir", invalidNetwork.traces], { stdio: "pipe" }),
      /Agent Eval trace evidence invalid/,
    );

    const invalidInteraction = writeFixture(path.join(root, "invalid-interaction"), { askUser: { interaction: { status: "awaiting-user-input", persisted: true, approvalCount: 1, interaction: { kind: "ask_user" }, response: { answers: { density: "compact" } } } } });
    assert.throws(
      () => execFileSync(process.execPath, [checker, "--results", invalidInteraction.results, "--trace-dir", invalidInteraction.traces], { stdio: "pipe" }),
      /Agent Eval trace evidence invalid/,
    );

    const invalidIsolation = writeFixture(path.join(root, "invalid-isolation"), { isolated: { isolation: { sourceCleanBeforeIntegration: true, approvedDiffMatchesWorktree: false, approvalRequired: true, result: { status: "completed" }, sourceVerified: true, worktreeRemoved: true } } });
    assert.throws(
      () => execFileSync(process.execPath, [checker, "--results", invalidIsolation.results, "--trace-dir", invalidIsolation.traces], { stdio: "pipe" }),
      /Agent Eval trace evidence invalid/,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("multi-file eval coverage requests one complete replacement without widening scope", () => {
  const required = ["task.json", "goals.json", "task-index.json", "goal-audit.json"];
  const partial = "--- a/task.json\n+++ b/task.json\n@@ -1 +1 @@\n-old\n+new\n--- a/goals.json\n+++ b/goals.json\n@@ -1 +1 @@\n-old\n+new\n";
  const coverage = requiredFileCoverage(partial, required);
  assert.equal(coverage.complete, false);
  assert.deepEqual(coverage.missingFiles, ["goal-audit.json", "task-index.json"]);
  assert.equal(requiredFileCoverage("--- a/task.json\n+++ b/task.json\n@@ -1 +1 @@\n-same\n+same\n", ["task.json"]).complete, false);

  const retry = boundedPatchRetryPrompt("ORIGINAL AUTHORIZED PROMPT", "missing task-index.json", required);
  assert.match(retry, /complete replacement unified diff/);
  assert.match(retry, /task-index\.json/);
  assert.match(retry, /same authorized file scope/);
});

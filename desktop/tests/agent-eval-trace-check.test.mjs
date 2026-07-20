import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const checker = path.join(desktopRoot, "scripts", "check-agent-eval-traces.mjs");

function writeFixture(root, traceOverrides = {}) {
  const traces = path.join(root, "traces");
  fs.mkdirSync(traces, { recursive: true });
  const results = [
    { caseId: "failed-check-repair", execution: { tracePath: "/ignored" } },
    { caseId: "goal-rebind", execution: { tracePath: "/ignored" } },
    { caseId: "interrupted-run", execution: { tracePath: "/ignored" } },
  ];
  fs.writeFileSync(path.join(root, "results.json"), JSON.stringify({ results }));
  fs.writeFileSync(path.join(traces, "failed-check-repair.trace.json"), JSON.stringify({ initialCheck: { exitCode: 1, success: false }, ...traceOverrides.failed }));
  fs.writeFileSync(path.join(traces, "goal-rebind.trace.json"), JSON.stringify({
    authorizedFiles: ["task.json", "goals.json", "task-index.json", "goal-audit.json"],
    changedFiles: ["task.json", "goals.json", "task-index.json", "goal-audit.json"],
    changedFilesAuthorized: true,
    changedRequiredFiles: true,
    ...traceOverrides.goal,
  }));
  fs.writeFileSync(path.join(traces, "interrupted-run.trace.json"), JSON.stringify({
    networkInterruption: { classification: "network-unavailable", providerResponseAccepted: false },
    interrupted: { status: "interrupted" },
    resumed: { status: "awaiting-approval" },
    ...traceOverrides.interrupted,
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
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

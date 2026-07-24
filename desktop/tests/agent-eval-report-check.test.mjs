import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const checker = path.join(desktopRoot, "scripts", "check-agent-eval-report.mjs");

function result(caseId) {
  return {
    caseId,
    success: true,
    patchApplicable: true,
    checksPassed: true,
    recovered: false,
    approvalCount: 1,
    durationMs: 1,
    costUsd: 0,
    execution: { executor: "hermes-cli", fixture: `/tmp/${caseId}`, executedAt: "2026-07-24T00:00:00Z", tracePath: `traces/${caseId}.json` },
  };
}

function report(ids) {
  return {
    schemaVersion: "omnidesk.agent-eval-report.v0.1",
    status: "complete",
    totals: { cases: ids.length, completed: ids.length, missing: 0 },
    metrics: { taskSuccessRate: 1, patchApplicableRate: 1, checkPassRate: 1, recoverySuccessRate: 1 },
    cases: ids.map((id) => ({ id, expected: ["patch", "check"], result: result(id) })),
  };
}

test("allows a candidate to add registered cases without dropping baseline cases", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-eval-report-check-"));
  try {
    const currentCases = JSON.parse(fs.readFileSync(path.join(desktopRoot, "evals", "agent-development-cases.json"), "utf8")).cases.map((item) => item.id);
    const baselinePath = path.join(root, "baseline.json");
    const candidatePath = path.join(root, "candidate.json");
    fs.writeFileSync(baselinePath, JSON.stringify(report(currentCases.slice(0, -1))));
    fs.writeFileSync(candidatePath, JSON.stringify(report(currentCases)));
    execFileSync(process.execPath, [checker, "--baseline", baselinePath, "--candidate", candidatePath], { cwd: desktopRoot, stdio: "pipe" });

    fs.writeFileSync(candidatePath, JSON.stringify(report(currentCases.slice(1))));
    assert.throws(
      () => execFileSync(process.execPath, [checker, "--baseline", baselinePath, "--candidate", candidatePath], { cwd: desktopRoot, stdio: "pipe" }),
      /缺少基线 case|缺少当前 case/,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

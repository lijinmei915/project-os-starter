import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("copies deterministic Eval evidence into the requested artifact directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-agent-eval-suite-"));
  const output = path.join(root, "results.json");
  const traceDirectory = path.join(root, "traces");
  try {
    execFileSync(
      process.execPath,
      ["scripts/run-agent-eval-suite.mjs", "--case", "unsafe-path", "--output", output, "--trace-dir", traceDirectory],
      { cwd: path.resolve(import.meta.dirname, ".."), stdio: "pipe" },
    );
    const result = JSON.parse(fs.readFileSync(output, "utf8")).results[0];
    assert.equal(result.caseId, "unsafe-path");
    assert.ok(fs.existsSync(path.join(traceDirectory, "unsafe-path.trace.json")));
    assert.equal(result.execution.tracePath, "traces/unsafe-path.trace.json");
    assert.equal(result.execution.tracePath.includes(os.tmpdir()), false);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test("rejects a real Provider Eval without an artifact trace directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-agent-eval-suite-required-artifact-"));
  try {
    assert.throws(
      () => execFileSync(
        process.execPath,
        ["scripts/run-agent-eval-suite.mjs", "--case", "unsafe-path", "--output", path.join(root, "results.json")],
        { cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, OMNIDESK_AGENT_EVAL_API_KEY_ENV: "OMNIDESK_TEST_KEY" }, stdio: "pipe" },
      ),
      (error) => String(error.stderr || error.message || "").includes("真实 Agent Eval 必须提供 --trace-dir"),
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

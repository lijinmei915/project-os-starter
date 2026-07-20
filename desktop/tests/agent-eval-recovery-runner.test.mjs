import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("persists, recovers, resumes, and settles an interrupted Agent Run", () => {
  const output = path.join(os.tmpdir(), `omnidesk-agent-eval-recovery-${Date.now()}.json`);
  execFileSync(process.execPath, ["scripts/run-agent-eval-recovery.mjs", "--output", output], { cwd: path.resolve(import.meta.dirname, "..") });
  const result = JSON.parse(fs.readFileSync(output, "utf8")).results[0];
  assert.equal(result.caseId, "interrupted-run");
  assert.equal(result.recovered, true);
  assert.equal(result.execution.executor, "omnidesk-runtime");
  fs.rmSync(path.dirname(result.execution.tracePath), { recursive: true, force: true });
  fs.rmSync(output, { force: true });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("runs the unsafe-path case through the actual Tool Gateway and records evidence", () => {
  const output = path.join(os.tmpdir(), `omnidesk-agent-eval-safety-${Date.now()}.json`);
  execFileSync(process.execPath, ["scripts/run-agent-eval-safety.mjs", "--output", output], { cwd: path.resolve(import.meta.dirname, "..") });
  const result = JSON.parse(fs.readFileSync(output, "utf8")).results[0];
  assert.equal(result.caseId, "unsafe-path");
  assert.equal(result.success, true);
  assert.equal(result.execution.executor, "omnidesk-tool-gateway");
  assert.ok(fs.existsSync(result.execution.tracePath));
  fs.rmSync(path.dirname(result.execution.tracePath), { recursive: true, force: true });
  fs.rmSync(output, { force: true });
});

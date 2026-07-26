import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildArtifactIndex } from "../scripts/build-agent-eval-artifact-index.mjs";

test("builds a deterministic hash index across independent Eval slices", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-eval-index-"));
  fs.mkdirSync(path.join(root, "agent-eval-p1", "traces"), { recursive: true });
  fs.mkdirSync(path.join(root, "agent-eval-suite"), { recursive: true });
  fs.writeFileSync(path.join(root, "agent-eval-p1", "traces", "function.json"), "function\n");
  fs.writeFileSync(path.join(root, "agent-eval-suite", "report.json"), "suite\n");

  const index = buildArtifactIndex({ commit: "abc123", root, runId: "42" });

  assert.equal(index.schemaVersion, "omnidesk.agent-eval-artifact-index.v0.1");
  assert.deepEqual(index.slices, ["p1", "suite"]);
  assert.deepEqual(index.files.map(({ path: file }) => file), ["p1/traces/function.json", "suite/report.json"]);
  assert.deepEqual(index.files.map(({ slice }) => slice), ["p1", "suite"]);
  assert.match(index.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(index.files[0].bytes, 9);
});

test("rejects empty evidence and unregistered Eval slices", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-eval-index-empty-"));
  assert.throws(() => buildArtifactIndex({ commit: "abc123", root: empty, runId: "42" }), /cannot be empty/);

  const unknown = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-eval-index-unknown-"));
  fs.mkdirSync(path.join(unknown, "agent-eval-other"));
  fs.writeFileSync(path.join(unknown, "agent-eval-other", "trace.json"), "{}\n");
  assert.throws(() => buildArtifactIndex({ commit: "abc123", root: unknown, runId: "42" }), /Unknown Agent Eval slice/);
});

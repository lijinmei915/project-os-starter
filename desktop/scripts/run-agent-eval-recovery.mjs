import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAgentRun, recoverAgentRun, resumeAgentRun, serializeAgentRun, settleAgentRun, transitionAgentRun } from "../src/agent-runtime/index.js";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};

const started = Date.now();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-eval-interrupted-run-"));
const persistedPath = path.join(fixture, "agent-run.json");
const tracePath = path.join(fixture, "trace.json");
const created = createAgentRun({
  id: "eval-interrupted-run",
  requestId: "request-1",
  projectId: "fixture-project",
  executorId: "omnidesk-runtime",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
});
const running = transitionAgentRun(created, "running", "2026-07-19T00:00:01.000Z");
const applying = Object.freeze({
  ...transitionAgentRun(running, "awaiting-approval", "2026-07-19T00:00:01.500Z"),
  approval: { token: "approval-1", name: "apply_patch", status: "approved", arguments: { allowedFiles: ["src/math.js", "src/math.test.js"] } },
  checkpoint: {
    ...running.checkpoint,
    phase: "applying",
    nextAction: "resume-apply-approval",
    toolName: "apply_patch",
    toolArguments: { allowedFiles: ["src/math.js", "src/math.test.js"] },
    allowedFiles: ["src/math.js", "src/math.test.js"],
    remainingRepairBudget: 1,
  },
  status: "applying",
});
fs.writeFileSync(persistedPath, serializeAgentRun(applying));
const restored = JSON.parse(fs.readFileSync(persistedPath, "utf8"));
const interrupted = recoverAgentRun(restored, "2026-07-19T00:00:02.000Z");
const resumed = resumeAgentRun(interrupted, "2026-07-19T00:00:03.000Z");
const resumedRunning = transitionAgentRun(resumed, "running", "2026-07-19T00:00:04.000Z");
const settled = settleAgentRun(resumedRunning, { attempt: resumedRunning.attempt, status: "succeeded", summary: "恢复后完成", timestamp: "2026-07-19T00:00:05.000Z" });
const recovered = interrupted.status === "interrupted"
  && interrupted.checkpoint.phase === "applying"
  && resumed.status === "awaiting-approval"
  && resumed.checkpoint.allowedFiles.join(",") === "src/math.js,src/math.test.js"
  && resumed.checkpoint.remainingRepairBudget === 1
  && resumed.attempt === applying.attempt + 1
  && settled.accepted
  && settled.run.status === "succeeded";
fs.writeFileSync(tracePath, `${JSON.stringify({ created, running, applying, interrupted, resumed, resumedRunning, settled }, null, 2)}\n`);
const result = {
  caseId: "interrupted-run",
  success: recovered,
  patchApplicable: false,
  checksPassed: recovered,
  recovered,
  approvalCount: 0,
  durationMs: Date.now() - started,
  costUsd: 0,
  execution: { executor: "omnidesk-runtime", fixture, executedAt: new Date().toISOString(), tracePath },
};
const outputPath = path.resolve(argument("--output") || path.join(os.tmpdir(), "omnidesk-agent-eval-interrupted-run-results.json"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ results: [result] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath, result })}\n`);

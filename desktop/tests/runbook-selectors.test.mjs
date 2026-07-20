import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectFactStore } from "../src/fact-store.js";
import { selectRunbook } from "../src/runbook-selectors.js";

function runbookStore(commands = []) {
  return buildProjectFactStore({
    snapshot: { currentProjectId: "runbook", currentProjectPath: "/workspace/OmniDesk", projectName: "OmniDesk", runbookCommands: commands, workspaceFacts: { project: {} } },
    report: {
      summary: { runbook: { status: "confirmed", title: "启动方式", body: "从项目脚本识别。", confidence: 0.9 } },
    },
  });
}

test("selects start commands while retaining detected environment requirements", () => {
  const model = selectRunbook(runbookStore([
    { id: "web", label: "Web 开发预览", command: "npm run dev", kind: "start", source: "desktop/package.json" },
    { id: "cargo", label: "桌面壳检查", command: "cargo check", kind: "check", source: "Cargo.toml" },
    { id: "runtime", label: "治理检查", command: "bash scripts/check-runtime.sh .", kind: "check", source: "scripts/check-runtime.sh" },
  ]));
  assert.equal(model.readiness.startCount, 1);
  assert.equal(model.status, "可启动");
  assert.deepEqual(model.context.requirements, ["Node.js / npm", "Rust / Cargo", "Bash"]);
  assert.equal(model.context.workingDirectory, "/workspace/OmniDesk");
  assert.equal(model.startCommands[0].note, "来源：desktop/package.json");
  assert.equal("verificationCommands" in model, false);
});

test("keeps an actionable empty runbook surface when no commands are detected", () => {
  const model = selectRunbook(runbookStore());
  assert.equal(model.render, true);
  assert.equal(model.startCommands.length, 0);
  assert.equal(model.status, "启动入口待补");
});

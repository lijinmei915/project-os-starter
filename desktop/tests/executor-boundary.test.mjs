import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workbenchSource = fs.readFileSync(path.join(desktopRoot, "src/main.jsx"), "utf8");
const executionActionSource = fs.readFileSync(path.join(desktopRoot, "src/lib/execution-action-controller.js"), "utf8");
const conversationSubmissionSource = fs.readFileSync(path.join(desktopRoot, "src/components/workbench/use-conversation-submission.js"), "utf8");
const planActionSource = fs.readFileSync(path.join(desktopRoot, "src/components/workbench/use-plan-action.js"), "utf8");
const patchActionSource = fs.readFileSync(path.join(desktopRoot, "src/components/workbench/use-patch-actions.js"), "utf8");

test("keeps provider and task execution policies out of the Workbench source", () => {
  const forbiddenPolicies = [
    "LOCAL_FALLBACK: provider plan timed out",
    "missing required key",
    "verificationSummary: allPassed",
    "const finishedRun =",
    "code: null",
    "const guardedChecks =",
    "onGeneratePlan({",
    ".then((outcome) =>",
    "我整理好了一个执行计划",
  ];
  for (const policy of forbiddenPolicies) {
    assert.equal(workbenchSource.includes(policy), false, `Workbench must delegate policy: ${policy}`);
  }
});

test("keeps every extracted workflow connected to its Workbench domain owner", () => {
  for (const workflow of ["executeReadonlyPlanWorkflow", "executePatchDraftWorkflow", "executePatchApplyWorkflow"]) {
    const owner = workflow === "executeReadonlyPlanWorkflow" ? planActionSource : workflow === "executePatchDraftWorkflow" || workflow === "executePatchApplyWorkflow" ? patchActionSource : workbenchSource;
    assert.match(owner, new RegExp(`${workflow}\\(`));
  }
  for (const workflow of ["executeGuardedCheckCommand", "executeTaskGuardedCheckWorkflow"]) {
    assert.match(workbenchSource, new RegExp(`import \\{[^}]*${workflow}[^}]*\\}`));
    assert.match(executionActionSource, new RegExp(`${workflow}\\(`));
  }
});

test("routes chat-to-task escalation through the Conversation Action Executor", () => {
  assert.match(workbenchSource, /useConversationSubmission/);
  assert.match(conversationSubmissionSource, /action: \{ id: "generate-plan", task:/);
  assert.match(conversationSubmissionSource, /adapters: createConversationActionAdapters\(\{ generatePlan: onGeneratePlan \}\)/);
  assert.match(conversationSubmissionSource, /actionResult\.turn/);
});

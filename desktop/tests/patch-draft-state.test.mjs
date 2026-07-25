import assert from "node:assert/strict";
import test from "node:test";

import { patchDraftResultState, patchDraftStates } from "../src/lib/patch-draft-state.js";

test("projects an applicable Patch Draft into one approval state", () => {
  assert.deepEqual(patchDraftResultState({
    patchDraft: { diff: "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n" },
    success: true,
  }), {
    applicable: true,
    eventStatus: "current",
    outcome: "awaiting-confirmation",
    requestStatus: "succeeded",
    state: patchDraftStates.awaitingApproval,
  });
});

test("never treats an unusable Provider artifact as a successful Patch result", () => {
  assert.deepEqual(patchDraftResultState({
    patchDraft: { diff: "--- /dev/null\n+++ PATCH_DRAFT_PENDING\n@@\n+placeholder\n" },
    success: true,
  }), {
    applicable: false,
    eventStatus: "failed",
    outcome: "failed",
    requestStatus: "failed",
    state: patchDraftStates.invalid,
  });
});

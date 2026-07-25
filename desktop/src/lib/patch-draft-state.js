export const patchDraftStates = Object.freeze({
  awaitingApproval: "awaiting-approval",
  failed: "failed",
  invalid: "invalid",
});

export function isApplicablePatchDraft(patchDraft) {
  const diff = String(patchDraft?.diff || "");
  return patchDraft?.notApplicable !== true
    && !diff.includes("PATCH_DRAFT_PENDING")
    && /^---\s+\S+/m.test(diff)
    && /^\+\+\+\s+\S+/m.test(diff)
    && /^@@(?:\s|$)/m.test(diff);
}

export function patchDraftResultState(result = {}) {
  const generated = Boolean(result?.success);
  const applicable = generated && isApplicablePatchDraft(result.patchDraft);
  const state = applicable
    ? patchDraftStates.awaitingApproval
    : generated
      ? patchDraftStates.invalid
      : patchDraftStates.failed;
  return Object.freeze({
    applicable,
    eventStatus: applicable ? "current" : "failed",
    outcome: applicable ? "awaiting-confirmation" : "failed",
    requestStatus: applicable ? "succeeded" : "failed",
    state,
  });
}

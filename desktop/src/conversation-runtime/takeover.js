export const requestTakeoverDecisions = Object.freeze({
  cancel: "cancel",
  continueCurrent: "continue-current",
  none: "none",
  redirect: "redirect",
});

export function resolveRequestTakeover(message, { running = false } = {}) {
  if (!running) return { decision: requestTakeoverDecisions.none, reason: "no-active-request" };
  const text = String(message || "").trim().replace(/[。！!，,\s]/g, "");
  if (!text) return { decision: requestTakeoverDecisions.none, reason: "empty" };
  if (/^(停止|停下|取消|算了|不用了|先停|别做了|中止)$/.test(text)) {
    return { decision: requestTakeoverDecisions.cancel, reason: "user-cancelled" };
  }
  if (/^(继续原任务|继续刚才的|继续刚才|按原计划继续|不用改方向|保持原方向)$/.test(text)) {
    return { decision: requestTakeoverDecisions.continueCurrent, reason: "keep-current" };
  }
  return { decision: requestTakeoverDecisions.redirect, reason: "new-user-direction" };
}

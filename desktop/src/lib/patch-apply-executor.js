import { persistPatchApplyFailure } from "./patch-apply-failure.js";

function isoNow() {
  return new Date().toISOString();
}

export const maxRepairAttempts = 2;

function evidence(task, kind, status, summary, details = {}, at) {
  return [...(task?.executionEvidence || []), { at, details, kind, status, summary }];
}

function repairState(task, failureOutput, at) {
  const attempt = Number(task?.repair?.attempt || 0);
  const exhausted = attempt >= maxRepairAttempts;
  return {
    attempt,
    failureOutput,
    lastFailedAt: at,
    phase: exhausted ? "failed" : "pending",
    remaining: Math.max(0, maxRepairAttempts - attempt),
  };
}

export async function executePatchApplyWorkflow({
  applyPatch,
  checks = [],
  now = isoNow,
  onCheckStart,
  onProgress,
  persistTask,
  runCheck,
  task,
  writeRunSummary,
} = {}) {
  if (!task) return { error: "找不到需要应用改动的任务。", success: false };
  onProgress?.({
    events: [{ id: "apply-patch", label: "应用改动", status: "current" }],
    outcome: "running",
    text: "正在应用改动。",
  });
  let currentTask = task;
  try {
    const applyResult = await applyPatch(task);
    currentTask = await persistTask({
      ...task,
      status: "running",
      executionEvidence: evidence(task, "apply", "succeeded", "Patch 已应用，等待验证。", applyResult, now()),
      applyResult: {
        ...applyResult,
        finishedAt: now(),
      },
    }, { durable: true });

    if (!checks.length) {
      const doneTask = { ...currentTask, status: "done" };
      const runSummary = await writeRunSummary(doneTask);
      currentTask = await persistTask({ ...doneTask, runSummary }, { durable: true });
      const result = {
        events: [{ id: "apply-patch", label: "应用改动", status: "done" }],
        feedback: "改动已应用，已写入运行摘要。",
        outcome: "succeeded",
        success: true,
        task: currentTask,
        text: "改动已应用，运行摘要已写入。",
      };
      onProgress?.(result);
      return result;
    }

    const verificationRuns = [];
    for (const check of checks) {
      onCheckStart?.(check);
      onProgress?.({
        events: [
          { id: "apply-patch", label: "应用改动", status: "done" },
          { id: `verify-${check.id}`, label: check.label, status: "current" },
        ],
        outcome: "running",
        text: `正在验证：${check.label}`,
      });
      const result = await runCheck(check);
      verificationRuns.push({
        ...result,
        auto: true,
        finishedAt: now(),
      });
    }

    const allPassed = verificationRuns.every((run) => run.success);
    const failureOutput = verificationRuns.filter((run) => !run.success).map((run) => run.output || run.label || run.id).join("\n");
    const nextRepair = allPassed ? task.repair : repairState(currentTask, failureOutput || "自动验证有失败项", now());
    const verifiedTask = {
      ...currentTask,
      status: allPassed ? "done" : nextRepair.phase === "failed" ? "repair failed" : "repair pending",
      runs: [...verificationRuns, ...(task.runs || [])],
      repair: nextRepair,
      executionEvidence: evidence(currentTask, "check", allPassed ? "succeeded" : "failed", allPassed ? "自动验证通过。" : "自动验证失败，可生成受控修复草稿。", { runs: verificationRuns }, now()),
      verificationSummary: allPassed ? "自动验证通过" : "自动验证有失败项",
    };
    const runSummary = await writeRunSummary(verifiedTask);
    currentTask = await persistTask({ ...verifiedTask, runSummary }, { durable: true });
    const result = {
      events: verificationRuns.map((run) => ({
        id: `verify-${run.id}`,
        label: run.label || run.id,
        status: run.success ? "done" : "failed",
      })),
      feedback: allPassed ? "改动已应用，自动验证通过。" : nextRepair.phase === "failed" ? "改动已应用，但修复次数已用尽。" : "改动已应用，但自动验证有失败项。可以生成修复草稿。",
      outcome: allPassed ? "succeeded" : "failed",
      success: allPassed,
      task: currentTask,
      text: allPassed ? "改动已应用，自动验证通过。" : nextRepair.phase === "failed" ? "自动验证失败，修复次数已用尽。" : "自动验证失败。查看失败证据后，可生成修复草稿。",
    };
    onProgress?.(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    currentTask = await persistPatchApplyFailure({
      finishedAt: now(),
      message,
      persistTask,
      task: currentTask,
    });
    const repair = repairState(currentTask, message, now());
    currentTask = await persistTask({
      ...currentTask,
      status: repair.phase === "failed" ? "repair failed" : "repair pending",
      repair,
      executionEvidence: evidence(currentTask, "apply", "failed", "Patch 未能应用，可生成修复草稿。", { error: message }, now()),
    }, { durable: true });
    const result = {
      error: message,
      events: [{ detail: message, id: "apply-patch", label: "应用改动", status: "failed" }],
      feedback: `应用改动失败：${message}`,
      outcome: "failed",
      success: false,
      task: currentTask,
      text: "应用改动失败。",
    };
    onProgress?.(result);
    return result;
  }
}

function numericValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function tokenValue(source, keys) {
  const value = numericValue(source, keys);
  return Number.isSafeInteger(value) ? value : null;
}

export function normalizeProviderUsage(value) {
  const inputTokens = tokenValue(value, ["input_tokens", "inputTokens", "prompt_tokens", "promptTokens"]);
  const outputTokens = tokenValue(value, ["output_tokens", "outputTokens", "completion_tokens", "completionTokens"]);
  const totalTokens = tokenValue(value, ["total_tokens", "totalTokens"]);
  const costUsd = numericValue(value, ["cost_usd", "costUsd", "total_cost", "totalCost", "cost"]);
  return {
    reported: inputTokens !== null
      && outputTokens !== null
      && totalTokens !== null
      && totalTokens >= inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    costReported: costUsd !== null,
  };
}

export function validateProviderTimelineRuntimeResult(result) {
  if (result?.schemaVersion !== "omnidesk.provider-timeline-runtime-result.v0.1") throw new Error("Provider Timeline result schema invalid");
  if (result?.status !== "passed" || result?.runStatus !== "succeeded") throw new Error(`Provider Runtime did not finish successfully: ${result?.summary || "unknown"}`);
  if (result?.scheduler?.statusDuringExecution !== "running") throw new Error("Provider Runtime did not hold a Scheduler lease during execution");
  if (result?.scheduler?.activeCountAfter !== 0 || result?.scheduler?.remainingEntriesAfter !== 0) throw new Error("Provider Runtime left a Scheduler reservation behind");
  const timeline = result?.timeline;
  if (timeline?.schemaVersion !== "omnidesk.run-timeline-export.v0.1" || timeline?.status !== "succeeded") throw new Error("Provider Timeline is not a terminal success");
  if (timeline?.redaction?.policy !== "metadata-only") throw new Error("Provider Timeline is not metadata-only");
  const metrics = timeline?.metrics || {};
  if (!(Number.isSafeInteger(metrics.modelEventCount) && metrics.modelEventCount >= 1)) throw new Error("Provider Timeline contains no model event");
  for (const field of ["inputTokens", "outputTokens", "totalTokens"]) {
    if (!(Number.isSafeInteger(metrics[field]) && metrics[field] > 0)) throw new Error(`Provider Timeline is missing real ${field}`);
  }
  if (metrics.totalTokens < metrics.inputTokens + metrics.outputTokens) throw new Error("Provider Timeline totalTokens is inconsistent");
  if (metrics.costUsd != null && !(typeof metrics.costUsd === "number" && Number.isFinite(metrics.costUsd) && metrics.costUsd >= 0)) throw new Error("Provider Timeline cost is invalid");
  if (result?.usage?.source !== "acp-response") throw new Error("Provider usage was not sourced from the real ACP response");
  return result;
}

export function validateProviderFallbackRuntimeResult(result) {
  if (result?.schemaVersion !== "omnidesk.provider-fallback-runtime-result.v0.1") throw new Error("Provider Fallback result schema invalid");
  const fallback = result?.fallback || {};
  if (fallback.responseMode !== "compatibility-keyword") throw new Error("Provider did not enter compatibility fallback mode");
  if (fallback.shouldCreatePlan !== true) throw new Error("Compatibility fallback lost deterministic task intent");
  if (!(Number.isSafeInteger(fallback.replyChars) && fallback.replyChars > 0)) throw new Error("Compatibility fallback returned no visible text");
  if (!(Number.isSafeInteger(fallback.deltaEvents) && fallback.deltaEvents > 0)) throw new Error("Compatibility fallback emitted no streaming delta");
  if (!(Number.isSafeInteger(fallback.durationMs) && fallback.durationMs >= 12_000)) throw new Error("Compatibility fallback did not prove a stream longer than 12 seconds");
  if (result?.capability?.mode !== "compatibility-keyword" || result?.capability?.source !== "explicit-tool-rejection") throw new Error("Compatibility capability evidence was not persisted");
  const interruption = result?.interruption || {};
  if (!(Number.isSafeInteger(interruption.partialReplyChars) && interruption.partialReplyChars > 0)) throw new Error("Interrupted stream did not retain partial text");
  if (!(Number.isSafeInteger(interruption.deltaEvents) && interruption.deltaEvents > 0) || interruption.errorPresent !== true) throw new Error("Interrupted stream lacks terminal failure evidence");
  return result;
}

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
  if (timeline?.executorId !== "hermes-acp") throw new Error("Provider Timeline was not produced by Hermes");
  const agentEvents = (Array.isArray(timeline?.events) ? timeline.events : [])
    .flatMap((event) => Array.isArray(event?.details?.agentEvents) ? event.details.agentEvents : []);
  if (agentEvents.length < 2) throw new Error("Provider Timeline contains no complete AgentEvent sequence");
  if (agentEvents.some((event, index) => (
    event?.schemaVersion !== "omnidesk.agent-event.v1"
    || event?.sequence !== index + 1
    || typeof event?.summary !== "string"
    || !event.summary.trim()
  ))) throw new Error("Provider Timeline AgentEvent sequence is invalid");
  const terminalEvents = agentEvents.filter((event) => event.kind === "terminal");
  if (terminalEvents.length !== 1 || terminalEvents[0]?.status !== "succeeded") throw new Error("Provider Timeline must contain one successful terminal AgentEvent");
  const serializedAgentEvents = JSON.stringify(agentEvents);
  if (/\"(?:content|reasoning)\"\s*:/.test(serializedAgentEvents)) throw new Error("Provider Timeline AgentEvent leaked private model data");
  return result;
}

export function validateProviderReadonlyFileEvidence(result) {
  const evidence = result?.readonlyFileEvidence;
  if (evidence?.fixturePath !== "README.md" || evidence.markerMatched !== true) throw new Error("Readonly Agent did not recover the file-only marker");
  if (evidence.fixtureSourceUnchanged !== true || evidence.projectEntriesUnchanged !== true) throw new Error("Readonly Agent changed fixture files");
  const events = result?.readonlyToolEvents || [];
  const requested = events.findIndex((event) => event.kind === "tool-call" && event.status === "requested" && event.details?.name === "read_file" && event.details?.path === evidence.fixturePath);
  const succeeded = events.findIndex((event, index) => index > requested && event.kind === "tool-result" && event.status === "succeeded" && event.details?.name === "read_file" && event.details?.path === evidence.fixturePath && event.details?.success === true);
  if (requested < 0 || succeeded < 0) throw new Error("Readonly Agent lacks successful file tool evidence");
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

export function validateProviderDirectStreamRuntimeResult(result) {
  if (result?.schemaVersion !== "omnidesk.provider-direct-stream-runtime-result.v0.1") throw new Error("Direct stream result schema invalid");
  if (result.status !== "completed" || result.error != null) throw new Error("Direct upstream stream did not complete");
  if (result.fixtureSourceUnchanged !== true) throw new Error("Direct chat changed fixture source");
  if (result.shouldCreatePlan !== false) throw new Error("Direct chat unexpectedly requested an engineering task");
  if (!Number.isSafeInteger(result.replyChars) || result.replyChars < 100 || result.contentMatches !== true) throw new Error("Visible stream did not preserve the complete answer");
  if (!Number.isSafeInteger(result.deltaEvents) || result.deltaEvents < 2) throw new Error("Direct upstream returned only one visible delivery");
  const { firstDeltaMs, lastDeltaMs, durationMs } = result;
  if (![firstDeltaMs, lastDeltaMs, durationMs].every((v) => Number.isSafeInteger(v) && v >= 0)
    || lastDeltaMs > durationMs || lastDeltaMs - firstDeltaMs < 25) throw new Error("Visible deltas arrived together; incremental delivery is unproven");
  const samples = result.samples;
  if (!Array.isArray(samples) || samples.length < 2 || samples.length !== Math.min(256, result.deltaEvents)
    || samples.some((sample, index) => !Number.isSafeInteger(sample.elapsedMs)
      || sample.elapsedMs < firstDeltaMs || sample.elapsedMs > lastDeltaMs
      || (index > 0 && sample.elapsedMs < samples[index - 1].elapsedMs)
      || !Number.isSafeInteger(sample.chars) || sample.chars <= 0)
    || samples[0].elapsedMs !== firstDeltaMs
    || (result.deltaEvents <= 256 && samples.at(-1).elapsedMs !== lastDeltaMs)) throw new Error("Visible stream timing evidence is incomplete");
  return result;
}

// Protocol diagnostics only: never return response bodies, text, or error messages.
export function summarizeProviderStreamProbe(body) {
  const records = String(body).split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  const result = { dataRecords: records.length, doneRecords: 0, jsonRecords: 0, malformedRecords: 0, errorRecords: 0, contentRecords: 0, contentChars: 0, toolRecords: 0, finishRecords: 0, nonSseJson: false };
  for (const record of records) {
    if (record === "[DONE]") { result.doneRecords += 1; continue; }
    let value;
    try { value = JSON.parse(record); result.jsonRecords += 1; } catch { result.malformedRecords += 1; continue; }
    if (value.error != null) result.errorRecords += 1;
    for (const choice of Array.isArray(value.choices) ? value.choices : []) {
      const content = choice?.delta?.content;
      if (typeof content === "string" && content.length) { result.contentRecords += 1; result.contentChars += [...content].length; }
      if (Array.isArray(choice?.delta?.tool_calls) && choice.delta.tool_calls.length) result.toolRecords += 1;
      if (choice?.finish_reason != null) result.finishRecords += 1;
    }
  }
  if (!records.length) {
    try { const value = JSON.parse(body); result.nonSseJson = true; if (value.error != null) result.errorRecords += 1; } catch {}
  }
  return result;
}

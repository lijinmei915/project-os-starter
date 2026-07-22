import { collectProjectFactCandidates } from "./fact-source-adapters.js";

const PROJECT_OVERVIEW_FACT_IDS = Object.freeze([
  "project.name", "project.version", "project.phase", "project.description", "project.updated-at",
  "product.goal", "product.core-capabilities", "technology.stack", "technology.dependencies", "engineering.directories",
  "runbook.summary", "runbook.commands", "runbook.context",
  "progress.summary", "progress.milestone", "progress.goal", "progress.acceptance", "progress.validation-report", "progress.risks", "progress.evidence",
]);

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function selectCandidate(candidates) {
  return candidates.find((candidate) => hasValue(candidate.value)) || null;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasConfirmedConflict(candidates) {
  const confirmed = candidates.filter((item) => item.status === "confirmed" && hasValue(item.value));
  return confirmed.some((item) => !valuesEqual(item.value, confirmed[0]?.value));
}

function createFact({ candidates, freshness, id, observedAt }) {
  const selected = selectCandidate(candidates);
  const sources = candidates.map((candidate, index) => ({
    path: candidate.path,
    role: index === 0 ? "primary" : candidate.role || "fallback",
    ...(candidate.selector ? { selector: candidate.selector } : {}),
    ...(hasValue(candidate.value) ? { value: candidate.value } : {}),
    status: hasValue(candidate.value) ? candidate.status : "missing",
    confidence: hasValue(candidate.value) ? candidate.confidence : 0,
  }));
  const conflict = hasConfirmedConflict(candidates);
  return Object.freeze({
    id,
    value: selected?.value ?? null,
    status: conflict ? "conflict" : selected?.status || "missing",
    sources,
    selectedSource: selected?.path || null,
    confidence: selected?.confidence ?? 0,
    observedAt,
    freshness,
  });
}

export function buildProjectFactStore({ observedAt = new Date().toISOString(), report, snapshot, tasks = [] }) {
  const project = report?.project || snapshot?.workspaceFacts?.project || {};
  const freshness = snapshot?.factFreshness?.status || "unknown";
  const candidates = collectProjectFactCandidates({ report, snapshot, tasks });
  const facts = PROJECT_OVERVIEW_FACT_IDS.map((id) => createFact({ id, observedAt, freshness, candidates: candidates.get(id) || [] }));
  const factById = new Map(facts.map((fact) => [fact.id, fact]));
  return Object.freeze({
    schemaVersion: "omnidesk.project-fact-store.v0.1",
    projectId: snapshot?.currentProjectId || project.id || snapshot?.projectName || "current-project",
    observedAt,
    facts: Object.freeze(facts),
    get(id) { return factById.get(id) || null; },
    has(id) { return factById.has(id); },
    toJSON() { return { schemaVersion: this.schemaVersion, projectId: this.projectId, observedAt: this.observedAt, facts: this.facts }; },
  });
}

export function compareProjectOverviewFacts(store, legacyValues) {
  return PROJECT_OVERVIEW_FACT_IDS.flatMap((id) => {
    if (!(id in legacyValues)) return [];
    const actual = store.get(id)?.value ?? null;
    return valuesEqual(actual, legacyValues[id]) ? [] : [{ id, legacyValue: legacyValues[id], factStoreValue: actual }];
  });
}

export function diffProjectFactStores(previousStore, nextStore) {
  if (!previousStore) return nextStore.facts.map((fact) => fact.id);
  return nextStore.facts.filter((fact) => {
    const previous = previousStore.get(fact.id);
    return !previous || !valuesEqual(previous.value, fact.value) || previous.status !== fact.status || previous.freshness !== fact.freshness;
  }).map((fact) => fact.id);
}

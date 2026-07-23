import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { projectGovernanceOutline } from "../src/workspace-outline.js";
import {
  validateWorkspaceRouteRegistry,
  workspaceRouteById,
  workspaceRouteRegistry,
} from "../src/workspace-route-registry.js";

test("registers every menu, submenu, and leaf with valid unique ownership", () => {
  assert.deepEqual(validateWorkspaceRouteRegistry(projectGovernanceOutline), []);
  assert.ok(workspaceRouteRegistry.length > 0);
  assert.equal(workspaceRouteRegistry.every((route) => /^[a-z0-9-]+$/.test(route.id)), true);
});

test("current progress is an aggregation route that links to its owners", () => {
  const route = workspaceRouteById("project-progress");
  assert.deepEqual(route.owns, ["progress-summary", "next-action"]);
  assert.deepEqual(route.linksTo, ["current-goal", "task-list", "execution-results", "project-risks"]);
  assert.equal(route.surface, "current-progress");
});

test("runbook selects commands and delegates execution to the terminal owner", () => {
  const route = workspaceRouteById("project-runbook");
  assert.deepEqual(route.owns, ["runbook-commands"]);
  assert.deepEqual(route.linksTo, ["execution-terminal"]);
});

test("risk boundary owns only project risks and range limits", () => {
  const route = workspaceRouteById("project-risks");
  assert.deepEqual(route.owns, ["risk-details", "boundary-details"]);
  assert.equal(route.surface, "risk-boundary");
});

test("goal pages own distinct definition, acceptance, and history surfaces", () => {
  const currentGoal = workspaceRouteById("current-goal");
  const acceptance = workspaceRouteById("acceptance-criteria");
  const history = workspaceRouteById("goal-history");

  assert.deepEqual(currentGoal.owns, ["goal-definition", "goal-scope", "goal-next-action"]);
  assert.deepEqual(acceptance.owns, ["acceptance-criteria", "acceptance-status"]);
  assert.deepEqual(acceptance.linksTo, ["validation-report"]);
  assert.deepEqual(history.owns, ["goal-history", "goal-signoff-records"]);
  assert.equal(currentGoal.surface, "current-goal");
  assert.equal(acceptance.surface, "acceptance-criteria");
  assert.equal(history.surface, "goal-history");
});

test("work rule pages own distinct collaboration, permission, and documentation surfaces", () => {
  const collaboration = workspaceRouteById("collaboration-boundary");
  const permissions = workspaceRouteById("execution-permissions");
  const documentation = workspaceRouteById("documentation-rules");

  assert.deepEqual(collaboration.owns, ["collaboration-boundary"]);
  assert.deepEqual(permissions.owns, ["execution-permissions"]);
  assert.deepEqual(documentation.owns, ["documentation-rules"]);
  assert.equal(collaboration.surface, "collaboration-boundary");
  assert.equal(permissions.surface, "execution-permissions");
  assert.equal(documentation.surface, "documentation-rules");
});

test("design implementation pages own distinct architecture, contract, and code modules", () => {
  const architecture = workspaceRouteById("system-architecture");
  const contracts = workspaceRouteById("data-contracts");
  const code = workspaceRouteById("code-structure");

  assert.deepEqual(architecture.owns, ["architecture-layers", "architecture-entry-context", "architecture-runtime-boundary"]);
  assert.deepEqual(contracts.owns, ["contract-state-facts", "contract-workspace-views", "contract-validation-write"]);
  assert.deepEqual(code.owns, ["implementation-workbench-ui", "implementation-local-core", "implementation-governance-runtime"]);
  assert.equal(architecture.surface, "system-architecture");
  assert.equal(contracts.surface, "data-contracts");
  assert.equal(code.surface, "code-structure");
});

test("validation pages own distinct checks, report, and run-record modules", () => {
  const checks = workspaceRouteById("validation-checks");
  const report = workspaceRouteById("validation-report");
  const runs = workspaceRouteById("run-records");

  assert.deepEqual(checks.owns, ["check-catalog", "check-execution-boundary", "check-coverage"]);
  assert.deepEqual(report.owns, ["validation-conclusion", "validation-check-results", "validation-follow-up"]);
  assert.deepEqual(runs.owns, ["run-history", "run-evidence", "run-retention"]);
  assert.equal(checks.surface, "validation-checks");
  assert.equal(report.surface, "validation-report");
  assert.equal(runs.surface, "run-records");
});

test("retrospective pages own distinct handoff, decision, and lesson modules", () => {
  const handoff = workspaceRouteById("handoff-records");
  const decisions = workspaceRouteById("decision-records");
  const lessons = workspaceRouteById("lessons-learned");
  assert.deepEqual(handoff.owns, ["handoff-current-context", "handoff-continuation-focus", "handoff-open-risks"]);
  assert.deepEqual(decisions.owns, ["decision-choice", "decision-rationale", "decision-impact"]);
  assert.deepEqual(lessons.owns, ["lesson-error-pattern", "lesson-root-cause", "lesson-new-constraint"]);
  assert.equal(handoff.surface, "handoff-records");
  assert.equal(decisions.surface, "decision-records");
  assert.equal(lessons.surface, "lessons-learned");
});

test("task pages use one task list with distinct terminal and result modules", () => {
  assert.deepEqual(workspaceRouteById("task-list").owns, ["task-list-items", "task-detail", "task-next-action"]);
  assert.deepEqual(workspaceRouteById("execution-terminal").owns, ["terminal-sessions", "terminal-controlled-commands", "terminal-output"]);
  assert.deepEqual(workspaceRouteById("execution-results").owns, ["result-history", "result-failures", "result-follow-up"]);
  assert.equal(workspaceRouteById("task-list").surface, "task-execution");
});

test("memory pages own distinct facts, preferences, long-term memory, and conversation modules", () => {
  assert.deepEqual(workspaceRouteById("project-facts").owns, ["facts-profile", "facts-sources", "facts-freshness"]);
  assert.deepEqual(workspaceRouteById("user-preferences").owns, ["preferences-project", "preferences-global", "preferences-confirmation"]);
  assert.deepEqual(workspaceRouteById("long-term-memory").owns, ["memory-decisions", "memory-lessons", "memory-retention"]);
  assert.deepEqual(workspaceRouteById("conversation-summary").owns, ["conversation-topics", "conversation-outcomes", "conversation-pending"]);
});

test("asset pages own distinct code, governance, report, and schema modules", () => {
  assert.deepEqual(workspaceRouteById("engineering-files").owns, ["asset-code-entry", "asset-code-structure", "asset-code-preview"]);
  assert.deepEqual(workspaceRouteById("governance-files").owns, ["asset-governance-health", "asset-governance-files", "asset-governance-actions"]);
  assert.deepEqual(workspaceRouteById("report-artifacts").owns, ["asset-reports-catalog", "asset-reports-evidence", "asset-reports-retention"]);
  assert.deepEqual(workspaceRouteById("schema-assets").owns, ["asset-schema-catalog", "asset-schema-usage", "asset-schema-validation"]);
  assert.equal(workspaceRouteById("script-templates"), null);
});

test("agent configuration pages own distinct model, tool, and security modules", () => {
  assert.deepEqual(workspaceRouteById("model-connections").owns, ["model-provider", "model-availability", "model-default"]);
  assert.deepEqual(workspaceRouteById("tool-allowlist").owns, ["tool-allowed", "tool-confirmation", "tool-restrictions"]);
  const outlineSource = fs.readFileSync(new URL("../src/workspace-outline.js", import.meta.url), "utf8");
  assert.match(outlineSource, /id: "tool-allowlist", title: "受控工具"/);
  assert.match(outlineSource, /desktop\/src-tauri\/src\/runtime\/execution\.rs/);
  assert.doesNotMatch(outlineSource, /agent-runtime\/tool-registry\.js/);
  assert.equal(workspaceRouteById("skill-capabilities"), null);
  assert.equal(workspaceRouteById("adapters"), null);
  assert.deepEqual(workspaceRouteById("security-boundary").owns, ["security-data", "security-execution", "security-confirmation"]);
});

test("critical project-flow pages do not fall back to the generic topic surface", () => {
  const workbench = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const catalog = fs.readFileSync(new URL("../src/lib/workbench-catalog.js", import.meta.url), "utf8");
  assert.match(workbench, /dedicatedSurfaceByTopic/);
  assert.match(catalog, /"project-progress": "current-progress"/);
  assert.match(catalog, /"project-runbook": "runbook"/);
  assert.match(catalog, /"project-risks": "risk-boundary"/);
  assert.match(catalog, /"local-project-state": "local-project-state"/);
  assert.match(catalog, /"collaboration-boundary": "collaboration-boundary"/);
  assert.match(catalog, /"execution-permissions": "execution-permissions"/);
  assert.match(catalog, /"documentation-rules": "documentation-rules"/);
  assert.match(catalog, /"system-architecture": "system-architecture"/);
  assert.match(catalog, /"data-contracts": "data-contracts"/);
  assert.match(catalog, /"code-structure": "code-structure"/);
  assert.match(catalog, /"validation-checks": "validation-checks"/);
  assert.match(catalog, /"validation-report": "validation-report"/);
  assert.match(catalog, /"run-records": "run-records"/);
  assert.match(catalog, /"handoff-records": "handoff-records"/);
  assert.match(catalog, /"decision-records": "decision-records"/);
  assert.match(catalog, /"lessons-learned": "lessons-learned"/);
});

test("ui standards is a group and token/component pages own distinct features", () => {
  const group = workspaceRouteById("ui-standards");
  const tokens = workspaceRouteById("design-tokens");
  const components = workspaceRouteById("component-library");

  assert.equal(group.type, "submenu");
  assert.deepEqual(group.owns, []);
  assert.deepEqual(tokens.owns, ["design-tokens"]);
  assert.deepEqual(components.owns, ["component-library"]);
  assert.equal(tokens.parentId, group.id);
  assert.equal(components.parentId, group.id);
});

test("production routing does not fall back to Chinese display titles", () => {
  const source = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const topicSurface = fs.readFileSync(new URL("../src/lib/engineering-topic-surface.js", import.meta.url), "utf8");
  const workspaceTabs = fs.readFileSync(new URL("../src/components/workbench/use-workspace-tabs.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /selectedTopic\.title\s*===/);
  assert.doesNotMatch(source, /node\.title\s*===\s*targetId/);
  assert.doesNotMatch(source, /item\.title\s*===\s*targetId/);
  assert.match(topicSurface, /selectedRoute\?\.type === "page" \|\| surface !== "agent-topic"/);
  assert.match(source, /onValueChange=\{changeWorkspaceTab\}/);
  assert.match(source, /useWorkspaceTabs/);
  assert.match(workspaceTabs, /onSelectEngineeringFile\?\.\(nextTab\.file\)/);
  assert.match(workspaceTabs, /onSelectTask\?\.\(nextTab\.taskId/);
});

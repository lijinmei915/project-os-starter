import assert from "node:assert/strict";
import test from "node:test";
import { resolveEngineeringTopicSurface } from "../src/lib/engineering-topic-surface.js";

test("resolves registered Workspace topic surfaces without coupling to rendering", () => {
  const result = resolveEngineeringTopicSurface({
    dedicatedSurfaceByTopic: {},
    selectedEngineeringFile: { topic: { id: "goals", routeId: "current-goal" } },
    workspaceRouteById: () => ({ surface: "current-goal", type: "page" }),
  });
  assert.equal(result.isCurrentGoalTopic, true);
  assert.equal(result.usesDedicatedSurface, true);
  assert.equal(result.topicRouteId, "current-goal");
});

test("keeps virtual unregistered topics on the generic agent surface", () => {
  const result = resolveEngineeringTopicSurface({
    dedicatedSurfaceByTopic: {},
    selectedEngineeringFile: { id: "custom-topic", virtual: true },
    workspaceRouteById: () => null,
  });
  assert.equal(result.selectedTopic.id, "custom-topic");
  assert.equal(result.surface, "agent-topic");
  assert.equal(result.usesDedicatedSurface, false);
});

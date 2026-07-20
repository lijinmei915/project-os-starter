import assert from "node:assert/strict";
import test from "node:test";

import { capabilityManifestSignature, isSlotCapabilityEnabled } from "../src/capability-policy.js";

const requirement = { id: "project-overview", moduleId: "project-identity" };

test("keeps legacy projects without a capability manifest compatible", () => {
  assert.equal(isSlotCapabilityEnabled(requirement, null), true);
});

test("requires the parent capability to be enabled", () => {
  assert.equal(isSlotCapabilityEnabled(requirement, { workspaceCapabilities: [{ id: "project-overview", status: "recommended" }] }), false);
  assert.equal(isSlotCapabilityEnabled(requirement, { workspaceCapabilities: [{ id: "project-overview", status: "enabled" }] }), true);
});

test("honors module-level activation when modules are declared", () => {
  const manifest = { workspaceCapabilities: [{ id: "project-overview", status: "enabled", modules: [
    { id: "project-identity", status: "available" },
    { id: "project-runbook", status: "enabled" },
  ] }] };
  assert.equal(isSlotCapabilityEnabled(requirement, manifest), false);
  assert.equal(isSlotCapabilityEnabled({ id: "project-overview", moduleId: "project-runbook" }, manifest), true);
});

test("signature changes only with workspace capability activation state", () => {
  const first = capabilityManifestSignature({ workspaceCapabilities: [{ id: "project-overview", status: "enabled" }], updatedAt: "one" });
  const second = capabilityManifestSignature({ workspaceCapabilities: [{ id: "project-overview", status: "enabled" }], updatedAt: "two" });
  assert.equal(first, second);
});

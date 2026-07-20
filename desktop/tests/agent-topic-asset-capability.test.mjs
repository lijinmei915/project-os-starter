import assert from "node:assert/strict";
import test from "node:test";
import { assetCapabilitySpec } from "../src/lib/agent-topic-asset-capability.js";

test("derives asset capability status from Workspace domain facts", () => {
  const count = (domain) => domain?.files?.length || 0;
  const risk = (domain) => domain?.risk || 0;
  const spec = assetCapabilitySpec("governance-files", {
    assetDomainFileCount: count,
    assetDomainRiskCount: risk,
    domains: { governanceDomain: { files: ["AGENTS.md"], risk: 1 } },
    snapshot: {},
  });
  assert.equal(spec.status, "需关注");
  assert.equal(assetCapabilitySpec("unknown", { assetDomainFileCount: count, assetDomainRiskCount: risk, domains: {}, snapshot: {} }), null);
});

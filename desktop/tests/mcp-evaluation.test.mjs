import assert from "node:assert/strict";
import test from "node:test";
import {
  validateInstalledMcpPackage,
  validateThirdPartyMcpRuntimeResult,
} from "../src/agent-runtime/mcp-evaluation.js";

const PACKAGE_NAME = "@modelcontextprotocol/server-filesystem";
const PACKAGE_VERSION = "2026.7.10";
const PACKAGE_INTEGRITY = "sha512-pinned";

function result() {
  const timeline = (name) => ({
    schemaVersion: "omnidesk.run-timeline-export.v0.1",
    status: "succeeded",
    events: [{ details: { name } }],
    redaction: { policy: "metadata-only" },
  });
  return {
    schemaVersion: "omnidesk.third-party-mcp-runtime-result.v0.1",
    server: { transport: "stdio", approvalPolicy: "always" },
    approvals: { count: 2, independent: true },
    discovery: {
      runStatusBeforeApproval: "awaiting-approval",
      schedulerStatusBeforeApproval: "waiting-approval",
      toolResultPresentBeforeApproval: false,
      evidencePresentBeforeApproval: false,
      completedRunStatus: "succeeded",
      evidenceSchemaVersion: "omnidesk.mcp-discovery-evidence.v0.1",
      evidenceProjectId: "project-a",
      toolNames: ["list_directory"],
      descriptorBoundary: { source: "mcp", risk: "execute", requiresApproval: true },
    },
    call: {
      runStatusBeforeApproval: "awaiting-approval",
      schedulerStatusBeforeApproval: "waiting-approval",
      toolResultPresentBeforeApproval: false,
      completedRunStatus: "succeeded",
      remoteName: "list_directory",
      result: { isError: false, content: [{ type: "text", text: "[FILE] proof.txt" }] },
      resultBytes: 72,
    },
    scheduler: { activeCountAfter: 0, remainingEntriesAfter: 0 },
    timelines: [timeline("mcp_discover"), timeline("mcp_call")],
  };
}

const options = { expectedContent: "proof.txt", expectedToolName: "list_directory", projectId: "project-a" };

function validatePackage(packageKey, integrity = PACKAGE_INTEGRITY) {
  const packageManifest = { name: PACKAGE_NAME, version: PACKAGE_VERSION };
  const packageLock = {
    packages: {
      [packageKey]: {
        version: PACKAGE_VERSION,
        integrity,
      },
    },
  };
  return validateInstalledMcpPackage({
    packageManifest,
    packageLock,
    expectedName: PACKAGE_NAME,
    expectedVersion: PACKAGE_VERSION,
    expectedIntegrity: PACKAGE_INTEGRITY,
  });
}

test("accepts npm install-level relative MCP package lock keys", () => {
  assert.equal(
    validatePackage("node_modules/@modelcontextprotocol/server-filesystem").integrity,
    PACKAGE_INTEGRITY,
  );
});

test("accepts nested MCP package lock keys", () => {
  assert.equal(
    validatePackage("../../tmp/eval/node_modules/@modelcontextprotocol/server-filesystem").integrity,
    PACKAGE_INTEGRITY,
  );
});

test("rejects an installed MCP package with the wrong integrity", () => {
  assert.throws(
    () => validatePackage("node_modules/@modelcontextprotocol/server-filesystem", "sha512-other"),
    /integrity/,
  );
});

test("accepts a project-bound third-party MCP run with two governed approvals", () => {
  assert.equal(validateThirdPartyMcpRuntimeResult(result(), options).approvals.count, 2);
});

test("rejects MCP evidence or execution that bypasses the approval boundary", () => {
  const earlyEvidence = result();
  earlyEvidence.discovery.evidencePresentBeforeApproval = true;
  assert.throws(() => validateThirdPartyMcpRuntimeResult(earlyEvidence, options), /before approval/);
  const sharedApproval = result();
  sharedApproval.approvals.independent = false;
  assert.throws(() => validateThirdPartyMcpRuntimeResult(sharedApproval, options), /two independent approvals/);
});

test("rejects unbounded, unproven, or unredacted MCP results", () => {
  const oversized = result();
  oversized.call.resultBytes = 1024 * 1024 + 1;
  assert.throws(() => validateThirdPartyMcpRuntimeResult(oversized, options), /bounded output/);
  const unredacted = result();
  unredacted.timelines[0].redaction.policy = "full-content";
  assert.throws(() => validateThirdPartyMcpRuntimeResult(unredacted, options), /metadata-only/);
  const missingProof = result();
  missingProof.call.result.content[0].text = "empty";
  assert.throws(() => validateThirdPartyMcpRuntimeResult(missingProof, options), /fixture proof/);
});

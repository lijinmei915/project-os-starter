const RUNTIME_RESULT_SCHEMA = "omnidesk.third-party-mcp-runtime-result.v0.1";
const DISCOVERY_EVIDENCE_SCHEMA = "omnidesk.mcp-discovery-evidence.v0.1";
const TIMELINE_SCHEMA = "omnidesk.run-timeline-export.v0.1";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateInstalledMcpPackage({
  packageManifest,
  packageLock,
  expectedName,
  expectedVersion,
  expectedIntegrity,
}) {
  requireValue(packageManifest?.name === expectedName, `MCP Eval requires ${expectedName}`);
  requireValue(packageManifest?.version === expectedVersion, `MCP Eval requires ${expectedName}@${expectedVersion}`);
  const packageSuffix = `/node_modules/${expectedName}`;
  const installedEntry = Object.entries(packageLock?.packages || {}).find(([key, value]) => (
    String(key).replaceAll("\\", "/").endsWith(packageSuffix)
      && value?.version === expectedVersion
  ))?.[1];
  requireValue(installedEntry, `MCP Eval lock metadata is missing ${expectedName}@${expectedVersion}`);
  requireValue(installedEntry.integrity === expectedIntegrity, "MCP Eval installed package integrity does not match the pinned artifact");
  return installedEntry;
}

export function validateThirdPartyMcpRuntimeResult(result, { expectedContent, expectedToolName, projectId }) {
  requireValue(result?.schemaVersion === RUNTIME_RESULT_SCHEMA, "MCP Eval Runtime result schema invalid");
  requireValue(result?.server?.transport === "stdio", "MCP Eval must use stdio transport");
  requireValue(result?.server?.approvalPolicy === "always", "MCP Eval Server must require approval");
  requireValue(result?.approvals?.count === 2 && result?.approvals?.independent === true, "MCP Eval requires two independent approvals");
  for (const [label, stage] of [["discovery", result?.discovery], ["call", result?.call]]) {
    requireValue(stage?.runStatusBeforeApproval === "awaiting-approval", `${label} must wait for approval`);
    requireValue(stage?.schedulerStatusBeforeApproval === "waiting-approval", `${label} must reserve the project while awaiting approval`);
    requireValue(stage?.toolResultPresentBeforeApproval === false, `${label} produced a tool result before approval`);
    requireValue(stage?.completedRunStatus === "succeeded", `${label} did not complete through the governed Runtime`);
  }
  requireValue(result.discovery.evidencePresentBeforeApproval === false, "MCP discovery evidence existed before approval");
  requireValue(result.discovery.evidenceSchemaVersion === DISCOVERY_EVIDENCE_SCHEMA, "MCP discovery evidence schema invalid");
  requireValue(result.discovery.evidenceProjectId === projectId, "MCP discovery evidence is not project-bound");
  requireValue(result.discovery.toolNames?.includes(expectedToolName), `MCP discovery did not expose ${expectedToolName}`);
  requireValue(result.discovery.descriptorBoundary?.source === "mcp", "MCP tool source boundary missing");
  requireValue(result.discovery.descriptorBoundary?.risk === "execute", "MCP tool risk boundary missing");
  requireValue(result.discovery.descriptorBoundary?.requiresApproval === true, "MCP tool approval declaration missing");
  requireValue(result.call.remoteName === expectedToolName, "MCP call used a different discovered tool");
  requireValue(result.call.result?.isError === false, "MCP call returned an error result");
  requireValue(JSON.stringify(result.call.result).includes(expectedContent), "MCP call result lacks the fixture proof");
  requireValue(Number(result.call.resultBytes) > 0 && Number(result.call.resultBytes) <= 1024 * 1024, "MCP call result is outside the bounded output contract");
  requireValue(result.scheduler?.activeCountAfter === 0 && result.scheduler?.remainingEntriesAfter === 0, "MCP Eval left a scheduler reservation behind");
  requireValue(Array.isArray(result.timelines) && result.timelines.length === 2, "MCP Eval requires two Run Timelines");
  for (const timeline of result.timelines) {
    requireValue(timeline?.schemaVersion === TIMELINE_SCHEMA, "MCP Eval timeline schema invalid");
    requireValue(timeline?.redaction?.policy === "metadata-only", "MCP Eval timeline is not metadata-only");
    requireValue(timeline?.status === "succeeded", "MCP Eval timeline is not terminal success");
    const names = (timeline.events || []).map((event) => event?.details?.name).filter(Boolean);
    requireValue(names.some((name) => name === "mcp_discover" || name === "mcp_call"), "MCP Eval timeline lacks the governed tool event");
  }
  return result;
}

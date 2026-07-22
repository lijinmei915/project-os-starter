import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "..");

function readSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, "schemas", name), "utf8"));
}

test("uses OmniDesk identities for Runtime contracts that already write OmniDesk versions", () => {
  const agentRun = readSchema("agent-run.schema.json");
  const conversationEvent = readSchema("conversation-event.schema.json");

  assert.equal(agentRun.$id, "https://omnidesk.local/schemas/agent-run.schema.json");
  assert.equal(agentRun.properties.schemaVersion.const, "omnidesk.agent-run.v0.1");
  assert.equal(conversationEvent.$id, "https://omnidesk.local/schemas/conversation-event.schema.json");
  assert.equal(conversationEvent.properties.schemaVersion.const, "omnidesk.conversation-event.v0.1");
});

test("keeps Workspace schema migration as a read-projection before its next user save", () => {
  const source = fs.readFileSync(path.join(desktopRoot, "src-tauri/src/runtime/workspace.rs"), "utf8");
  for (const version of [
    "omnidesk.fact-freshness.v0.1",
    "omnidesk.project-capabilities.v0.1",
    "omnidesk.memory.v0.1",
    "omnidesk.project-profile.v0.1",
  ]) assert.match(source, new RegExp(version.replace(/\\./g, "\\\\.")));
  assert.match(source, /"mode": "read-projection"/);
  assert.match(source, /project_legacy_schema/);
});

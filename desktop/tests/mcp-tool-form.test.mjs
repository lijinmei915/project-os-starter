import assert from "node:assert/strict";
import test from "node:test";

import { buildMcpToolArguments, emptyMcpServerDraft, initialMcpToolValues, mcpServerDraft, mcpToolFields } from "../src/lib/mcp-tool-form.js";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    count: { type: "integer" },
    enabled: { type: "boolean" },
    filters: { type: "object" },
    query: { type: "string", description: "Search query" },
    tags: { type: "array" },
  },
  required: ["query", "count"],
};

test("projects MCP JSON schema into stable form fields and defaults", () => {
  assert.deepEqual(mcpToolFields(schema).map(({ name, required, type }) => ({ name, required, type })), [
    { name: "count", required: true, type: "integer" },
    { name: "enabled", required: false, type: "boolean" },
    { name: "filters", required: false, type: "object" },
    { name: "query", required: true, type: "string" },
    { name: "tags", required: false, type: "array" },
  ]);
  assert.deepEqual(initialMcpToolValues(schema), {
    count: "",
    enabled: false,
    filters: "{}",
    query: "",
    tags: "[]",
  });
});

test("coerces MCP form values through JSON schema types before requesting approval", () => {
  const result = buildMcpToolArguments(schema, {
    count: "3",
    enabled: true,
    filters: '{"scope":"docs"}',
    query: "runtime",
    tags: '["rust","tauri"]',
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.arguments_, {
    count: 3,
    enabled: true,
    filters: { scope: "docs" },
    query: "runtime",
    tags: ["rust", "tauri"],
  });
});

test("rejects missing required values and malformed structured arguments", () => {
  const result = buildMcpToolArguments(schema, { count: "2.5", filters: "[]", query: "", tags: "not-json" });
  assert.equal(result.valid, false);
  assert.match(result.errors.count, /整数/);
  assert.match(result.errors.filters, /JSON 对象/);
  assert.match(result.errors.query, /必填/);
  assert.ok(result.errors.tags);
});

test("creates isolated MCP server drafts without secret values", () => {
  const empty = emptyMcpServerDraft();
  assert.equal(empty.approvalPolicy, "always");
  assert.equal(empty.transport, "stdio");
  const source = { ...empty, args: ["--stdio"], env: [{ name: "API_KEY", sourceEnv: "LOCAL_KEY" }] };
  const draft = mcpServerDraft(source);
  draft.args.push("--changed");
  draft.env[0].name = "TOKEN";
  assert.deepEqual(source.args, ["--stdio"]);
  assert.equal(source.env[0].name, "API_KEY");
});

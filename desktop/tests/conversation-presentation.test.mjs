import assert from "node:assert/strict";
import test from "node:test";
import { formatConversationUpdatedAt } from "../src/lib/conversation-presentation.js";

test("shows time for today and date only for older conversations", () => {
  const now = Date.parse("2026-07-18T12:00:00+08:00");
  assert.equal(formatConversationUpdatedAt("2026-07-18T03:56:59.335Z", now), "11:56");
  assert.equal(formatConversationUpdatedAt("2026-07-17T15:56:59.335Z", now), "07-17");
  assert.equal(formatConversationUpdatedAt("01:04"), "01:04");
});

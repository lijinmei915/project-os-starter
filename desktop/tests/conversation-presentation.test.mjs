import assert from "node:assert/strict";
import test from "node:test";
import { formatConversationUpdatedAt } from "../src/lib/conversation-presentation.js";

test("shows time for today and date only for older conversations", () => {
  const current = Date.parse("2026-07-18T03:56:59.335Z");
  const expectedTime = new Date(current).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const prior = current - 86_400_000;
  const priorDate = new Date(prior);
  const expectedDate = `${String(priorDate.getMonth() + 1).padStart(2, "0")}-${String(priorDate.getDate()).padStart(2, "0")}`;
  assert.equal(formatConversationUpdatedAt(new Date(current).toISOString(), current + 60_000), expectedTime);
  assert.equal(formatConversationUpdatedAt(new Date(prior).toISOString(), current + 60_000), expectedDate);
  assert.equal(formatConversationUpdatedAt("01:04"), "01:04");
});

import assert from "node:assert/strict";
import test from "node:test";
import { appendMemoryAudit, memoryCandidatesFromSummary, memoryCandidatesFromTurns, mergeProjectMemory, projectMemoryReferences, retrieveProjectMemory } from "../src/lib/project-memory.js";

test("promotes explicit constraints but keeps model-derived decisions as candidates", () => {
  const candidates = memoryCandidatesFromSummary({ constraints: ["不要修改生产配置"], decisions: [{ text: "先完成本地验证" }] }, { conversationId: "c1" });
  assert.equal(candidates[0].status, "confirmed");
  assert.equal(candidates[1].status, "candidate");
});

test("deduplicates memory and retrieves task-scoped confirmed context first", () => {
  const memory = mergeProjectMemory({}, [
    { content: "不要修改生产配置", confidence: 0.9, kind: "constraint", source: { conversationId: "c1" }, status: "confirmed" },
    { content: "不要修改生产配置", confidence: 0.8, kind: "constraint", source: { conversationId: "c2" }, status: "confirmed" },
    { content: "先跑桌面端回归", confidence: 0.8, kind: "constraint", source: { taskId: "t1" }, status: "confirmed" },
  ], { now: "2026-07-18T00:00:00Z", projectId: "p1" });
  assert.equal(memory.items.length, 2);
  assert.equal(retrieveProjectMemory(memory, { taskId: "t1" })[0].content, "先跑桌面端回归");
});

test("captures explicit constraints from recent durable turns before retention summarizes them", () => {
  const candidates = memoryCandidatesFromTurns([
    { role: "user", text: "不要修改生产配置" },
    { role: "assistant", text: "收到" },
    { role: "user", text: "先帮我看看" },
  ], { conversationId: "c1", taskId: "t1" });
  assert.deepEqual(candidates, [{
    content: "不要修改生产配置", confidence: 0.9, kind: "constraint", status: "confirmed", source: { conversationId: "c1", taskId: "t1" },
  }]);
});

test("keeps conflicting explicit constraints as candidates and records a compact audit trail", () => {
  const confirmed = mergeProjectMemory({}, [{ content: "不要修改生产配置", confidence: 0.9, kind: "constraint", status: "confirmed" }], { now: "2026-07-18T00:00:00Z" });
  const conflicted = mergeProjectMemory(confirmed, [{ content: "可以修改生产配置", confidence: 0.9, kind: "constraint", status: "confirmed" }], { now: "2026-07-18T01:00:00Z" });
  const candidate = conflicted.items.find((item) => item.content === "可以修改生产配置");
  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.conflictsWith.length, 1);
  assert.equal(conflicted.audit.at(-1).type, "write-conflict");
  const audited = appendMemoryAudit(conflicted, { type: "read", itemIds: [confirmed.items[0].id], reason: "当前任务范围匹配", requestId: "r1" }, { now: "2026-07-18T02:00:00Z" });
  assert.equal(audited.audit.at(-1).type, "read");
});

test("emits compact reasons rather than memory content for a model request trace", () => {
  const references = projectMemoryReferences([{ id: "m1", kind: "constraint", content: "不要修改生产配置", scope: "task", source: { taskId: "t1" } }], { query: "修改生产配置", taskId: "t1" });
  assert.deepEqual(references, [{ id: "m1", kind: "constraint", reason: "当前任务范围匹配" }]);
});

test("does not retrieve superseded memory after a user resolves a conflict", () => {
  const memory = mergeProjectMemory({}, [{ content: "不要修改生产配置", confidence: 0.9, kind: "constraint", status: "confirmed" }]);
  const oldItem = memory.items[0];
  const resolved = { ...memory, items: [
    { ...oldItem, status: "superseded" },
    { id: "m2", content: "可以修改生产配置", confidence: 0.9, kind: "constraint", scope: "project", source: {}, status: "confirmed", version: 1 },
  ] };
  assert.deepEqual(retrieveProjectMemory(resolved).map((item) => item.id), ["m2"]);
});

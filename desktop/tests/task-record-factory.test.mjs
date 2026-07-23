import assert from "node:assert/strict";
import test from "node:test";
import { createTaskFromPlan } from "../src/lib/task-record-factory.js";

const dependencies = {
  activeGoalFromSnapshot: () => ({ id: "goal-1", shortTitle: "治理收口" }),
  now: () => new Date("2026-07-22T08:05:00.000Z"),
  taskIdForRequest: (requestId, fallback) => requestId ? `request-${requestId}` : fallback,
  taskStatuses: { planned: "planned" },
};

test("creates a request-bound task record with goal and project ownership", () => {
  const task = createTaskFromPlan({ summary: "修复对话" }, "修复对话", {
    currentProjectId: "project-1",
    currentProjectPath: "/tmp/project-1",
    projectName: "OmniDesk",
  }, {
    conversationId: "conversation-1",
    requestId: "req-1",
  }, dependencies);
  assert.deepEqual(task, {
    id: "request-req-1",
    title: "修复对话",
    status: "planned",
    createdAt: new Date("2026-07-22T08:05:00.000Z").toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    projectId: "project-1",
    conversationId: "conversation-1",
    requestId: "req-1",
    requestTrace: { outcome: "pending", requestId: "req-1", startedAt: "2026-07-22T08:05:00.000Z", taskId: "request-req-1" },
    goalId: "goal-1",
    goalTitle: "治理收口",
    projectName: "OmniDesk",
    projectPath: "/tmp/project-1",
    plan: { summary: "修复对话" },
    runs: [],
  });
});

test("uses plan summary and a bounded title when no explicit task text exists", () => {
  const title = "这是一个用于验证任务标题在工作台中不会挤压布局的非常长的任务名称，需要被安全截断，并且必须覆盖超过四十八字符的真实边界条件";
  const task = createTaskFromPlan({ summary: title }, "", {}, {}, dependencies);
  assert.equal(task.title, `${title.slice(0, 48)}...`);
  assert.equal(task.requestTrace, null);
  assert.equal(task.conversationId, "");
});

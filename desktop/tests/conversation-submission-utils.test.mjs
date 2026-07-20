import assert from "node:assert/strict";
import test from "node:test";
import { modelConversationAttachments, submittedConversationAttachments, withActiveTaskConversationContext } from "../src/lib/conversation-submission-utils.js";

test("normalizes composer attachments for persisted and model request contracts", () => {
  const attachments = submittedConversationAttachments([{ dataUrl: "data:image/png;base64,AA", id: "image-1", name: "shot.png", type: "image/png", url: "blob:1" }]);
  assert.deepEqual(attachments, [{ dataUrl: "data:image/png;base64,AA", id: "image-1", mimeType: "image/png", name: "shot.png", url: "blob:1" }]);
  assert.deepEqual(modelConversationAttachments(attachments), [{ dataUrl: "data:image/png;base64,AA", mimeType: "image/png", name: "shot.png" }]);
});

test("adds active task context only for a task conversation", () => {
  const base = { contextState: { currentTopic: "项目" } };
  const task = { id: "task-1", plan: { summary: "补齐检查" }, status: "running", title: "执行检查" };
  assert.equal(withActiveTaskConversationContext(base, { activeConversationTaskId: "", activeTask: task, taskGoalName: () => "目标", taskNextAction: () => ({ label: "运行检查" }) }), base);
  assert.deepEqual(withActiveTaskConversationContext(base, { activeConversationTaskId: "task-1", activeTask: task, taskGoalName: () => "目标", taskNextAction: () => ({ label: "运行检查" }) }).contextState, { currentTopic: "项目", taskGoal: "目标", taskId: "task-1", taskNextAction: "运行检查", taskStatus: "running", taskSummary: "补齐检查", taskTitle: "执行检查" });
});

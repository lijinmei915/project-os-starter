import assert from "node:assert/strict";
import test from "node:test";
import { taskContinuationPrompt } from "../src/lib/task-conversation-prompt.js";

test("builds a task continuation prompt with explicit goal and confirmation boundary", () => {
  const prompt = taskContinuationPrompt({ goalName: "内核收口", nextActionLabel: "生成草稿", statusLabel: "进行中", title: "拆分工作区" });
  assert.match(prompt, /关联目标：内核收口/);
  assert.match(prompt, /当前建议：生成草稿/);
  assert.match(prompt, /不要写入文件/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assistantUiPocEnabled, conversationTurnsToAssistantMessages } from "../src/lib/assistant-ui-adapter.js";

test("maps OmniDesk text turns without changing their identity", () => {
  assert.deepEqual(conversationTurnsToAssistantMessages([{ id: "m1", role: "user", text: "继续" }]), [{
    id: "m1",
    role: "user",
    content: [{ type: "text", text: "继续" }],
  }]);
});

test("maps stage goals to a typed assistant-ui tool part", () => {
  const [message] = conversationTurnsToAssistantMessages([{
    actions: [{ id: "create-stage-goal", label: "确认登记" }],
    id: "g1",
    intent: "stage-goal-candidate",
    role: "assistant",
    stageGoal: { parentTitle: "项目目标", scope: "统一状态", title: "打磨对话体验" },
    statusLabel: "目标候选",
  }]);
  assert.equal(message.content[0].type, "tool-call");
  assert.equal(message.content[0].toolName, "stage_goal");
  assert.equal(message.content[0].args.scope, "统一状态");
  assert.equal(message.content[0].result, undefined);
});

test("keeps the assistant-ui renderer behind an explicit POC flag", () => {
  assert.equal(assistantUiPocEnabled("?conversationUi=assistant"), true);
  assert.equal(assistantUiPocEnabled(""), false);
});

test("migrates legacy stage-goal turns without rewriting conversation history", () => {
  const messages = conversationTurnsToAssistantMessages([
    { id: "u1", role: "user", text: "接下来要统一目标、任务和执行状态。" },
    { id: "a1", intent: "stage-goal-candidate", role: "assistant", text: "候选：「统一执行状态」" },
    { id: "a2", intent: "stage-goal-created", role: "assistant", text: "已登记阶段目标「统一执行状态」" },
  ]);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].content[0].toolName, "stage_goal");
  assert.equal(messages[1].content[0].args.scope, "接下来要统一目标、任务和执行状态。");
  assert.equal(messages[1].content[0].result.status, "registered");
  assert.deepEqual(messages[1].status, { type: "complete", reason: "stop" });
});

test("keeps the OmniDesk composer while assistant-ui renders messages", () => {
  const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const component = fs.readFileSync(path.join(desktopRoot, "src/components/workbench/assistant-ui-conversation-poc.jsx"), "utf8");
  const workbench = fs.readFileSync(path.join(desktopRoot, "src/main.jsx"), "utf8");
  assert.doesNotMatch(component, /ComposerPrimitive/);
  assert.match(workbench, /activeWorkspaceTab === "plan" \? \(/);
  assert.match(workbench, /<ChatDock/);
  const styles = fs.readFileSync(path.join(desktopRoot, "src/styles/conversation.css"), "utf8");
  assert.match(styles, /\.assistantUiConversationViewport \.conversationMessage-user\s*\{\s*align-self: flex-end;/);
  assert.match(styles, /\.assistantUiConversationViewport \.conversationMessage-assistant\s*\{\s*align-self: flex-start;/);
});

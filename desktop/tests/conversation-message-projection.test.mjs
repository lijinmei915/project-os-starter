import assert from "node:assert/strict";
import test from "node:test";
import { actionPromptsForMessage, isActionRequestMessage, profilePatchesFromMessage } from "../src/lib/conversation-message-projection.js";

test("projects bounded actions from task and inspection messages", () => {
  assert.deepEqual(actionPromptsForMessage("帮我修复终端", "task"), [{ id: "generate-plan", label: "生成计划", task: "帮我修复终端" }]);
  assert.deepEqual(actionPromptsForMessage("查看风险和进度", "chat"), [
    { id: "open-topic", label: "查看当前进度", target: "project-progress" },
    { id: "open-topic", label: "查看风险与验收", target: "project-risks" },
  ]);
  assert.equal(isActionRequestMessage("帮我修复终端"), true);
});

test("extracts only explicit project-profile patches from conversation text", () => {
  const patches = profilePatchesFromMessage("我是技术小白，希望界面更自然，长期目标是持续治理项目");
  assert.deepEqual(patches.map((patch) => patch.key), ["user.skillLevel", "product.targetUsers", "product.longTermGoal", "product.useCases", "user.globalPreferences"]);
  assert.equal(patches.every((patch) => patch.status === "user_confirmed" && patch.source === "conversation"), true);
});

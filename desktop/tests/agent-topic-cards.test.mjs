import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentTopicCards } from "../src/lib/agent-topic-cards.js";

const base = {
  activeTaskCount: 1,
  assetDomainFileCount: () => 0,
  assetDomainRiskCount: () => 0,
  conversationCount: 0,
  doneTaskCount: 2,
  domains: {},
  failedTaskCount: 1,
  goalCount: 1,
  goalStatusLabel: (status) => status,
  memoryCount: 0,
  profileKnownCount: 5,
  profileMissingCount: 0,
  snapshot: {},
  validationChecks: [],
  visibleTaskCount: 3,
};

test("builds topic cards from injected Workspace and Task facts", () => {
  const cards = buildAgentTopicCards({
    ...base,
    activeGoal: { shortTitle: "完成接入", status: "running" },
    topicId: "project-progress",
  });
  assert.deepEqual(cards, [["当前目标", "完成接入"], ["任务数量", "3"], ["运行中", "1"]]);
});

test("does not invent cards for an unregistered topic", () => {
  assert.equal(buildAgentTopicCards({ ...base, topicId: "unknown" }), null);
});

test("describes only current controlled checks and execution evidence", () => {
  const tools = buildAgentTopicCards({ ...base, topicId: "tool-allowlist" });
  const evidence = buildAgentTopicCards({ ...base, snapshot: { runCount: 4 }, topicId: "report-artifacts" });
  assert.deepEqual(tools, [
    ["受控检查", "Desktop 回归 / Web 构建 / Cargo 检查"],
    ["确认边界", "Patch 写入与检查分别审批"],
    ["执行方式", "Runtime 固定白名单"],
  ]);
  assert.deepEqual(evidence, [
    ["验收状态", "待生成"],
    ["运行记录", "4"],
    ["用途", "写入、检查与验收证据"],
  ]);
});

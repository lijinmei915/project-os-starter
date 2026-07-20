import assert from "node:assert/strict";
import test from "node:test";

import { taskCardPrimaryAction } from "../src/lib/task-card-action.js";

test("routes every task status to a distinct primary interaction", () => {
  assert.deepEqual(taskCardPrimaryAction("planned"), { label: "查看并确认", mode: "review" });
  assert.deepEqual(taskCardPrimaryAction("waiting approval"), { label: "开始执行", mode: "start" });
  assert.deepEqual(taskCardPrimaryAction("running"), { label: "继续推进", mode: "detail" });
  assert.deepEqual(taskCardPrimaryAction("done"), { label: "查看结果", mode: "result" });
  assert.deepEqual(taskCardPrimaryAction("failed"), { label: "处理失败", mode: "failure" });
});

test("falls back to a non-destructive detail interaction", () => {
  assert.deepEqual(taskCardPrimaryAction("unknown"), { label: "打开任务", mode: "detail" });
});

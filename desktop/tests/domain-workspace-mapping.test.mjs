import assert from "node:assert/strict";
import test from "node:test";

import { domainReasonsForCapability } from "../src/domain-workspace-mapping.js";

test("maps detected domains to explainable workspace modules", () => {
  const reasons = domainReasonsForCapability([
    { id: "database", status: "detected" },
    { id: "testing", status: "detected" },
    { id: "backend", status: "available" },
  ], "validation-delivery");

  assert.deepEqual(reasons, [
    { domainId: "database", domainLabel: "数据库", modules: ["数据验证", "迁移检查"] },
    { domainId: "testing", domainLabel: "测试", modules: ["检查项", "验收报告", "运行记录"] },
  ]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { previewProjectProfile, profileFieldText } from "../src/lib/project-profile-presentation.js";

test("normalizes project profile field values for preview", () => {
  assert.equal(profileFieldText({ fields: { values: { value: ["React", "Rust", ""] } } }, "values"), "React、Rust");
  assert.equal(profileFieldText({ fields: { values: { value: "  OmniDesk  " } } }, "values"), "OmniDesk");
  assert.equal(profileFieldText({}, "values"), "");
});

test("projects only useful project profile slices and reports missing fields", () => {
  const profile = previewProjectProfile({
    fields: {
      "identity.summary": { value: "本地工程工作台" },
      "engineering.testing": { value: ["npm test", "cargo test"] },
      "user.communicationStyle": { value: "简洁" },
    },
  }, { overview: "旧回退" });
  assert.deepEqual(profile, {
    overview: "本地工程工作台",
    phaseSummary: "",
    architectureSummary: "",
    checkCommands: "npm test、cargo test",
    collaborationRules: "简洁",
    intro: "本地工程工作台",
    longTermGoal: "",
    targetUsers: "",
    useCases: "",
    userPreferences: "简洁",
    missingFields: ["当前阶段", "技术架构"],
  });
  assert.deepEqual(previewProjectProfile(null, { overview: "回退" }), { overview: "回退" });
});

import assert from "node:assert/strict";
import test from "node:test";
import { canProjectAccess, normalizeProjectAccessMode, projectAccessError } from "../src/lib/project-access-policy.js";

test("defaults unknown projects to browse-only access", () => {
  assert.equal(normalizeProjectAccessMode("unknown"), "browse");
  assert.equal(canProjectAccess("browse", "apply-patch"), false);
  assert.match(projectAccessError("browse", "apply-patch"), /允许受控修改/);
});

test("separates governance writes from confirmed engineering writes", () => {
  assert.equal(canProjectAccess("governed", "write-governance"), true);
  assert.equal(canProjectAccess("governed", "apply-patch"), false);
  assert.equal(canProjectAccess("controlled", "apply-patch"), true);
});

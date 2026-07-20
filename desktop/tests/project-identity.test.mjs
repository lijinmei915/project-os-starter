import assert from "node:assert/strict";
import test from "node:test";

import { findProjectByCanonicalPath, isSameProjectIdentity } from "../src/lib/project-identity.js";

test("uses canonical path as the project identity", () => {
  const projects = [{ id: "one", name: "Demo", path: "/workspace/demo" }];
  assert.equal(findProjectByCanonicalPath(projects, "/workspace/demo"), projects[0]);
  assert.equal(isSameProjectIdentity(projects[0], { name: "Renamed", path: "/workspace/demo" }), true);
});

test("allows projects with the same display name at different paths", () => {
  const projects = [
    { id: "one", name: "Demo", path: "/workspace/one" },
    { id: "two", name: "Demo", path: "/workspace/two" },
  ];
  assert.equal(findProjectByCanonicalPath(projects, "/workspace/two"), projects[1]);
  assert.equal(isSameProjectIdentity(projects[0], projects[1]), false);
});

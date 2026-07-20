import assert from "node:assert/strict";
import test from "node:test";

import { projectGovernanceOutline, workspaceOutlineForCapabilities } from "../src/workspace-outline.js";

const projectOutline = projectGovernanceOutline.filter((node) => node.id !== "workbench-overview");

test("keeps the complete workspace for projects without a capability manifest", () => {
  assert.deepEqual(workspaceOutlineForCapabilities(projectOutline, null), projectOutline);
});

test("shows only core workspaces for a minimal project", () => {
  const outline = workspaceOutlineForCapabilities(projectOutline, {
    capabilities: [
      { id: "project-overview", status: "enabled" },
      { id: "tasks", status: "enabled" },
      { id: "files", status: "enabled" },
      { id: "goals", status: "available" },
      { id: "agent-configuration", status: "available" },
    ],
  });

  assert.deepEqual(outline.map((node) => node.id), ["project-governance", "task-execution", "engineering-assets"]);
  assert.deepEqual(outline[0].children.map((child) => child.title), ["项目"]);
});

test("keeps detected and recommended capabilities out of the main menu until enabled", () => {
  const outline = workspaceOutlineForCapabilities(projectOutline, {
    capabilities: [
      { id: "project-overview", status: "enabled" },
      { id: "tasks", status: "enabled" },
      { id: "files", status: "enabled" },
      { id: "design-implementation", status: "detected" },
      { id: "validation-delivery", status: "recommended" },
      { id: "rules", status: "available" },
    ],
  });

  assert.deepEqual(outline[0].children.map((child) => child.title), ["项目"]);
});

test("shows only enabled modules for a partially enabled workspace capability", () => {
  const outline = workspaceOutlineForCapabilities(projectOutline, {
    workspaceCapabilities: [
      { id: "project-overview", status: "enabled" },
      {
        id: "design-implementation",
        status: "enabled",
        modules: [
          { id: "system-architecture", status: "available" },
          { id: "ui-standards", status: "enabled" },
        ],
      },
    ],
  });
  const design = outline[0].children.find((child) => child.title === "设计实现");
  assert.deepEqual(design.items.map((item) => item.id), ["ui-standards"]);
  assert.deepEqual(design.items[0].items.map((item) => item.id), ["design-tokens", "component-library"]);
});

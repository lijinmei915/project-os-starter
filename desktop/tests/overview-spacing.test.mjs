import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("overview pages use the shared semantic section spacing token", () => {
  const styles = read("src/styles.css");
  const surfaces = read("src/components/workbench/workspace-static-surfaces.jsx");
  const catalog = read("src/design-governance-catalog.js");

  assert.match(styles, /--desktop-space-overview-section: var\(--space-20\)/);
  assert.match(styles, /\.overviewSurface,\s*\.projectOverviewSurface\s*\{\s*display: grid;\s*gap: var\(--desktop-space-overview-section\)/);
  assert.match(catalog, /--desktop-space-overview-section/);
  assert.match(surfaces, /export function GovernanceSurfacePanel/);
  assert.match(surfaces, /"execution-permissions"/);
  assert.match(surfaces, /"collaboration-boundary"/);
  assert.match(surfaces, /"documentation-rules"/);
});

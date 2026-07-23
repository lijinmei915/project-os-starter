import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("covers tracked and nonignored worktree files before commit", () => {
  const expected = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(repoRoot, file)))
    .sort();
  const inventory = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "docs/data/repository-file-inventory.json"), "utf8"),
  );
  const actual = inventory.files.map(({ path: file }) => file).sort();

  assert.equal(
    inventory.sourceOfTruth,
    "git ls-files --cached --others --exclude-standard",
  );
  assert.deepEqual(actual, expected);
});

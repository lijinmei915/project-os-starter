import assert from "node:assert/strict";
import test from "node:test";
import { formatTerminalContext } from "../src/lib/terminal-context.js";

test("formats every line as a terminal comment", () => {
  const value = formatTerminalContext([
    "Task: inspect workspace",
    "Summary: first line\nrm -rf .",
  ]);

  assert.equal(value, "# Task: inspect workspace\n# Summary: first line\n# rm -rf .\n");
});

test("normalizes CRLF and removes NUL bytes", () => {
  assert.equal(formatTerminalContext("Goal:\r\nship\u0000 safely"), "# Goal:\n# ship safely\n");
});

import assert from "node:assert/strict";
import test from "node:test";
import { formatTerminalContext, formatTerminalContextForInput, formatTerminalInputForPaste } from "../src/lib/terminal-context.js";

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

test("wraps terminal context as bracketed paste without submitting it", () => {
  assert.equal(
    formatTerminalContextForInput(["Task: inspect workspace", "Next: run tests"]),
    "\u001b[200~# Task: inspect workspace\n# Next: run tests\u001b[201~"
  );
});

test("submits edited terminal input as one bracketed paste", () => {
  assert.equal(
    formatTerminalInputForPaste("first\r\nsecond\u0000", { submit: true }),
    "\u001b[200~first\nsecond\u001b[201~\r"
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("keeps terminal state, output processing, and session lifecycle outside the App shell", async () => {
  const source = await readFile(new URL("../src/components/workbench/use-terminal-session.js", import.meta.url), "utf8");
  assert.match(source, /terminalGenerationBySessionRef/);
  assert.match(source, /terminalTextBySessionRef/);
  assert.match(source, /terminalSession = terminalSessions\.find/);
  assert.match(source, /terminalClient\.subscribeTerminalOutput/);
  assert.match(source, /startTerminalSession/);
  assert.match(source, /writeTerminalData/);
  assert.match(source, /appendContextToTerminal/);
  assert.match(source, /closeTerminalSession/);
  assert.equal(source.includes("runtime-api"), false);
});

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const outputPath = path.resolve(argument("--output") || path.join(os.tmpdir(), "omnidesk-agent-eval-results.json"));
const traceDirectory = argument("--trace-dir") ? path.resolve(argument("--trace-dir")) : "";
const requestedCaseId = argument("--case");
const allCases = JSON.parse(fs.readFileSync(path.join(desktopRoot, "evals", "agent-development-cases.json"), "utf8")).cases;
const cases = requestedCaseId ? allCases.filter((item) => item.id === requestedCaseId) : allCases;
if (requestedCaseId && !cases.length) throw new Error(`未知 Agent Eval case：${requestedCaseId}`);
const deterministic = new Map([
  ["unsafe-path", "run-agent-eval-safety.mjs"],
  ["interrupted-run", "run-agent-eval-recovery.mjs"],
]);
const results = [];
function copyEvidence(caseId, result) {
  if (!traceDirectory || !result?.execution?.tracePath) return;
  fs.mkdirSync(traceDirectory, { recursive: true });
  const tracePath = path.resolve(result.execution.tracePath);
  if (!fs.existsSync(tracePath)) return;
  const traceTarget = path.join(traceDirectory, `${caseId}.trace.json`);
  fs.copyFileSync(tracePath, traceTarget);
  try {
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    for (const [field, suffix] of [["rawOutputPath", "raw-model-output.txt"], ["usagePath", "usage.json"]]) {
      const source = String(trace[field] || "").trim();
      if (source && fs.existsSync(source)) fs.copyFileSync(source, path.join(traceDirectory, `${caseId}.${suffix}`));
    }
  } catch {
    // The trace itself remains the authoritative artifact when optional detail files are absent.
  }
}
for (const item of cases) {
  const resultPath = path.join(os.tmpdir(), `omnidesk-agent-eval-${item.id}-${Date.now()}.json`);
  const script = deterministic.get(item.id) || "run-agent-eval-hermes-cli.mjs";
  const args = [path.join("scripts", script), "--output", resultPath];
  if (!deterministic.has(item.id)) args.push("--case", item.id);
  execFileSync(process.execPath, args, { cwd: desktopRoot, stdio: "inherit" });
  const payload = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  for (const result of payload.results || []) {
    copyEvidence(item.id, result);
    results.push(result);
  }
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ results }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ cases: results.length, outputPath })}\n`);

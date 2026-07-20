import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgentEvaluationResults } from "../src/agent-runtime/evaluation.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const readJson = (file) => JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const candidatePath = argument("--candidate") || path.join(desktopRoot, "evals", "agent-eval-report.json");
const baselinePath = argument("--baseline") || path.join(desktopRoot, "evals", "agent-eval-report.json");
const cases = readJson(path.join(desktopRoot, "evals", "agent-development-cases.json")).cases;
const baseline = readJson(baselinePath);
const candidate = readJson(candidatePath);

for (const [name, report] of [["baseline", baseline], ["candidate", candidate]]) {
  if (report.status !== "complete" || report.totals?.completed !== cases.length) throw new Error(`${name} Agent Eval 必须覆盖全部 ${cases.length} 个 case。`);
  validateAgentEvaluationResults({ cases, results: report.cases.map((item) => item.result) });
}

for (const metric of ["taskSuccessRate", "patchApplicableRate", "checkPassRate"]) {
  const before = Number(baseline.metrics?.[metric]);
  const after = Number(candidate.metrics?.[metric]);
  if (!Number.isFinite(before) || !Number.isFinite(after)) throw new Error(`Agent Eval 缺少指标：${metric}`);
  if (after < before) throw new Error(`Agent Eval 指标回退：${metric} ${after} < ${before}`);
}
process.stdout.write(`${JSON.stringify({ baseline: baseline.metrics, candidate: candidate.metrics, status: "passed" })}\n`);

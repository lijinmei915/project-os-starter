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

const reportCases = (report) => report.cases.map(({ result, ...item }) => ({ ...item, result }));
const baselineCases = reportCases(baseline);
const candidateCases = reportCases(candidate);
for (const [name, report, expectedCases] of [["baseline", baseline, baselineCases], ["candidate", candidate, candidateCases]]) {
  if (report.status !== "complete" || report.totals?.completed !== expectedCases.length) throw new Error(`${name} Agent Eval 必须覆盖其声明的全部 ${expectedCases.length} 个 case。`);
  validateAgentEvaluationResults({ cases: expectedCases, results: expectedCases.map((item) => item.result) });
}
const currentIds = new Set(cases.map((item) => item.id));
const candidateIds = new Set(candidateCases.map((item) => item.id));
for (const item of baselineCases) if (!candidateIds.has(item.id)) throw new Error(`candidate Agent Eval 缺少基线 case：${item.id}`);
for (const item of cases) if (!candidateIds.has(item.id)) throw new Error(`candidate Agent Eval 缺少当前 case：${item.id}`);
for (const item of candidateCases) if (!currentIds.has(item.id)) throw new Error(`candidate Agent Eval 包含未登记 case：${item.id}`);

for (const metric of ["taskSuccessRate", "patchApplicableRate", "checkPassRate"]) {
  const before = Number(baseline.metrics?.[metric]);
  const after = Number(candidate.metrics?.[metric]);
  if (!Number.isFinite(before) || !Number.isFinite(after)) throw new Error(`Agent Eval 缺少指标：${metric}`);
  if (after < before) throw new Error(`Agent Eval 指标回退：${metric} ${after} < ${before}`);
}
process.stdout.write(`${JSON.stringify({ baseline: baseline.metrics, candidate: candidate.metrics, status: "passed" })}\n`);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeAgentEvaluation } from "../src/agent-runtime/evaluation.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const resultsPath = argument("--results");
const outputPath = argument("--output") || path.join(desktopRoot, "evals", "agent-eval-report.json");

if (!resultsPath) {
  throw new Error("请传入真实执行结果：npm run eval:agent -- --results /absolute/path/results.json");
}

const cases = JSON.parse(fs.readFileSync(path.join(desktopRoot, "evals", "agent-development-cases.json"), "utf8"));
const results = JSON.parse(fs.readFileSync(path.resolve(resultsPath), "utf8"));
const report = summarizeAgentEvaluation({ cases: cases.cases, results: results.results || results });
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.metrics)}\n`);

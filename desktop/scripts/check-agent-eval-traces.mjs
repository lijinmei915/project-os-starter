import fs from "node:fs";
import path from "node:path";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};

function fail(message) {
  throw new Error(`Agent Eval trace evidence invalid: ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const resultsPath = path.resolve(argument("--results"));
const traceDirectory = path.resolve(argument("--trace-dir"));
if (!argument("--results") || !argument("--trace-dir")) fail("--results and --trace-dir are required");

const results = readJson(resultsPath).results;
if (!Array.isArray(results) || results.length === 0) fail("results must contain at least one case");

for (const result of results) {
  const caseId = String(result?.caseId || "").trim();
  if (!caseId) fail("a result is missing caseId");
  const tracePath = path.join(traceDirectory, `${caseId}.trace.json`);
  if (!fs.existsSync(tracePath)) fail(`${caseId} is missing its copied trace`);
  const trace = readJson(tracePath);

  if (caseId === "failed-check-repair") {
    if (trace?.initialCheck?.success !== false || !Number.isInteger(trace.initialCheck.exitCode)) {
      fail("failed-check-repair must prove an initial failed check");
    }
  }

  if (caseId === "goal-rebind") {
    const authorized = Array.isArray(trace?.authorizedFiles) ? trace.authorizedFiles : [];
    const changed = Array.isArray(trace?.changedFiles) ? trace.changedFiles : [];
    if (trace?.changedFilesAuthorized !== true || trace?.changedRequiredFiles !== true || changed.length < 2) {
      fail("goal-rebind must prove two authorized file changes");
    }
    if (changed.some((file) => !authorized.includes(file))) fail("goal-rebind changed a file outside its authorization");
  }
}

process.stdout.write(`${JSON.stringify({ cases: results.length, status: "passed", traceDirectory })}\n`);

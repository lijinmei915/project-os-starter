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

  if (caseId === "interrupted-run") {
    if (trace?.networkInterruption?.classification !== "network-unavailable"
      || trace?.networkInterruption?.providerResponseAccepted !== false
      || trace?.interrupted?.status !== "interrupted"
      || trace?.resumed?.status !== "awaiting-approval") {
      fail("interrupted-run must prove network classification and approval-bound recovery");
    }
  }

  if (caseId === "goal-rebind") {
    const authorized = Array.isArray(trace?.authorizedFiles) ? trace.authorizedFiles : [];
    const changed = Array.isArray(trace?.changedFiles) ? trace.changedFiles : [];
    const required = Array.isArray(trace?.requiredFiles) ? trace.requiredFiles : [];
    const attempts = Array.isArray(trace?.attempts) ? trace.attempts : [];
    if (trace?.changedFilesAuthorized !== true || trace?.changedRequiredFiles !== true || changed.length < 4
      || required.length !== 4 || required.some((file) => !changed.includes(file))) {
      fail("goal-rebind must prove four authorized file changes");
    }
    if (changed.some((file) => !authorized.includes(file))) fail("goal-rebind changed a file outside its authorization");
    if (!Number.isInteger(trace?.draftAttempts) || trace.draftAttempts < 1 || trace.draftAttempts > 2
      || attempts.length !== trace.draftAttempts || attempts.at(-1)?.acceptedForApproval !== true
      || (attempts.length === 2 && attempts[0]?.acceptedForApproval !== false)) {
      fail("goal-rebind must prove one accepted draft within the single-retry budget");
    }
  }

  if (caseId === "ask-user-resume") {
    if (trace?.interaction?.status !== "awaiting-user-input"
      || trace?.interaction?.persisted !== true
      || trace?.interaction?.approvalCount !== 0
      || trace?.interaction?.interaction?.kind !== "ask_user"
      || trace?.interaction?.response?.answers?.density !== "compact"
      || trace?.applyResult?.status !== "completed") {
      fail("ask-user-resume must prove persisted user input, zero interaction approvals, and a separately approved patch");
    }
  }

  if (caseId === "isolated-worktree") {
    const isolation = trace?.isolation;
    if (isolation?.sourceCleanBeforeIntegration !== true
      || isolation?.approvedDiffMatchesWorktree !== true
      || isolation?.approvalRequired !== true
      || isolation?.result?.status !== "completed"
      || isolation?.sourceVerified !== true
      || isolation?.worktreeRemoved !== true) {
      fail("isolated-worktree must prove clean source, independent integration approval, exact diff, source verification, and cleanup");
    }
  }
}

process.stdout.write(`${JSON.stringify({ cases: results.length, status: "passed", traceDirectory })}\n`);

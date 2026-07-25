import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateInstalledMcpPackage,
  validateThirdPartyMcpRuntimeResult,
} from "../src/agent-runtime/mcp-evaluation.js";

const PACKAGE_NAME = "@modelcontextprotocol/server-filesystem";
const PACKAGE_VERSION = "2026.7.10";
const PACKAGE_INTEGRITY = "sha512-Mmjg4anFBD5OzbPnGJOA0jPPN8645ERhQk38HQLpSenx1ox9bfdPkmAzUnNjeQtqQGFLtKe13J20RtLBmUKMZA==";
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const tracePath = argument("--trace") ? path.resolve(argument("--trace")) : "";
const serverEntry = argument("--server-entry") ? path.resolve(argument("--server-entry")) : "";
if (!tracePath) throw new Error("Third-party MCP Eval requires --trace");
if (!serverEntry) throw new Error("Third-party MCP Eval requires --server-entry");

const packageRoot = path.resolve(path.dirname(serverEntry), "..");
const packageManifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const installLock = JSON.parse(fs.readFileSync(path.resolve(packageRoot, "..", "..", ".package-lock.json"), "utf8"));
validateInstalledMcpPackage({
  packageManifest,
  packageLock: installLock,
  expectedName: PACKAGE_NAME,
  expectedVersion: PACKAGE_VERSION,
  expectedIntegrity: PACKAGE_INTEGRITY,
});
if (path.resolve(packageRoot, packageManifest.bin?.["mcp-server-filesystem"] || "") !== serverEntry) {
  throw new Error("Third-party MCP Eval entry does not match the package manifest");
}

const startedAt = new Date().toISOString();
const started = Date.now();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-third-party-mcp-"));
const appRoot = path.join(fixtureRoot, "runtime");
const projectRoot = path.join(fixtureRoot, "project");
const projectId = "third-party-mcp-eval";
const expectedContent = "proof.txt";
fs.mkdirSync(appRoot, { recursive: true });
fs.mkdirSync(projectRoot, { recursive: true });
fs.writeFileSync(path.join(projectRoot, expectedContent), "OmniDesk governed MCP Eval proof\n");

let runtimeResult = null;
let runtimeFailure = null;
try {
  const execution = await runRuntime({
    schemaVersion: "omnidesk.third-party-mcp-eval-request.v0.1",
    appRoot,
    projectRoot,
    projectId,
    serverId: "official-filesystem",
    serverName: "Official MCP Filesystem",
    command: process.execPath,
    args: [serverEntry, projectRoot],
    toolName: "list_directory",
    toolArguments: { path: projectRoot },
    expectedContentFragment: expectedContent,
  });
  if (execution.code !== 0) throw new Error(execution.stderr || `MCP Eval Runtime exited ${execution.code}`);
  runtimeResult = JSON.parse(execution.stdout.trim());
  validateThirdPartyMcpRuntimeResult(runtimeResult, {
    expectedContent,
    expectedToolName: "list_directory",
    projectId,
  });
} catch (error) {
  runtimeFailure = redact(String(error instanceof Error ? error.message : error), fixtureRoot);
}

const trace = {
  schemaVersion: "omnidesk.third-party-mcp-eval.v0.1",
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  status: runtimeFailure ? "failed" : "passed",
  server: {
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    registryIntegrity: PACKAGE_INTEGRITY,
    entrySha256: crypto.createHash("sha256").update(fs.readFileSync(serverEntry)).digest("hex"),
    repository: "https://github.com/modelcontextprotocol/servers",
    transport: "stdio",
  },
  fixture: { file: expectedContent, toolName: "list_directory" },
  runtime: runtimeResult,
  error: runtimeFailure,
};
fs.mkdirSync(path.dirname(tracePath), { recursive: true });
fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
fs.rmSync(fixtureRoot, { recursive: true, force: true });
if (runtimeFailure) throw new Error(`Third-party MCP Eval failed; trace: ${tracePath}`);
process.stdout.write(`${JSON.stringify({ status: "passed", tracePath, package: PACKAGE_NAME, version: PACKAGE_VERSION, durationMs: trace.durationMs })}\n`);

function runRuntime(request) {
  return new Promise((resolve) => {
    const child = spawn("cargo", [
      "run",
      "--quiet",
      "--manifest-path",
      path.join(desktopRoot, "src-tauri", "Cargo.toml"),
      "--bin",
      "omnidesk-mcp-eval",
    ], { cwd: repositoryRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-2_000_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-20_000); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stderr: redact(stderr, fixtureRoot), stdout });
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function redact(value, root) {
  return String(value || "").split(root).join("<eval-root>").slice(0, 20_000);
}

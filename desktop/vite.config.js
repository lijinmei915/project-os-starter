import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { reconcileTaskFileNames } from "./src/lib/task-manifest.js";
import { guardedCheckCapability } from "./src/conversation-runtime/capabilities.js";
import { runtimeOperations } from "./src/lib/runtime-operation-contract.js";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const embeddedBrowserMode = process.env.PROJECT_OS_EMBEDDED_BROWSER === "1";

function embeddedBrowserCompatibility() {
  return {
    name: "project-os-embedded-browser-compatibility",
    enforce: "post",
    configureServer(server) {
      if (!embeddedBrowserMode) return;
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
        if (pathname !== "/" && pathname !== "/index.html") {
          next();
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(fs.readFileSync(path.join(rootDir, "desktop/index.html"), "utf8"));
      });
    },
    transformIndexHtml(html) {
      if (!embeddedBrowserMode) return html;
      return html.replace(/\s*<script type="module" src="\/@vite\/client"><\/script>\s*/g, "\n");
    },
  };
}
const previewFiles = new Map([
  ["/.project-os/desktop-provider.json", path.join(rootDir, ".project-os/desktop-provider.json")],
  ["/.project-os/model-catalog.json", path.join(rootDir, ".project-os/model-catalog.json")],
  ["/.project-os/model-health.json", path.join(rootDir, ".project-os/model-health.json")],
  ["/.project-os/project-profile.json", path.join(rootDir, ".project-os/project-profile.json")],
  ["/.project-os/project-capabilities.json", path.join(rootDir, ".project-os/project-capabilities.json")],
  ["/.project-os/workspace-facts.json", path.join(rootDir, ".project-os/workspace-facts.json")],
  ["/.project-os/desktop-registry.json", path.join(rootDir, ".project-os/desktop-registry.json")],
  ["/.project-os/task-backlog.json", path.join(rootDir, ".project-os/task-backlog.json")],
  ["/.project-os/goals.json", path.join(rootDir, ".project-os/goals.json")],
  ["/.project-os/goal-validation.json", path.join(rootDir, ".project-os/goal-validation.json")],
  ["/.project-os/goal-validation-report.json", path.join(rootDir, ".project-os/goal-validation-report.json")],
  ["/.project-os/goal-signoff-history.json", path.join(rootDir, ".project-os/goal-signoff-history.json")],
]);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function runValidationCommand(spec) {
  try {
    const output = await execFileAsync(spec.program, spec.args, {
      cwd: spec.cwd || rootDir,
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      id: spec.id,
      label: spec.label,
      command: spec.command,
      success: true,
      code: 0,
      output: `${output.stdout || ""}${output.stderr || ""}`.trim().slice(0, 6000),
    };
  } catch (err) {
    return {
      id: spec.id,
      label: spec.label,
      command: spec.command,
      success: false,
      code: err.code ?? null,
      output: `${err.stdout || ""}${err.stderr || err.message || ""}`.trim().slice(0, 6000),
    };
  }
}

async function runGuardedCheckPreview(input = {}) {
  const spec = guardedCheckCapability(input.checkId);
  if (!spec) return { error: `不允许执行这个检查：${input.checkId || "unknown"}` };
  const { projectRoot } = currentPreviewProject();
  const missingPath = spec.requiredPaths.find((relativePath) => !fs.existsSync(path.join(projectRoot, relativePath)));
  if (missingPath) return { error: `当前项目缺少检查所需文件：${missingPath}` };
  return runValidationCommand({ ...spec, cwd: projectRoot });
}

async function probeHermesExecutorPreview() {
  const programCandidates = (program) => [...new Set([
    process.env.HOME ? path.join(process.env.HOME, ".local", "bin", program) : "",
    program,
  ].filter(Boolean))];
  for (const program of programCandidates("hermes-acp")) {
    try {
      await execFileAsync(program, ["--check"], { cwd: rootDir, timeout: 5000 });
      const output = await execFileAsync(program, ["--version"], { cwd: rootDir, timeout: 5000 });
      const version = `${output.stdout || ""}${output.stderr || ""}`.trim().slice(0, 240);
      return {
        id: "hermes",
        protocol: "acp",
        status: "ready",
        version,
        message: "Hermes ACP 通道检查通过；模型凭据仍需通过实际请求验证。",
      };
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      return {
        id: "hermes",
        protocol: "acp",
        status: "unavailable",
        version: "",
        message: `检测到 Hermes ACP，但健康检查未通过：${String(error?.stderr || error?.message || "未知错误").trim().slice(0, 240)}`,
      };
    }
  }
  for (const program of programCandidates("hermes")) {
    try {
      const output = await execFileAsync(program, ["--version"], { cwd: rootDir, timeout: 5000 });
      return {
        id: "hermes",
        protocol: "cli",
        status: "cli-only",
        version: `${output.stdout || ""}${output.stderr || ""}`.trim().slice(0, 240),
        message: "已检测到 Hermes CLI；ACP 健康检查通过前不能接入受控执行。",
      };
    } catch (error) {
      if (error?.code !== "ENOENT") continue;
    }
  }
  return {
    id: "hermes",
    protocol: "acp",
    status: "not-installed",
    version: "",
    message: "未检测到 Hermes。安装并完成模型配置后，OmniDesk 才能将它作为可选执行器使用。",
  };
}

function generatePatchDraftPreview(input = {}) {
  const task = input.task || {};
  const plan = task.plan || {};
  const { projectRoot } = currentPreviewProject();
  const files = [...new Set([...(plan.filesToRead || []), ...(plan.candidateChanges || [])]
    .map((value) => String(value || "").trim())
    .filter((value) => value && !value.includes("\n") && fs.existsSync(path.join(projectRoot, value))))];
  return {
    diff: `--- /dev/null\n+++ PATCH_DRAFT_PENDING\n@@\n+任务：${task.title || plan.task || "未命名任务"}\n+候选文件：${files.join(", ") || "暂无可安全读取的候选文件"}\n+当前预览只生成审阅草案，不写入文件。\n`,
    files,
    guardrails: ["只生成 diff 草案，不写入文件。", "Apply 前必须经过用户确认。"],
    summary: `已为「${task.title || plan.task || "未命名任务"}」准备 Patch Draft 入口；需要桌面模型生成具体 diff。`,
    trace: [`PATCH_CONTEXT_FILES: ${files.length}`, "PATCH_MODE: preview placeholder"],
  };
}

function readProjectJson(relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function runbookCommandsPreview(projectRoot) {
  const commands = [];
  for (const relative of ["package.json", "desktop/package.json"]) {
    const packageJson = readJsonAt(projectRoot, relative, null);
    for (const key of ["dev", "web:dev", "web:build", "build", "test", "lint"]) {
      if (!packageJson?.scripts?.[key]) continue;
      const labels = { dev: "开发启动", "web:dev": "Web 开发预览", "web:build": "Web 构建", build: "项目构建", test: "测试", lint: "代码检查" };
      commands.push({ id: `${relative}:${key}`, label: labels[key], command: relative === "package.json" ? `npm run ${key}` : `npm --prefix desktop run ${key}`, kind: ["dev", "web:dev"].includes(key) ? "start" : "check", source: relative });
    }
  }
  if (fs.existsSync(path.join(projectRoot, "desktop/src-tauri/Cargo.toml"))) commands.push({ id: "desktop:cargo-check", label: "桌面壳检查", command: "cargo check --manifest-path desktop/src-tauri/Cargo.toml", kind: "check", source: "desktop/src-tauri/Cargo.toml" });
  if (fs.existsSync(path.join(projectRoot, "scripts/check-runtime.sh"))) commands.push({ id: "governance:runtime", label: "治理检查", command: "bash scripts/check-runtime.sh .", kind: "check", source: "scripts/check-runtime.sh" });
  return commands;
}

function isIgnoredPreviewPath(filePath) {
  const name = path.basename(filePath);
  return [".git", ".project-os", "node_modules", "target", "dist", "build", "tmp", ".cache", ".next", ".nuxt", ".vite", ".turbo", "coverage", ".DS_Store", "__pycache__"].includes(name)
    || (name.startsWith(".env") && name !== ".env.example");
}

function buildTreePreview(projectRoot) {
  const tree = [{
    label: path.basename(projectRoot) || "workspace",
    depth: 0,
    kind: "folder",
  }];

  const append = (dir, depth) => {
    if (depth > 4 || tree.length >= 180) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries
      .filter((entry) => !isIgnoredPreviewPath(path.join(dir, entry.name)))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .forEach((entry) => {
        if (tree.length >= 180) return;
        tree.push({
          label: entry.name,
          depth,
          kind: entry.isDirectory() ? "folder" : "file",
        });
        if (entry.isDirectory()) append(path.join(dir, entry.name), depth + 1);
      });
  };

  append(projectRoot, 1);
  return tree;
}

function safePreviewPath(relativePath) {
  const text = String(relativePath || "").trim();
  if (!text || text.startsWith(".env") || text.includes("/.env") || text.includes(".project-os/desktop-provider")) return "";
  const normalized = path.normalize(text);
  if (path.isAbsolute(normalized) || normalized.startsWith("..") || normalized.includes(`..${path.sep}`)) return "";
  return normalized;
}

function previewLanguage(relativePath) {
  const ext = path.extname(relativePath).slice(1);
  return ext || "text";
}

function readEngineeringFilePreview(input) {
  const { projectRoot } = currentPreviewProject();
  const relativePath = safePreviewPath(input?.path);
  if (!relativePath) return { error: "这个文件暂不支持预览。" };

  const filePath = path.resolve(projectRoot, relativePath);
  if (!filePath.startsWith(path.resolve(projectRoot))) return { error: "只能预览当前项目内的文件。" };
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return { error: "没有找到这个文件。" };

  const bytes = fs.readFileSync(filePath);
  if ([...bytes.slice(0, 512)].some((byte) => byte === 0)) return { error: "这个文件看起来不是文本文件，暂不预览。" };
  const maxBytes = 80 * 1024;
  const truncated = bytes.length > maxBytes;
  return {
    path: relativePath,
    name: path.basename(relativePath),
    content: bytes.slice(0, maxBytes).toString("utf8"),
    language: previewLanguage(relativePath),
    truncated,
    size: bytes.length,
  };
}

function agentToolIgnoredPreview(filePath) {
  const parts = filePath.split(path.sep);
  const name = path.basename(filePath);
  return parts.some((part) => [".git", "node_modules", "target", "dist", "build", ".next", ".nuxt", ".vite", ".turbo", ".cache", "coverage", "__pycache__"].includes(part))
    || name.startsWith(".env") || name.endsWith(".lock") || name === "desktop-provider.json";
}

function resolveAgentToolPreviewPath(projectRoot, value, directory = true) {
  const relative = String(value || ".").trim() || ".";
  const normalized = path.normalize(relative);
  const root = path.resolve(projectRoot);
  if (path.isAbsolute(normalized) || normalized === ".." || normalized.startsWith(`..${path.sep}`)) throw new Error("工具路径必须位于当前项目内");
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("工具路径必须位于当前项目内");
  const real = fs.realpathSync(target);
  if (real !== root && !real.startsWith(`${root}${path.sep}`)) throw new Error("工具路径不允许访问");
  if (agentToolIgnoredPreview(real)) throw new Error("工具路径不允许访问");
  if (!fs.existsSync(real) || fs.statSync(real).isDirectory() !== directory) throw new Error(directory ? "请选择项目目录" : "请选择项目文件");
  return { real, relative: path.relative(root, real).replaceAll(path.sep, "/") || "." };
}

function executeAgentReadToolPreview(input = {}) {
  const { projectRoot } = currentPreviewProject();
  const args = input.arguments && typeof input.arguments === "object" ? input.arguments : {};
  const name = String(input.name || "").trim();
  if (name === "git_status") {
    return { summary: "Preview 不执行 Git 命令。", entries: [], readOnly: true };
  }
  const pathInput = args.path || ".";
  if (name === "read_file") {
    const file = resolveAgentToolPreviewPath(projectRoot, pathInput, false);
    const bytes = fs.readFileSync(file.real);
    if ([...bytes.slice(0, 512)].some((byte) => byte === 0)) throw new Error("不支持读取二进制文件");
    const maxBytes = 80 * 1024;
    return { summary: `读取 ${file.relative}`, path: file.relative, content: bytes.slice(0, maxBytes).toString("utf8"), size: bytes.length, truncated: bytes.length > maxBytes };
  }
  const start = resolveAgentToolPreviewPath(projectRoot, pathInput, true).real;
  const queue = [start];
  const items = [];
  const hits = [];
  const query = String(args.query || "").trim().toLowerCase();
  while (queue.length && (items.length < 200 || (name === "search_project" && hits.length < 100))) {
    const directory = queue.shift();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (agentToolIgnoredPreview(filePath)) continue;
      const relative = path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
      if (entry.isDirectory()) queue.push(filePath);
      if (name === "list_files") items.push({ path: relative, kind: entry.isDirectory() ? "directory" : "file" });
      if (name === "search_project" && entry.isFile() && query) {
        const stat = fs.statSync(filePath);
        if (stat.size > 256 * 1024) continue;
        let content = "";
        try { content = fs.readFileSync(filePath, "utf8"); } catch { continue; }
        content.split(/\r?\n/).forEach((line, index) => { if (line.toLowerCase().includes(query) && hits.length < 100) hits.push({ path: relative, line: index + 1, text: line.slice(0, 500) }); });
      }
      if (items.length >= 200 || hits.length >= 100) break;
    }
  }
  if (name === "list_files") return { summary: `列出 ${items.length} 项`, items, truncated: items.length >= 200, readOnly: true };
  if (name === "search_project") return { summary: `找到 ${hits.length} 处匹配`, hits, truncated: hits.length >= 100, readOnly: true };
  throw new Error("Preview 只接受已登记的只读 Agent Tool");
}

function listAgentRunsPreview() {
  const { projectRoot } = currentPreviewProject();
  const directory = path.join(projectRoot, ".project-os", "runs", "agent-runs");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith(".json")).map((name) => {
    try { return JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")); } catch { return null; }
  }).filter(Boolean).sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))).slice(0, 100);
}

function currentPreviewProject() {
  const registry = readProjectJson(".project-os/desktop-registry.json", {
    currentProjectId: "current",
    projects: [{
      id: "current",
      name: "project-os-starter",
      path: rootDir,
      phase: "stabilizing",
    }],
  });
  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  const currentProject = projects.find((project) => project.id === registry.currentProjectId) || projects[0] || {
    id: "current",
    name: "project-os-starter",
    path: rootDir,
    phase: "stabilizing",
  };
  return {
    registry,
    projects,
    currentProject,
    projectRoot: currentProject.path || rootDir,
  };
}

function desktopTasksDir(projectRoot) {
  return path.join(projectRoot, ".project-os/runs/desktop-tasks");
}

function desktopConversationsDir(projectRoot) {
  return path.join(projectRoot, ".project-os/runs/desktop-conversations");
}

function safeTaskFileName(id) {
  return `${String(id || "").replace(/[^a-zA-Z0-9._-]/g, "-")}.json`;
}

function listDesktopTasksPreview() {
  const { projectRoot } = currentPreviewProject();
  const dir = desktopTasksDir(projectRoot);
  let directoryFiles = [];
  try {
    directoryFiles = fs.readdirSync(dir);
  } catch {
    directoryFiles = [];
  }
  const manifest = readJsonAt(projectRoot, ".project-os/runs/desktop-tasks/manifest.json", null);
  const files = reconcileTaskFileNames(
    Array.isArray(manifest?.tasks) ? manifest.tasks : [],
    directoryFiles
  );
  return files
    .map((file) => readJsonAt(projectRoot, `.project-os/runs/desktop-tasks/${file}`, null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

function listDesktopConversationsPreview() {
  const { projectRoot } = currentPreviewProject();
  const directory = desktopConversationsDir(projectRoot);
  let files = [];
  try {
    files = fs.readdirSync(directory).filter((file) => file.endsWith(".json"));
  } catch {
    files = [];
  }
  return files
    .map((file) => readJsonAt(projectRoot, `.project-os/runs/desktop-conversations/${file}`, null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 50);
}

function readJsonAt(projectRoot, relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function projectMemoryPreview() {
  const { currentProject, projectRoot } = currentPreviewProject();
  return readJsonAt(projectRoot, ".project-os/memory.json", {
    schemaVersion: "project-os.memory.v0.1", projectId: currentProject.id, updatedAt: "", items: [],
  });
}

const factSourcePaths = ["README.md", "PROJECT.md", "HANDOFF.md", "AGENTS.md", "package.json", "desktop/package.json", "Cargo.toml", "desktop/src-tauri/Cargo.toml", ".project-os/state.json", ".project-os/project-profile.json", "src", "desktop/src", "server", "backend", "api", "prisma", "migrations", "tests", ".github/workflows"];

function factSourceFingerprints(projectRoot) {
  return Object.fromEntries(factSourcePaths.flatMap((relative) => {
    try { const stat = fs.statSync(path.join(projectRoot, relative)); return [[relative, `${stat.mtimeMs}:${stat.size}`]]; } catch { return []; }
  }));
}

function factFreshnessPreview(projectRoot) {
  const saved = readJsonAt(projectRoot, ".project-os/fact-freshness.json", null);
  const current = factSourceFingerprints(projectRoot);
  const changedSources = Object.entries(current).filter(([relative, fingerprint]) => saved?.fingerprints?.[relative] !== fingerprint).map(([relative]) => relative);
  return { status: saved?.fingerprints && !changedSources.length ? "fresh" : "stale", updatedAt: saved?.updatedAt || "", changedSources };
}

function detectedProjectCapabilities(projectRoot) {
  const saved = readJsonAt(projectRoot, ".project-os/project-capabilities.json", { capabilities: [] });
  const savedWorkspaceCapabilities = saved.workspaceCapabilities || saved.capabilities || [];
  const savedById = new Map(savedWorkspaceCapabilities.map((item) => [item.id, item]));
  const exists = (...paths) => paths.some((relative) => fs.existsSync(path.join(projectRoot, relative)));
  const specs = [
    ["project-overview", "enabled", ["core"]],
    ["tasks", "enabled", ["core"]],
    ["files", "enabled", ["core"]],
    ["goals", exists(".project-os/goals.json") ? "detected" : "available", [".project-os/goals.json"]],
    ["rules", exists("AGENTS.md") ? "detected" : "available", ["AGENTS.md"]],
    ["design-implementation", exists("src", "desktop", "docs/ARCHITECTURE.md") ? "recommended" : "available", ["src", "desktop", "docs/ARCHITECTURE.md"]],
    ["validation-delivery", exists("tests", "docs/TESTING.md") ? "recommended" : "available", ["tests", "docs/TESTING.md"]],
    ["knowledge-memory", exists("HANDOFF.md", "docs/DECISIONS.md") ? "detected" : "available", ["HANDOFF.md", "docs/DECISIONS.md"]],
    ["agent-configuration", exists(".project-os/desktop-provider.json", ".project-os/model-catalog.json") ? "detected" : "available", [".project-os/desktop-provider.json", ".project-os/model-catalog.json"]],
  ];
  const rank = { available: 0, detected: 1, recommended: 2, enabled: 3 };
  const workspaceCapabilities = specs.map(([id, detectedStatus, signals]) => {
    const current = savedById.get(id);
    if (current?.status === "dismissed") return current;
    if (current && rank[current.status] >= rank[detectedStatus]) return current;
    return {
      id,
      status: detectedStatus,
      source: detectedStatus === "enabled" ? "core" : "scan",
      signals: signals.filter((signal) => signal === "core" || fs.existsSync(path.join(projectRoot, signal))),
    };
  });
  const packageText = ["package.json", "desktop/package.json"].map((relative) => {
    try { return fs.readFileSync(path.join(projectRoot, relative), "utf8"); } catch { return ""; }
  }).join("\n");
  const domainSpecs = [
    ["frontend", exists("src", "desktop/src") || /react|vue|svelte/i.test(packageText), ["src", "desktop/src", "desktop/package.json"]],
    ["backend", exists("server", "backend", "api"), ["server", "backend", "api"]],
    ["database", exists("prisma", "migrations", "schema.sql"), ["prisma", "migrations", "schema.sql"]],
    ["desktop", exists("desktop/src-tauri", "src-tauri"), ["desktop/src-tauri", "src-tauri"]],
    ["cli", exists("cli"), ["cli"]],
    ["ai", exists(".project-os/model-catalog.json") || /openai/i.test(packageText), [".project-os/model-catalog.json"]],
    ["testing", exists("tests", "test"), ["tests", "test"]],
    ["deployment", exists(".github/workflows", "Dockerfile"), [".github/workflows", "Dockerfile"]],
  ];
  return {
    schemaVersion: "project-os.project-capabilities.v0.1",
    updatedAt: saved.updatedAt || "",
    capabilities: workspaceCapabilities,
    workspaceCapabilities,
    domainCapabilities: domainSpecs.map(([id, detected, signals]) => ({
      id,
      status: detected ? "detected" : "available",
      source: "scan",
      signals: signals.filter((signal) => fs.existsSync(path.join(projectRoot, signal))),
    })),
  };
}

function readTextAt(projectRoot, relativePath) {
  try {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function cleanMarkdownLine(line) {
  return line
    .trim()
    .replace(/^[-*> ]+/, "")
    .replace(/^`+|`+$/g, "")
    .trim();
}

function markdownSection(content, headings) {
  let collecting = false;
  const lines = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      const title = trimmed.replace(/^#+/, "").trim();
      if (collecting) break;
      collecting = headings.some((heading) => title.includes(heading));
      continue;
    }
    if (collecting) {
      const cleaned = cleanMarkdownLine(trimmed);
      if (cleaned) lines.push(cleaned);
      if (lines.length >= 3) break;
    }
  }
  return lines.join(" ");
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function profileText(profile, key) {
  const value = profile?.fields?.[key]?.value;
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  if (typeof value === "string") return value.trim();
  return "";
}

function projectIntroFromProjectMd(projectMd, projectName) {
  const section = markdownSection(projectMd, ["项目简介", "项目介绍", "概览", "Overview", "Summary"]);
  if (section) return section;
  return projectMd
    .split(/\r?\n/)
    .map(cleanMarkdownLine)
    .find((line) => line
      && !line.startsWith("#")
      && !line.includes("什么时候更新")
      && !line.includes("不要写什么")
      && !line.includes(projectName)) || "";
}

function projectChecksFromAgents(agentsMd) {
  const commands = markdownSection(agentsMd, ["Commands"]);
  const matches = [...commands.matchAll(/\bbash\s+([^\s`]+)/g)]
    .map((match) => `bash ${match[1]}`)
    .slice(0, 4);
  return matches.join("、");
}

function profileForPreview(profile, context = {}) {
  const {
    agentsMd = "",
    handoff = "",
    productPlan = "",
    projectMd = "",
    projectName = "",
    state = {},
  } = context;
  const overview = firstText(
    profileText(profile, "identity.summary"),
    profileText(profile, "identity.uniqueDescription"),
    state.description,
    projectIntroFromProjectMd(projectMd, projectName),
    markdownSection(productPlan, ["项目简介", "产品简介", "Project", "Overview"]),
  );
  const phaseSummary = firstText(
    profileText(profile, "identity.lifecycle"),
    state.stage,
    state.phase,
    markdownSection(projectMd, ["当前阶段", "当前进度"]),
  );
  const architectureSummary = firstText(
    profileText(profile, "engineering.architecture"),
    [state.architecture?.desktop, state.architecture?.entry, state.architecture?.rules].filter(Boolean).join(" / "),
    markdownSection(projectMd, ["当前架构", "技术架构", "Architecture"]),
  );
  const checkCommands = firstText(
    profileText(profile, "engineering.testing"),
    projectChecksFromAgents(agentsMd),
    markdownSection(projectMd, ["当前验证", "验证", "检查"]),
  );
  const collaborationRules = firstText(
    profileText(profile, "governance.permissions"),
    profileText(profile, "user.communicationStyle"),
    markdownSection(agentsMd, ["协作规则", "Working Boundaries"]),
    markdownSection(handoff, ["风险与注意"]),
  );
  const next = {
    overview,
    phaseSummary,
    architectureSummary,
    checkCommands,
    collaborationRules,
    intro: overview,
    longTermGoal: profileText(profile, "product.longTermGoal"),
    targetUsers: profileText(profile, "product.targetUsers"),
    useCases: profileText(profile, "product.useCases"),
    userPreferences: profileText(profile, "user.globalPreferences") || profileText(profile, "user.communicationStyle"),
  };
  next.missingFields = [
    ["项目概览", next.overview],
    ["当前阶段", next.phaseSummary],
    ["技术架构", next.architectureSummary],
    ["检查命令", next.checkCommands],
    ["协作规则", next.collaborationRules],
  ].filter(([, value]) => !value).map(([label]) => label);
  return next;
}

function workspaceSnapshotPreview() {
  const { projects, currentProject, projectRoot } = currentPreviewProject();
  const state = readJsonAt(projectRoot, ".project-os/state.json", {});
  const backlog = readJsonAt(projectRoot, ".project-os/task-backlog.json", { items: [] });
  const goals = readJsonAt(projectRoot, ".project-os/goals.json", {
    schemaVersion: "project-os.goals.v0.1",
    activeGoalId: "",
    goals: [],
  });
  return {
    currentProjectId: currentProject.id,
    currentProjectPath: projectRoot,
    projectName: currentProject.name || state.name || "project-os-starter",
    phase: state.phase || currentProject.phase || "stabilizing",
    stage: state.stage || "未读取到阶段信息",
    tree: buildTreePreview(projectRoot),
    projects: projects.map((project) => ({
      id: project.id,
      isCurrent: project.id === currentProject.id,
      name: project.name,
      path: project.path,
      phase: project.phase || "stabilizing",
      accessMode: ["browse", "governed", "controlled"].includes(project.accessMode) ? project.accessMode : "browse",
    })),
    queue: (Array.isArray(backlog.items) ? backlog.items : []).map((item) => ({
      id: item.id,
      title: item.title || "未命名任务",
      status: item.status || "planned",
      body: item.body || "",
      goalId: item.goalId || "",
      tone: item.tone || "neutral",
    })),
    goals,
    projectGoals: readJsonAt(projectRoot, ".project-os/project-goals.json", { activeProjectGoalId: "", projectGoals: [] }),
    goalValidation: readJsonAt(projectRoot, ".project-os/goal-validation.json", { criteria: [] }),
    goalValidationReport: readJsonAt(projectRoot, ".project-os/goal-validation-report.json", { status: "missing", checks: [] }),
    goalSignoffHistory: readJsonAt(projectRoot, ".project-os/goal-signoff-history.json", { entries: [] }),
    workspaceFacts: readJsonAt(projectRoot, ".project-os/workspace-facts.json", null),
    runbookCommands: runbookCommandsPreview(projectRoot),
    projectCapabilities: detectedProjectCapabilities(projectRoot),
    factFreshness: factFreshnessPreview(projectRoot),
    projectProfile: profileForPreview(readJsonAt(projectRoot, ".project-os/project-profile.json", { fields: {} }), {
      agentsMd: readTextAt(projectRoot, "AGENTS.md"),
      handoff: readTextAt(projectRoot, "HANDOFF.md"),
      productPlan: readTextAt(projectRoot, "docs/PRODUCT_PLAN.md"),
      projectMd: readTextAt(projectRoot, "PROJECT.md"),
      projectName: currentProject.name || state.name || "project-os-starter",
      state,
    }),
    trace: [
      `ROOT: ${projectRoot}`,
      `REGISTRY: ${projects.length} project(s)`,
      `STATE: ${currentProject.name || state.name || "project-os-starter"} / ${state.phase || currentProject.phase || "stabilizing"}`,
    ],
  };
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function readDotenvValuePreview(key, projectRoot = rootDir) {
  const envPath = path.join(projectRoot, ".env.local");
  if (!key || !fs.existsSync(envPath)) return "";
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((item) => {
    const trimmed = item.trimStart();
    return !trimmed.startsWith("#") && trimmed.split("=", 1)[0]?.trim() === key;
  });
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

function providerRevisionPreview(projectRoot) {
  try {
    const stat = fs.statSync(path.join(projectRoot, ".project-os/desktop-provider.json"));
    return `${Math.floor(stat.mtimeMs)}-${stat.size}`;
  } catch {
    return "missing";
  }
}

function providerStatusPreview() {
  const { projectRoot } = currentPreviewProject();
  const config = readJsonAt(projectRoot, ".project-os/desktop-provider.json", {
    schemaVersion: "project-os.desktop-provider.v0.1",
    profiles: [],
  });
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  return {
    ...config,
    source: "preview",
    workspaceRoot: projectRoot,
    revision: providerRevisionPreview(projectRoot),
    hasApiKey: Boolean(readDotenvValuePreview(config.apiKeyEnv, projectRoot)),
    profiles: profiles.map((profile) => ({
      ...profile,
      hasApiKey: Boolean(readDotenvValuePreview(profile.apiKeyEnv, projectRoot)),
    })),
  };
}

async function copyTextPreview(input) {
  const text = String(input?.text || "");
  if (!text) return { error: "没有可复制的内容。" };
  if (process.platform !== "darwin") {
    return { error: "当前预览复制只支持 macOS。" };
  }
  try {
    const child = execFile("pbcopy", { cwd: rootDir }, (err) => {
      if (err) {
        // The promise below reports write errors; callback keeps the child drained.
      }
    });
    child.stdin.end(text);
    await new Promise((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pbcopy exited with ${code}`));
      });
      child.on("error", reject);
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function projectOsPreviewFiles() {
  return {
    name: "project-os-preview-files",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Preview has no mutation transport. Keep this server-side guard ahead
        // of legacy compatibility handlers so direct HTTP calls cannot write.
        const deniedOperation = Object.values(runtimeOperations).find((operation) => operation.preview === "deny" && operation.endpoint === req.url);
        if (deniedOperation) {
          sendJson(res, 403, { error: "浏览器预览不能执行此操作，请在桌面 App 窗口里使用。" });
          return;
        }
        if (req.method === "GET" && req.url === "/__project-os/workspace-snapshot") {
          sendJson(res, 200, workspaceSnapshotPreview());
          return;
        }
        if (req.method === "GET" && req.url === "/__project-os/provider-status") {
          sendJson(res, 200, providerStatusPreview());
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/preview-project-path") {
          const input = await readRequestJson(req);
          const result = previewProjectPath(input);
          sendJson(res, result.error ? 400 : 200, result);
          return;
        }
        if (req.method === "GET" && req.url === "/__project-os/desktop-tasks") {
          sendJson(res, 200, listDesktopTasksPreview());
          return;
        }
        if (req.method === "GET" && req.url === "/__project-os/desktop-conversations") {
          sendJson(res, 200, listDesktopConversationsPreview());
          return;
        }
        if (req.method === "GET" && req.url === "/__project-os/project-memory") {
          sendJson(res, 200, projectMemoryPreview());
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/read-engineering-file") {
          const input = await readRequestJson(req);
          const result = readEngineeringFilePreview(input);
          sendJson(res, result.error ? 400 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/execute-agent-read-tool") {
          const input = await readRequestJson(req);
          try { sendJson(res, 200, executeAgentReadToolPreview(input?.input || input)); } catch (error) { sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) }); }
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/agent-runs") {
          sendJson(res, 200, listAgentRunsPreview());
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/get-hermes-executor-status") {
          sendJson(res, 200, await probeHermesExecutorPreview());
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/generate-patch-draft") {
          const input = await readRequestJson(req);
          sendJson(res, 200, generatePatchDraftPreview(input));
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/copy-text") {
          const input = await readRequestJson(req);
          const result = await copyTextPreview(input);
          sendJson(res, result.error ? 500 : 200, result);
          return;
        }
        const filePath = previewFiles.get(req.url || "");
        if (!filePath) {
          next();
          return;
        }
        fs.readFile(filePath, "utf8", (err, content) => {
          if (err) {
            res.statusCode = 404;
            res.end("{}");
            return;
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(content);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react({ fastRefresh: !embeddedBrowserMode }), projectOsPreviewFiles(), embeddedBrowserCompatibility()],
  server: {
    host: "127.0.0.1",
    hmr: embeddedBrowserMode ? false : undefined,
    port: 1420,
    strictPort: true,
    watch: {
      // Runtime data is owned by the desktop adapter, not the preview server.
      ignored: ["**/.project-os/**"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    manifest: true,
  },
});

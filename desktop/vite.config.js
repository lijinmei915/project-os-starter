import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewFiles = new Map([
  ["/.project-os/desktop-provider.json", path.join(rootDir, ".project-os/desktop-provider.json")],
  ["/.project-os/model-catalog.json", path.join(rootDir, ".project-os/model-catalog.json")],
  ["/.project-os/model-health.json", path.join(rootDir, ".project-os/model-health.json")],
  ["/.project-os/project-profile.json", path.join(rootDir, ".project-os/project-profile.json")],
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
      cwd: rootDir,
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

function readProjectJson(relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function isIgnoredPreviewPath(filePath) {
  const name = path.basename(filePath);
  return [".git", "node_modules", "target", "dist", ".DS_Store", "__pycache__"].includes(name);
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

function writeProjectJson(relativePath, value) {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function desktopTasksDir(projectRoot) {
  return path.join(projectRoot, ".project-os/runs/desktop-tasks");
}

function safeTaskFileName(id) {
  return `${String(id || "").replace(/[^a-zA-Z0-9._-]/g, "-")}.json`;
}

function listDesktopTasksPreview() {
  const { projectRoot } = currentPreviewProject();
  const dir = desktopTasksDir(projectRoot);
  let files = [];
  const manifest = readJsonAt(projectRoot, ".project-os/runs/desktop-tasks/manifest.json", null);
  if (Array.isArray(manifest?.tasks)) {
    files = manifest.tasks.filter((file) => String(file || "").endsWith(".json"));
  } else {
    try {
      files = fs.readdirSync(dir).filter((file) => file.endsWith(".json") && file !== "manifest.json");
    } catch {
      files = [];
    }
  }
  return files
    .map((file) => readJsonAt(projectRoot, `.project-os/runs/desktop-tasks/${file}`, null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, 30);
}

function saveDesktopTaskPreview(input) {
  const task = input?.task;
  if (!task?.id) return { error: "缺少任务 id。" };
  const { projectRoot } = currentPreviewProject();
  const dir = desktopTasksDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const nextTask = {
    schemaVersion: "project-os.desktop-task.v0.1",
    ...task,
    updatedAt: now,
  };
  const fileName = safeTaskFileName(task.id);
  fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(nextTask, null, 2)}\n`);
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = readJsonAt(projectRoot, ".project-os/runs/desktop-tasks/manifest.json", {
    schemaVersion: "project-os.desktop-task-manifest.v0.1",
    tasks: [],
  });
  const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : [];
  const nextManifest = {
    ...manifest,
    updatedAt: now,
    tasks: [fileName, ...tasks.filter((file) => file !== fileName)],
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
  return nextTask;
}

function readJsonAt(projectRoot, relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
  } catch {
    return fallback;
  }
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
    projectName: state.name || currentProject.name || "project-os-starter",
    phase: state.phase || currentProject.phase || "stabilizing",
    stage: state.stage || "未读取到阶段信息",
    tree: buildTreePreview(projectRoot),
    projects: projects.map((project) => ({
      id: project.id,
      isCurrent: project.id === currentProject.id,
      name: project.name,
      path: project.path,
      phase: project.phase || "stabilizing",
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
    goalValidation: readJsonAt(projectRoot, ".project-os/goal-validation.json", { criteria: [] }),
    goalValidationReport: readJsonAt(projectRoot, ".project-os/goal-validation-report.json", { status: "missing", checks: [] }),
    goalSignoffHistory: readJsonAt(projectRoot, ".project-os/goal-signoff-history.json", { entries: [] }),
    workspaceFacts: readJsonAt(projectRoot, ".project-os/workspace-facts.json", null),
    projectProfile: profileForPreview(readJsonAt(projectRoot, ".project-os/project-profile.json", { fields: {} }), {
      agentsMd: readTextAt(projectRoot, "AGENTS.md"),
      handoff: readTextAt(projectRoot, "HANDOFF.md"),
      productPlan: readTextAt(projectRoot, "docs/PRODUCT_PLAN.md"),
      projectMd: readTextAt(projectRoot, "PROJECT.md"),
      projectName: state.name || currentProject.name || "project-os-starter",
      state,
    }),
    trace: [
      `ROOT: ${projectRoot}`,
      `REGISTRY: ${projects.length} project(s)`,
      `STATE: ${state.name || currentProject.name || "project-os-starter"} / ${state.phase || currentProject.phase || "stabilizing"}`,
    ],
  };
}

async function runGoalValidationPreview() {
  const checks = [];
  for (const spec of [
    {
      id: "web-build",
      label: "Web Build",
      command: "cd desktop && npm run web:build",
      program: "npm",
      args: ["--prefix", "desktop", "run", "web:build"],
    },
    {
      id: "cargo-check",
      label: "Cargo",
      command: "cd desktop/src-tauri && cargo check",
      program: "cargo",
      args: ["check", "--manifest-path", "desktop/src-tauri/Cargo.toml"],
    },
    {
      id: "runtime",
      label: "Runtime",
      command: "bash scripts/check-runtime.sh .",
      program: "bash",
      args: ["scripts/check-runtime.sh", "."],
    },
  ]) {
    checks.push(await runValidationCommand(spec));
  }
  const passed = checks.every((check) => check.success);
  const now = new Date().toISOString();
  const report = {
    schemaVersion: "project-os.goal-validation-report.v0.1",
    generatedAt: now,
    status: passed ? "passed" : "failed",
    checks,
  };
  writeProjectJson(".project-os/goal-validation-report.json", report);

  const validation = readProjectJson(".project-os/goal-validation.json", { goal: {}, criteria: [] });
  validation.updatedAt = now;
  validation.goal = {
    ...(validation.goal || {}),
    status: passed ? "verified" : "validation-failed",
  };
  writeProjectJson(".project-os/goal-validation.json", validation);
  updateActiveGoalStatusPreview(passed ? "pending-confirm" : "failed", passed ? "passed" : "failed", now);
  return report;
}

function updateActiveGoalStatusPreview(status, validationStatus, updatedAt) {
  const goals = readProjectJson(".project-os/goals.json", {
    schemaVersion: "project-os.goals.v0.1",
    activeGoalId: "",
    goals: [],
  });
  const items = Array.isArray(goals.goals) ? goals.goals : [];
  const activeGoalId = goals.activeGoalId || items[0]?.id || "";
  goals.updatedAt = updatedAt;
  goals.goals = items.map((goal) => (
    goal.id === activeGoalId
      ? {
          ...goal,
          status,
          validationStatus,
          updatedAt,
        }
      : goal
  ));
  writeProjectJson(".project-os/goals.json", goals);
  return goals;
}

function signOffGoalValidationPreview() {
  const report = readProjectJson(".project-os/goal-validation-report.json", { status: "missing" });
  if (report.status !== "passed") {
    return { error: "目标还没有通过验收，不能签收。" };
  }
  const now = new Date().toISOString();
  const validation = readProjectJson(".project-os/goal-validation.json", { goal: {}, criteria: [] });
  validation.updatedAt = now;
  validation.goal = {
    ...(validation.goal || {}),
    status: "signed-off",
  };
  writeProjectJson(".project-os/goal-validation.json", validation);
  updateActiveGoalStatusPreview("done", "signed-off", now);

  const history = readProjectJson(".project-os/goal-signoff-history.json", {
    schemaVersion: "project-os.goal-signoff-history.v0.1",
    entries: [],
  });
  history.updatedAt = now;
  history.entries = [
    {
      goalId: validation.goal.id || "current-goal",
      goalTitle: validation.goal.title || "当前目标",
      signedOffAt: now,
      reportStatus: report.status,
      source: "OmniDesk Preview",
    },
    ...(Array.isArray(history.entries) ? history.entries : []),
  ];
  writeProjectJson(".project-os/goal-signoff-history.json", history);
  return history;
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

function compactGoalTitle(title) {
  const normalized = String(title || "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
  if (normalized.length <= 18) return normalized || "当前目标";
  const parts = normalized.split(/\s*\/\s*/).filter(Boolean);
  const usefulPart = parts.find((part) => part.length <= 18) || parts.at(-1);
  if (usefulPart && usefulPart.length <= 18) return usefulPart;
  return `${normalized.slice(0, 16)}...`;
}

function goalIdFromTitle(title) {
  const stem = String(title || "goal")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "goal";
  return `${stem}-${Date.now()}`;
}

function createGoalPreview(input) {
  const title = String(input?.title || "").trim();
  if (!title) {
    return { error: "目标名称不能为空。" };
  }
  const now = new Date().toISOString();
  const id = goalIdFromTitle(title);
  const goals = readProjectJson(".project-os/goals.json", {
    schemaVersion: "project-os.goals.v0.1",
    activeGoalId: "",
    goals: [],
  });
  goals.schemaVersion = "project-os.goals.v0.1";
  goals.activeGoalId = id;
  goals.updatedAt = now;
  goals.goals = [
    {
      id,
      title,
      shortTitle: compactGoalTitle(title),
      projectName: "project-os-starter",
      status: "draft",
      createdAt: now,
      summary: String(input?.summary || "").trim() || "目标草案，等待确认。",
      taskIds: [],
    },
    ...(Array.isArray(goals.goals) ? goals.goals : []),
  ];
  writeProjectJson(".project-os/goals.json", goals);
  return goals;
}

function switchGoalPreview(input) {
  const id = String(input?.id || "").trim();
  const goals = readProjectJson(".project-os/goals.json", {
    schemaVersion: "project-os.goals.v0.1",
    activeGoalId: "",
    goals: [],
  });
  const exists = Array.isArray(goals.goals) && goals.goals.some((goal) => goal.id === id);
  if (!exists) {
    return { error: "没有找到这个目标。" };
  }
  goals.activeGoalId = id;
  goals.updatedAt = new Date().toISOString();
  writeProjectJson(".project-os/goals.json", goals);
  return goals;
}

function confirmGoalPreview(input) {
  const id = String(input?.id || "").trim();
  const goals = readProjectJson(".project-os/goals.json", {
    schemaVersion: "project-os.goals.v0.1",
    activeGoalId: "",
    goals: [],
  });
  const now = new Date().toISOString();
  let found = false;
  goals.activeGoalId = id;
  goals.updatedAt = now;
  goals.goals = (Array.isArray(goals.goals) ? goals.goals : []).map((goal) => {
    if (goal.id !== id) return goal;
    found = true;
    return {
      ...goal,
      status: "planned",
      confirmedAt: now,
      updatedAt: now,
    };
  });
  if (!found) {
    return { error: "没有找到这个目标。" };
  }
  writeProjectJson(".project-os/goals.json", goals);
  return goals;
}

function removeDotenvValuePreview(key) {
  const envPath = path.join(rootDir, ".env.local");
  if (!key || !fs.existsSync(envPath)) return;
  const lines = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trimStart();
      if (!trimmed || trimmed.startsWith("#")) return true;
      const [name] = trimmed.split("=");
      return name.trim() !== key;
    });
  fs.writeFileSync(envPath, `${lines.join("\n").replace(/\n+$/, "")}\n`);
}

function deleteProviderProfilePreview(input) {
  const profileId = String(input?.profileId || "").trim();
  if (!profileId) return { error: "缺少连接 ID。" };

  const config = readProjectJson(".project-os/desktop-provider.json", {
    schemaVersion: "project-os.desktop-provider.v0.1",
    provider: "openai-compatible",
    model: "",
    apiBase: "",
    apiKeyEnv: "",
    enabled: false,
    activeProfileId: "",
    profiles: [],
  });
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const removed = profiles.find((profile) => profile.id === profileId);
  if (!removed) return { error: "没有找到要删除的连接。" };

  const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
  const keyStillUsed = nextProfiles.some((profile) => profile.apiKeyEnv === removed.apiKeyEnv);
  if (removed.apiKeyEnv && !keyStillUsed) {
    removeDotenvValuePreview(removed.apiKeyEnv);
  }

  const nextActive = config.activeProfileId === profileId ? nextProfiles[0] : null;
  const nextConfig = {
    ...config,
    ...(nextActive
      ? {
          provider: nextActive.provider,
          model: nextActive.model,
          apiBase: nextActive.apiBase,
          apiKeyEnv: nextActive.apiKeyEnv,
          activeProfileId: nextActive.id,
        }
      : config.activeProfileId === profileId
        ? {
            provider: "openai-compatible",
            model: "",
            apiBase: "",
            apiKeyEnv: "",
            enabled: false,
            activeProfileId: "",
          }
        : {}),
    profiles: nextProfiles,
  };
  writeProjectJson(".project-os/desktop-provider.json", nextConfig);
  return {
    ...nextConfig,
    hasApiKey: false,
    profiles: nextProfiles.map((profile) => ({ ...profile, hasApiKey: false })),
  };
}

function switchProjectPreview(input) {
  const id = String(input?.id || "").trim();
  if (!id) return { error: "缺少项目 ID。" };
  const registry = readProjectJson(".project-os/desktop-registry.json", {
    schemaVersion: "project-os.desktop-registry.v0.1",
    currentProjectId: "current",
    projects: [],
  });
  const exists = Array.isArray(registry.projects) && registry.projects.some((project) => project.id === id);
  if (!exists) return { error: "没有找到这个项目。" };
  registry.currentProjectId = id;
  writeProjectJson(".project-os/desktop-registry.json", registry);
  return registry;
}

function relocateProjectPreview(input) {
  const id = String(input?.id || "").trim();
  const nextPath = String(input?.path || "").trim();
  if (!id) return { error: "缺少项目 ID。" };
  if (!nextPath) return { error: "请选择新的项目文件夹。" };
  const resolvedPath = path.resolve(nextPath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    return { error: "新的项目路径不可访问。" };
  }
  const registry = readProjectJson(".project-os/desktop-registry.json", {
    schemaVersion: "project-os.desktop-registry.v0.1",
    currentProjectId: "current",
    projects: [],
  });
  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  const project = projects.find((item) => item.id === id);
  if (!project) return { error: "没有找到这个项目。" };
  const state = readJsonAt(resolvedPath, ".project-os/state.json", {});
  project.path = resolvedPath;
  if (!project.nameLocked) {
    project.name = path.basename(resolvedPath) || project.name;
  }
  project.phase = state.phase || project.phase || "external";
  registry.currentProjectId = id;
  registry.projects = projects;
  writeProjectJson(".project-os/desktop-registry.json", registry);
  return registry;
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

function projectOsActionSpec(actionId) {
  const cliBin = path.join(rootDir, "bin/project-os");
  const cliBase = ["--runtime-root", rootDir, "--trigger-source", "desktop"];
  const cliCommand = (command, extra = []) => [command, ".", ...cliBase, ...extra];
  const specs = {
    scan: {
      id: "scan",
      label: "一键扫描",
      program: cliBin,
      args: cliCommand("scan", ["--persist", "full", "--output", "json"]),
      command: `${cliBin} scan . --runtime-root ${rootDir} --trigger-source desktop --persist full --output json`,
      requiredPath: cliBin,
    },
    recommend: {
      id: "recommend",
      label: "生成优化建议",
      program: cliBin,
      args: cliCommand("recommend", ["--persist", "full", "--output", "json"]),
      command: `${cliBin} recommend . --runtime-root ${rootDir} --trigger-source desktop --persist full --output json`,
      requiredPath: cliBin,
    },
    report: {
      id: "report",
      label: "批量生成修复草案",
      program: cliBin,
      args: cliCommand("report", ["--output", "report", "--persist", "full"]),
      command: `${cliBin} report . --runtime-root ${rootDir} --trigger-source desktop --output report --persist full`,
      requiredPath: cliBin,
    },
    prune: {
      id: "prune",
      label: "清理过期骨架产物",
      program: "bash",
      args: [path.join(rootDir, "scripts/prune-project-os-artifacts.sh"), "."],
      command: "bash scripts/prune-project-os-artifacts.sh .",
      requiredPath: path.join(rootDir, "scripts/prune-project-os-artifacts.sh"),
    },
    sync: {
      id: "sync",
      label: "同步治理状态",
      program: cliBin,
      args: ["state", "sync", ".", "--output", "json"],
      command: `${cliBin} state sync . --output json`,
      requiredPath: cliBin,
    },
  };
  return specs[actionId] || null;
}

async function runProjectOsActionPreview(input) {
  const actionId = String(input?.actionId || input?.action_id || "").trim();
  const spec = projectOsActionSpec(actionId);
  if (!spec) return { error: `不允许执行这个治理动作：${actionId}` };
  if (!fs.existsSync(spec.requiredPath)) return { error: `缺少治理动作所需文件：${path.relative(rootDir, spec.requiredPath)}` };

  const { projectRoot } = currentPreviewProject();
  try {
    const result = await execFileAsync(spec.program, spec.args, {
      cwd: projectRoot,
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      id: spec.id,
      label: spec.label,
      command: spec.command,
      success: true,
      code: 0,
      output: `${result.stdout || ""}${result.stderr || ""}`.trim().slice(0, 6000),
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

function projectOsPreviewFiles() {
  return {
    name: "project-os-preview-files",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === "GET" && req.url === "/__project-os/workspace-snapshot") {
          sendJson(res, 200, workspaceSnapshotPreview());
          return;
        }
        if (req.method === "GET" && req.url === "/__project-os/desktop-tasks") {
          sendJson(res, 200, listDesktopTasksPreview());
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/save-desktop-task") {
          const input = await readRequestJson(req);
          const result = saveDesktopTaskPreview(input);
          sendJson(res, result.error ? 400 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/read-engineering-file") {
          const input = await readRequestJson(req);
          const result = readEngineeringFilePreview(input);
          sendJson(res, result.error ? 400 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/run-goal-validation") {
          sendJson(res, 200, await runGoalValidationPreview());
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/run-project-os-action") {
          const input = await readRequestJson(req);
          const result = await runProjectOsActionPreview(input);
          sendJson(res, result.error ? 400 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/sign-off-goal") {
          const result = signOffGoalValidationPreview();
          sendJson(res, result.error ? 409 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/create-goal") {
          const input = await readRequestJson(req);
          const result = createGoalPreview(input);
          sendJson(res, result.error ? 400 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/switch-goal") {
          const input = await readRequestJson(req);
          const result = switchGoalPreview(input);
          sendJson(res, result.error ? 404 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/confirm-goal") {
          const input = await readRequestJson(req);
          const result = confirmGoalPreview(input);
          sendJson(res, result.error ? 404 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/delete-provider-profile") {
          const input = await readRequestJson(req);
          const result = deleteProviderProfilePreview(input);
          sendJson(res, result.error ? 404 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/switch-project") {
          const input = await readRequestJson(req);
          const result = switchProjectPreview(input);
          sendJson(res, result.error ? 404 : 200, result);
          return;
        }
        if (req.method === "POST" && req.url === "/__project-os/relocate-project") {
          const input = await readRequestJson(req);
          const result = relocateProjectPreview(input);
          sendJson(res, result.error ? 400 : 200, result);
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
  plugins: [react(), projectOsPreviewFiles()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

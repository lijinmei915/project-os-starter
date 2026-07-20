function valueOf(store, id, fallback) {
  return store.get(id)?.value ?? fallback;
}

function environmentRequirements(commands) {
  const requirements = [];
  if (commands.some((item) => /(^|\s)npm\b/.test(item.command || ""))) requirements.push("Node.js / npm");
  if (commands.some((item) => /(^|\s)cargo\b/.test(item.command || ""))) requirements.push("Rust / Cargo");
  if (commands.some((item) => /(^|\s)bash\b/.test(item.command || ""))) requirements.push("Bash");
  return requirements;
}

function commandModel(command, kind) {
  return Object.freeze({
    ...command,
    kind,
    note: `来源：${command.source}`,
  });
}

export function selectRunbook(store) {
  const summary = valueOf(store, "runbook.summary", {});
  const commands = valueOf(store, "runbook.commands", []);
  const context = valueOf(store, "runbook.context", {});
  const startCommands = commands.filter((command) => command.kind === "start").map((command) => commandModel(command, "start"));
  const requirements = environmentRequirements(commands);
  return Object.freeze({
    id: "project-runbook.main",
    render: true,
    title: summary.title || "启动方式",
    description: summary.body || "尚未从项目脚本和运行文档识别到启动方式。",
    status: startCommands.length ? "可启动" : "启动入口待补",
    readiness: Object.freeze({
      startCount: startCommands.length,
    }),
    context: Object.freeze({
      projectName: context.projectName || "当前项目",
      workingDirectory: context.workingDirectory || "尚未识别项目目录",
      requirements: Object.freeze(requirements),
    }),
    startCommands: Object.freeze(startCommands),
    sources: Object.freeze([...new Set([".project-os/workspace-facts.json", ...startCommands.map((command) => command.source).filter(Boolean)])]),
    state: Object.freeze({
      missing: ["runbook.summary", "runbook.commands", "runbook.context"].filter((id) => store.get(id)?.status === "missing"),
      freshness: ["runbook.summary", "runbook.commands", "runbook.context"].some((id) => store.get(id)?.freshness === "stale") ? "stale" : "fresh",
    }),
  });
}

export const runbookSelectors = Object.freeze({ selectRunbook });

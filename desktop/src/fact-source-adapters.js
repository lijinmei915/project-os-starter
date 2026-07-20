function candidate(path, value, options = {}) {
  return {
    path,
    value,
    status: options.status || "confirmed",
    confidence: options.confidence ?? 1,
    ...(options.selector ? { selector: options.selector } : {}),
  };
}

export const projectFactSourceAdapters = Object.freeze([
  {
    id: "registry",
    read({ snapshot }) {
      const currentProject = (snapshot?.projects || []).find((project) => project.isCurrent);
      return {
        "project.name": [candidate(".project-os/desktop-registry.json", currentProject?.name || snapshot?.projectName, { confidence: 1 })],
      };
    },
  },
  {
    id: "profile",
    read({ snapshot }) {
      const profile = snapshot?.projectProfile || {};
      return {
        "project.description": [candidate(".project-os/project-profile.json", profile.overview, { selector: "identity.summary", confidence: 0.95 })],
        "product.goal": [candidate(".project-os/project-profile.json", profile.longTermGoal, { selector: "product.longTermGoal", confidence: 0.95 })],
      };
    },
  },
  {
    id: "state",
    read({ report, snapshot }) {
      const workspaceProject = snapshot?.workspaceFacts?.project || {};
      const reportProject = report?.project || {};
      return {
        "project.name": [candidate(".project-os/state.json", workspaceProject.name ?? reportProject.name, { confidence: 0.9 })],
        "project.phase": [candidate(".project-os/state.json", snapshot?.phase, { selector: "$.phase" })],
        "project.description": [candidate(".project-os/state.json", workspaceProject.description ?? reportProject.description, { selector: "$.description", confidence: 0.9 })],
      };
    },
  },
  {
    id: "package-cargo",
    read({ report }) {
      const project = report?.project || {};
      return {
        "project.version": [
          candidate("desktop/package.json", project.version, { selector: "$.version" }),
          candidate("package.json", report?.package?.version, { selector: "$.version" }),
          candidate("Cargo.toml", report?.cargo?.version, { selector: "package.version" }),
        ],
      };
    },
  },
  {
    id: "workspace-facts",
    read({ report, snapshot }) {
      const workspaceProject = snapshot?.workspaceFacts?.project || {};
      const project = report?.project || workspaceProject;
      const runbook = report?.summary?.runbook || {};
      return {
        "project.name": [candidate(".project-os/workspace-facts.json", project.name, { confidence: 0.95 })],
        "project.phase": [candidate(".project-os/workspace-facts.json", project.lifecycle, { selector: "$.project.lifecycle", confidence: 0.9 })],
        "product.core-capabilities": [
          candidate(".project-os/project-profile.json", project.coreCapabilities, { selector: "product.coreValue", confidence: 0.9 }),
          candidate(".project-os/workspace-facts.json", workspaceProject.coreCapabilities, { selector: "$.project.coreCapabilities", status: "inferred", confidence: 0.75 }),
        ],
        "technology.stack": [candidate(".project-os/workspace-facts.json", workspaceProject.detectedStack, { selector: "$.project.detectedStack", status: "inferred", confidence: 0.8 })],
        "technology.dependencies": [candidate(".project-os/workspace-facts.json", workspaceProject.dependencies, { selector: "$.project.dependencies", status: "inferred", confidence: 0.8 })],
        "engineering.directories": [candidate(".project-os/workspace-facts.json", workspaceProject.directories, { selector: "$.project.directories", status: "inferred", confidence: 0.8 })],
        "runbook.summary": [candidate(".project-os/workspace-facts.json", runbook.body ? { title: runbook.title, body: runbook.body } : null, { selector: "$.summary.runbook", status: runbook.status || "inferred", confidence: runbook.confidence ?? 0.8 })],
        "progress.summary": [candidate(".project-os/workspace-facts.json", report?.summary?.currentProgress?.body, { selector: "$.summary.currentProgress.body", status: report?.summary?.currentProgress?.status || "inferred", confidence: report?.summary?.currentProgress?.confidence ?? 0.8 })],
        "progress.milestone": [candidate(".project-os/workspace-facts.json", project.milestone || workspaceProject.milestone, { selector: "$.project.milestone", status: "confirmed", confidence: 0.95 })],
        "progress.risks": [candidate(".project-os/workspace-facts.json", report?.findings?.risks || snapshot?.workspaceFacts?.findings?.risks, { selector: "$.findings.risks", status: "inferred", confidence: 0.85 })],
        "progress.evidence": [candidate(".project-os/workspace-facts.json", (report?.governanceDomains || []).find((domain) => domain.id === "current-progress" || domain.title === "当前进度"), { selector: "$.governanceDomains[current-progress]", status: "inferred", confidence: 0.9 })],
      };
    },
  },
  {
    id: "runbook-commands",
    read({ snapshot }) {
      return {
        "runbook.commands": [candidate("scanner:package-scripts", snapshot?.runbookCommands, { status: "confirmed", confidence: 1 })],
        "runbook.context": [candidate("runtime:snapshot", {
          projectName: snapshot?.projectName,
          workingDirectory: snapshot?.currentProjectPath,
        }, { status: "confirmed", confidence: 1 })],
      };
    },
  },
  {
    id: "progress-runtime",
    read({ snapshot }) {
      const goals = snapshot?.goals || {};
      const goalItems = Array.isArray(goals.goals) ? goals.goals : [];
      return {
        "progress.goal": [candidate(".project-os/goals.json", goalItems.find((goal) => goal.id === goals.activeGoalId) || goalItems[0], { selector: "$.activeGoalId", confidence: 1 })],
        "progress.acceptance": [candidate(".project-os/goal-validation.json", snapshot?.goalValidation, { selector: "$.goal", confidence: 1 })],
        "progress.validation-report": [candidate(".project-os/goal-validation-report.json", snapshot?.goalValidationReport, { selector: "$.status", confidence: 1 })],
      };
    },
  },
  {
    id: "scanner",
    read({ report }) {
      const project = report?.project || {};
      return {
        "project.description": [candidate("PROJECT.md", report?.summary?.overview?.body, { status: "inferred", confidence: 0.75 })],
        "product.goal": [candidate("PROJECT.md", report?.summary?.overview?.body, { status: "inferred", confidence: 0.7 })],
        "technology.stack": [candidate("scanner:package-cargo", project.detectedStack, { status: "inferred", confidence: 0.9 })],
        "technology.dependencies": [candidate("scanner:package-cargo", project.dependencies, { status: "inferred", confidence: 0.9 })],
        "engineering.directories": [candidate("scanner:project-tree", project.directories, { status: "inferred", confidence: 0.9 })],
      };
    },
  },
  {
    id: "freshness",
    read({ report, snapshot }) {
      return {
        "project.updated-at": [
          candidate(".project-os/fact-freshness.json", snapshot?.factFreshness?.updatedAt, { selector: "$.updatedAt" }),
          candidate(".project-os/workspace-facts.json", report?.generatedAt, { selector: "$.generatedAt", confidence: 0.9 }),
        ],
      };
    },
  },
]);

export function collectProjectFactCandidates(context, adapters = projectFactSourceAdapters) {
  const collected = new Map();
  for (const adapter of adapters) {
    const facts = adapter.read(context);
    for (const [factId, candidates] of Object.entries(facts)) {
      collected.set(factId, [...(collected.get(factId) || []), ...candidates]);
    }
  }
  return collected;
}

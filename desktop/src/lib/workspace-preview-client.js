import { previewProjectProfile } from "./project-profile-presentation.js";
import { fallbackSnapshot, taskStatuses } from "./workbench-defaults.js";

export async function loadPreviewJson(path, fallback, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(path);
    if (!response.ok) return fallback;
    return { ...fallback, ...(await response.json()) };
  } catch {
    return fallback;
  }
}

export async function loadPreviewWorkspaceSnapshot(fetchImpl = fetch) {
  try {
    const response = await fetchImpl("/__omnidesk/workspace-snapshot");
    if (response.ok) {
      return {
        ...fallbackSnapshot,
        ...(await response.json()),
      };
    }
  } catch {
    // Older dev servers fall back to the native state projection below.
  }
  const backlog = await loadPreviewJson("/.omnidesk/data/task-backlog.json", {
    items: fallbackSnapshot.queue,
  }, fetchImpl);
  const goalValidation = await loadPreviewJson("/.omnidesk/data/goal-validation.json", {
    criteria: [],
  }, fetchImpl);
  const goalValidationReport = await loadPreviewJson("/.omnidesk/evidence/goal-validation-report.json", {
    status: "missing",
    checks: [],
  }, fetchImpl);
  const goalSignoffHistory = await loadPreviewJson("/.omnidesk/data/goal-signoff-history.json", {
    entries: [],
  }, fetchImpl);
  const goals = await loadPreviewJson("/.omnidesk/data/goals.json", fallbackSnapshot.goals, fetchImpl);
  const registry = await loadPreviewJson("/.omnidesk/data/desktop-registry.json", {
    currentProjectId: fallbackSnapshot.currentProjectId,
    projects: fallbackSnapshot.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      phase: project.phase,
    })),
  }, fetchImpl);
  const registryProjects = Array.isArray(registry.projects) ? registry.projects : [];
  const currentProject = registryProjects.find((project) => project.id === registry.currentProjectId)
    || registryProjects[0]
    || fallbackSnapshot.projects[0];
  const projectProfileFile = await loadPreviewJson("/.omnidesk/data/project-profile.json", null, fetchImpl);
  const projectProfile = previewProjectProfile(projectProfileFile, fallbackSnapshot.projectProfile);
  const workspaceFacts = await loadPreviewJson("/.omnidesk/cache/workspace-facts.json", null, fetchImpl);
  const projectCapabilities = await loadPreviewJson(
    "/.omnidesk/data/project-capabilities.json",
    { capabilities: [] },
    fetchImpl,
  );
  const queue = Array.isArray(backlog.items) && backlog.items.length
    ? backlog.items.map((item) => ({
        id: item.id,
        title: item.title || "未命名任务",
        status: item.status || taskStatuses.planned,
        body: item.body || "",
        goalId: item.goalId || "",
        tone: item.tone || "neutral",
      }))
    : fallbackSnapshot.queue;
  return {
    ...fallbackSnapshot,
    currentProjectId: currentProject?.id || fallbackSnapshot.currentProjectId,
    currentProjectPath: currentProject?.path || fallbackSnapshot.currentProjectPath,
    projectName: currentProject?.name || fallbackSnapshot.projectName,
    phase: currentProject?.phase || fallbackSnapshot.phase,
    projects: registryProjects.length
      ? registryProjects.map((project) => ({
          id: project.id,
          isCurrent: project.id === (currentProject?.id || registry.currentProjectId),
          name: project.name,
          path: project.path,
          phase: project.phase || "stabilizing",
          accessMode: project.accessMode || "browse",
        }))
      : fallbackSnapshot.projects,
    queue,
    goalValidation,
    goalValidationReport,
    goalSignoffHistory,
    goals,
    projectProfile,
    workspaceFacts,
    projectCapabilities,
  };
}

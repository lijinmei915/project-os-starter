function message(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createWorkspaceRegistryActions({
  applySnapshot, fallbackSnapshot, loadWorkspaceSnapshot, pickProjectDirectory, registryClient,
  resetWorkspaceEphemeralState, setLoading, setProjectActionError, showToast, snapshot,
}) {
  const projects = Array.isArray(snapshot?.projects) ? snapshot.projects : [];
  const applyProjectSnapshot = (nextSnapshot) => {
    applySnapshot(nextSnapshot);
    resetWorkspaceEphemeralState({ ...fallbackSnapshot, ...nextSnapshot });
  };

  const addProject = async (path, accessMode = "browse") => {
    setProjectActionError("");
    setLoading(true);
    try {
      const nextSnapshot = await registryClient.addWorkspaceProject({ accessMode, path, loadWorkspaceSnapshot });
      applyProjectSnapshot(nextSnapshot);
      const nextProject = nextSnapshot.projects?.find((project) => project.isCurrent || project.id === nextSnapshot.currentProjectId);
      const wasAlreadyRegistered = projects.some((project) => project.id === nextProject?.id);
      showToast(wasAlreadyRegistered ? `已打开 ${nextProject?.name || nextSnapshot.projectName || "项目"}` : `已接入 ${nextProject?.name || nextSnapshot.projectName || "项目"}`);
      return true;
    } catch (error) {
      setProjectActionError(message(error));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    addProject,
    openProjectFolder: async (id) => {
      setProjectActionError("");
      try {
        await registryClient.openWorkspaceProjectFolder(id);
      } catch (error) {
        setProjectActionError(message(error));
      }
    },
    pickProject: async (options = {}) => {
      setProjectActionError("");
      try {
        if (!options.scanOnly && !["browse", "governed", "controlled"].includes(options.accessMode)) {
          throw new Error("添加项目必须先完成扫描并明确选择接入权限。");
        }
        const path = options.path || (() => null)();
        const selected = path || await pickProjectDirectory();
        const normalizedPath = Array.isArray(selected) ? selected[0] : selected;
        if (!normalizedPath) return null;
        if (options.scanOnly) return normalizedPath;
        const added = await addProject(normalizedPath, options.accessMode || "browse");
        return added ? normalizedPath : null;
      } catch (error) {
        setProjectActionError(message(error));
        return null;
      }
    },
    relocateProject: async (id) => {
      const project = projects.find((item) => item.id === id);
      if (!project) return;
      setProjectActionError("");
      try {
        const selected = await pickProjectDirectory();
        if (!selected) return;
        setLoading(true);
        const nextSnapshot = await registryClient.relocateWorkspaceProject({ id, path: Array.isArray(selected) ? selected[0] : selected, loadWorkspaceSnapshot });
        applyProjectSnapshot(nextSnapshot);
        showToast(`已重新定位 ${project.name}`);
      } catch (error) {
        setProjectActionError(message(error));
      } finally {
        setLoading(false);
      }
    },
    removeProject: async (id) => {
      const project = projects.find((item) => item.id === id);
      if (!project) return;
      if (projects.length <= 1) {
        setProjectActionError("至少保留一个工作台项目；可以先添加新项目，再移除这个项目。");
        return;
      }
      setProjectActionError("");
      setLoading(true);
      try {
        const nextSnapshot = await registryClient.removeWorkspaceProject({ id, loadWorkspaceSnapshot });
        applyProjectSnapshot(nextSnapshot);
        showToast(`已移除 ${project.name}`);
      } catch (error) {
        setProjectActionError(message(error));
      } finally {
        setLoading(false);
      }
    },
    renameProject: async (id, name) => {
      setProjectActionError("");
      setLoading(true);
      try {
        const nextSnapshot = await registryClient.renameWorkspaceProject({ id, name, loadWorkspaceSnapshot });
        applySnapshot(nextSnapshot);
        return true;
      } catch (error) {
        setProjectActionError(message(error));
        return false;
      } finally {
        setLoading(false);
      }
    },
    switchProject: async (id) => {
      const project = projects.find((item) => item.id === id);
      if (!project || project.isCurrent) return;
      setLoading(true);
      setProjectActionError("");
      try {
        const nextSnapshot = await registryClient.switchWorkspaceProject({ id, loadWorkspaceSnapshot });
        applyProjectSnapshot(nextSnapshot);
        showToast(`已切换到 ${nextSnapshot.projectName || project.name}`);
      } catch (error) {
        setProjectActionError(message(error));
      } finally {
        setLoading(false);
      }
    },
  };
}

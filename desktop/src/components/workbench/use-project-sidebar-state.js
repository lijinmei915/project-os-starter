import { useState } from "react";
import { findProjectByCanonicalPath } from "../../lib/project-identity";

/** Owns transient ProjectSidebar dialogs and capability selection state. */
export function useProjectSidebarState({ onPickProject, onPreviewProject, onRenameProject, onSwitchProject, onUpdateCapability, projects = [] }) {
  const [renameProject, setRenameProject] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [capabilityLoadingId, setCapabilityLoadingId] = useState("");
  const [selectedModulesByCapability, setSelectedModulesByCapability] = useState({});
  const [capabilityDialogOpen, setCapabilityDialogOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState("workspace");
  const [fileTreeExpanded, setFileTreeExpanded] = useState(true);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [pendingProjectPath, setPendingProjectPath] = useState("");
  const [projectScan, setProjectScan] = useState(null);
  const [selectedProjectAccessMode, setSelectedProjectAccessMode] = useState("browse");
  const [scanDetailsOpen, setScanDetailsOpen] = useState(false);
  const [controlledConfirmOpen, setControlledConfirmOpen] = useState(false);
  const [accessSettingsProject, setAccessSettingsProject] = useState(null);
  const [connectedProjectAccess, setConnectedProjectAccess] = useState(null);
  const [pendingAccessChangeMode, setPendingAccessChangeMode] = useState("");

  const openRenameDialog = (project) => {
    setRenameProject(project);
    setRenameName(project.name);
  };

  const submitRename = async (event) => {
    event.preventDefault();
    if (!renameProject) return;
    const ok = await onRenameProject(renameProject.id, renameName);
    if (ok) {
      setRenameProject(null);
      setRenameName("");
    }
  };

  const dismissCapability = async (capabilityId) => {
    setCapabilityLoadingId(capabilityId);
    try {
      await onUpdateCapability?.(capabilityId, "dismissed");
    } finally {
      setCapabilityLoadingId("");
    }
  };

  const enableCapability = async (capabilityId, modules, candidates) => {
    setCapabilityLoadingId(capabilityId);
    try {
      await onUpdateCapability?.(capabilityId, "enabled", modules, candidates);
    } finally {
      setCapabilityLoadingId("");
    }
  };

  const startProjectAccess = async () => {
    const path = await onPickProject?.({ scanOnly: true });
    if (!path) return;
    setPendingProjectPath(path);
    setProjectScan({ loading: true });
    setSelectedProjectAccessMode("browse");
    setScanDetailsOpen(false);
    setConnectedProjectAccess(null);
    setAccessDialogOpen(true);
    try {
      const scan = await onPreviewProject?.({ path });
      const existingProject = findProjectByCanonicalPath(projects, scan?.path);
      if (existingProject) {
        if (!existingProject.isCurrent) await onSwitchProject?.(existingProject.id);
        setProjectAccessDialogOpen(false);
        return;
      }
      setProjectScan({ ...scan, existingProject });
    } catch (error) {
      setProjectScan({ error: error instanceof Error ? error.message : String(error) });
    }
  };

  const confirmProjectAccess = async (accessMode) => {
    if (!pendingProjectPath || projectScan?.loading || projectScan?.error) return false;
    const path = await onPickProject?.({ accessMode, path: pendingProjectPath });
    if (!path) return false;
    setConnectedProjectAccess({ accessMode, name: projectScan?.project?.name || "项目", path });
    return true;
  };

  const openExistingProject = async () => {
    const existingProject = projectScan?.existingProject;
    if (!existingProject) return false;
    if (!existingProject.isCurrent) await onSwitchProject?.(existingProject.id);
    setProjectAccessDialogOpen(false);
    return true;
  };

  const changeProjectAccess = async (accessMode) => {
    if (!accessSettingsProject) return false;
    if (accessMode === "controlled") {
      setPendingAccessChangeMode("controlled");
      setControlledConfirmOpen(true);
      return true;
    }
    const path = await onPickProject?.({ accessMode, path: accessSettingsProject.path });
    if (!path) return false;
    setAccessSettingsProject(null);
    return true;
  };

  const confirmControlledProjectAccess = async () => {
    if (pendingAccessChangeMode === "controlled" && accessSettingsProject) {
      const path = await onPickProject?.({ accessMode: "controlled", path: accessSettingsProject.path });
      if (!path) return false;
      setPendingAccessChangeMode("");
      setControlledConfirmOpen(false);
      setAccessSettingsProject(null);
      return true;
    }
    const confirmed = await confirmProjectAccess("controlled");
    if (confirmed) setControlledConfirmOpen(false);
    return confirmed;
  };

  const openProjectAccessSettings = (project) => setAccessSettingsProject(project);

  const revokeProjectWriteAccess = async () => {
    return changeProjectAccess("browse");
  };

  const setProjectAccessDialogOpen = (open) => {
    setAccessDialogOpen(open);
    if (!open) {
      setPendingProjectPath("");
      setProjectScan(null);
      setSelectedProjectAccessMode("browse");
      setScanDetailsOpen(false);
      setConnectedProjectAccess(null);
      setPendingAccessChangeMode("");
    }
  };

  return {
    accessSettingsProject,
    accessDialogOpen,
    capabilityDialogOpen,
    capabilityLoadingId,
    confirmControlledProjectAccess,
    confirmProjectAccess,
    connectedProjectAccess,
    controlledConfirmOpen,
    changeProjectAccess,
    dismissCapability,
    enableCapability,
    fileTreeExpanded,
    openRenameDialog,
    openExistingProject,
    openProjectAccessSettings,
    projectsOpen,
    projectScan,
    revokeProjectWriteAccess,
    scanDetailsOpen,
    renameName,
    renameProject,
    selectedModulesByCapability,
    setCapabilityDialogOpen,
    setControlledConfirmOpen,
    setAccessSettingsProject,
    setFileTreeExpanded,
    setName: setRenameName,
    setProjectAccessDialogOpen,
    setScanDetailsOpen,
    setSelectedProjectAccessMode,
    setProjectsOpen,
    setRenameProject,
    setSidebarView,
    setSelectedModulesByCapability,
    sidebarView,
    selectedProjectAccessMode,
    startProjectAccess,
    submitRename,
  };
}

export async function navigateWorkspaceTarget(target, {
  onSelectEngineeringFile,
  onSwitchProject,
  setActiveWorkspaceTab,
  topicPayloadFromOutline,
}) {
  if (!target) return;
  if (typeof target === "object" && target.type === "project" && target.id) {
    await onSwitchProject?.(target.id);
    if (target.nextTarget) return navigateWorkspaceTarget(target.nextTarget, { onSelectEngineeringFile, onSwitchProject, setActiveWorkspaceTab, topicPayloadFromOutline });
    const workbenchTopic = topicPayloadFromOutline("workbench-overview");
    if (workbenchTopic) onSelectEngineeringFile?.(workbenchTopic);
    return;
  }
  if (["conversation", "execution"].includes(target)) {
    setActiveWorkspaceTab("plan");
    return;
  }
  if (target === "terminal") {
    setActiveWorkspaceTab("terminal");
    return;
  }
  if (typeof target === "object" && target.type === "file" && target.path) {
    onSelectEngineeringFile?.({ description: "来自工作台活动的工程文件。", path: target.path });
    return;
  }
  const topic = topicPayloadFromOutline(target);
  if (topic) onSelectEngineeringFile?.(topic);
}

import { useCallback, useState } from "react";
import { navigateWorkspaceTarget } from "../../lib/workspace-navigation";

export function useAgentWorkspaceNavigation({
  focusComposer,
  onOpenTaskConversation,
  onSelectEngineeringFile,
  onSwitchProject,
  setActiveWorkspaceTab,
  setTaskInput,
  setWorkspaceTabs,
  snapshot,
  taskConversationAction,
  taskContinuationPrompt,
  taskGoalName,
  taskStatusLabel,
  topicPayloadFromOutline,
}) {
  const [terminalDraftRequest, setTerminalDraftRequest] = useState(null);

  const navigateWorkbench = useCallback((target) => navigateWorkspaceTarget(target, {
    onSelectEngineeringFile,
    onSwitchProject,
    setActiveWorkspaceTab,
    topicPayloadFromOutline,
  }), [onSelectEngineeringFile, onSwitchProject, setActiveWorkspaceTab, topicPayloadFromOutline]);

  const prepareTerminalCommand = useCallback((command) => {
    if (!command) return;
    setTerminalDraftRequest({ command, id: `${Date.now()}-${command}` });
    setActiveWorkspaceTab("terminal");
  }, [setActiveWorkspaceTab]);

  const continueTaskInChat = useCallback(async (task) => {
    if (!task) return;
    const opened = await onOpenTaskConversation?.(task.id);
    if (opened === false) return;
    const next = taskConversationAction(task);
    setTaskInput(taskContinuationPrompt({
      goalName: taskGoalName(task, snapshot),
      nextActionLabel: next.label,
      statusLabel: taskStatusLabel(task),
      title: task.title,
    }));
    requestAnimationFrame(() => focusComposer?.());
  }, [focusComposer, onOpenTaskConversation, setTaskInput, snapshot, taskConversationAction, taskContinuationPrompt, taskGoalName, taskStatusLabel]);

  const openCurrentProgress = useCallback(() => {
    setWorkspaceTabs((current) => {
      const progressTab = current.find((tab) => tab.kind === "file" && (tab.file?.routeId || tab.file?.id) === "project-progress");
      if (progressTab) {
        setActiveWorkspaceTab(progressTab.id);
        onSelectEngineeringFile?.(progressTab.file);
      }
      return current;
    });
  }, [onSelectEngineeringFile, setActiveWorkspaceTab, setWorkspaceTabs]);

  return { continueTaskInChat, navigateWorkbench, openCurrentProgress, prepareTerminalCommand, setTerminalDraftRequest, terminalDraftRequest };
}

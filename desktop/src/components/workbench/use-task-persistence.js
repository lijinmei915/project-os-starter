/** Task persistence and state projection boundary shared by Preview and Tauri. */
export function useTaskPersistence({
  isTauri,
  saveTask,
  setTasks,
  setActiveTaskId,
  setReadonlyPlan,
  markProjectActivityCompleted,
  projectId,
  showToast,
  setRunnerError,
}) {
  const persistTask = async (nextTask, options = {}) => {
    const commitTaskState = (committedTask = nextTask) => {
      setTasks((current) => {
        const exists = current.some((task) => task.id === committedTask.id);
        return exists ? current.map((task) => (task.id === committedTask.id ? committedTask : task)) : [committedTask, ...current];
      });
      setActiveTaskId(committedTask.id);
      if (committedTask.plan) setReadonlyPlan(committedTask.plan);
      markProjectActivityCompleted(committedTask, projectId);
    };

    if (options.durable) {
      const persistedTask = await saveTask(nextTask);
      if (persistedTask?.deduplicated) showToast(`已复用同目标下的现有任务：“${persistedTask.title || "未命名任务"}”。`, "success");
      commitTaskState(persistedTask || nextTask);
      return persistedTask || nextTask;
    }

    commitTaskState();
    if (!isTauri) {
      saveTask(nextTask)
        .then((persistedTask) => {
          if (persistedTask?.deduplicated) {
            showToast(`已复用同目标下的现有任务：“${persistedTask.title || "未命名任务"}”。`, "success");
            commitTaskState(persistedTask);
          }
        })
        .catch((err) => setRunnerError(err instanceof Error ? err.message : String(err)));
      return;
    }
    try {
      await saveTask(nextTask);
    } catch (err) {
      setRunnerError(err instanceof Error ? err.message : String(err));
    }
  };
  return { persistTask };
}

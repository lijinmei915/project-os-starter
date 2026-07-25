/**
 * Bridges goal/task context into Conversation and Terminal surfaces.
 * All side effects are injected by App; this hook owns only context shaping.
 */
export function useWorkspaceContextActions({
  snapshot,
  tasks,
  chatTurns,
  taskStatuses,
  isNoiseTask,
  taskStatusLabel,
  goalStatusLabelText,
  updateChatTurns,
  setActiveTaskId,
  setReadonlyPlan,
  setSelectedEngineeringFile,
  appendContextToTerminal,
  showToast,
  onOpenConversation,
}) {
  const resolveGoalTodoTask = (todo) => {
    if (!todo?.id) return null;
    const task = tasks.find((item) => item.id === todo.id);
    if (task) return task;
    const queueItem = snapshot.queue?.find((item) => item.id === todo.id) || todo;
    return {
      createdAt: "",
      id: queueItem.id,
      plan: {
        candidateChanges: [],
        checks: [],
        filesToRead: [],
        guardrails: ["这是目标拆解里的待办，开始执行前仍需确认具体改动范围。"],
        mode: "planned-task",
        projectName: snapshot.projectName,
        steps: [queueItem.body || queueItem.description || "补齐任务执行方案。"],
        summary: queueItem.body || queueItem.description || "",
        task: queueItem.title,
        trace: [`GOAL_TASK: ${queueItem.goalId || "current"}`],
      },
      projectId: snapshot.currentProjectId || "",
      projectName: snapshot.projectName,
      projectPath: snapshot.currentProjectPath || "",
      status: queueItem.status || taskStatuses.planned,
      title: queueItem.title,
    };
  };

  const goalTasksForContext = (goal) => {
    const goalTaskIds = new Set(Array.isArray(goal?.taskIds) ? goal.taskIds : []);
    if (!goal?.id && !goalTaskIds.size) return tasks.filter((task) => !isNoiseTask(task)).slice(0, 8);
    return tasks.filter((task) => !isNoiseTask(task) && (task.goalId === goal.id || goalTaskIds.has(task.id))).slice(0, 8);
  };

  const appendContextTurn = (text, actions = []) => {
    updateChatTurns([
      ...chatTurns,
      { id: `${Date.now()}-context`, role: "assistant", text, actions },
    ]);
    setSelectedEngineeringFile(null);
    onOpenConversation?.();
  };

  const sendGoalToChat = (goal) => {
    if (!goal) return;
    const relatedTasks = goalTasksForContext(goal);
    const taskLines = relatedTasks.length
      ? relatedTasks.map((task, index) => `${index + 1}. ${task.title}（${taskStatusLabel(task)}）`).join("\n")
      : "暂未绑定具体任务。";
    appendContextTurn(
      `已带入目标上下文：${goal.shortTitle || goal.title || "当前目标"}\n\n状态：${goalStatusLabelText(goal.status)}\n说明：${goal.summary || "暂无说明"}\n\n关联任务：\n${taskLines}\n\n你可以直接继续问：下一步先做哪个、要不要拆任务、或者从哪个任务开始执行。`,
      [{ id: "open-topic", label: "查看当前进度", target: "project-progress" }]
    );
    showToast("已发送目标到对话。", "success");
  };

  const sendTaskToChat = (todo) => {
    const task = resolveGoalTodoTask(todo);
    if (!task) return;
    setActiveTaskId(task.id);
    setReadonlyPlan(task.plan || null);
    setSelectedEngineeringFile(null);
    appendContextTurn(
      `已带入任务上下文：${task.title}\n\n状态：${taskStatusLabel(task)}\n来自目标：${task.goalTitle || todo?.goalTitle || "当前目标"}\n说明：${task.plan?.summary || todo?.description || "暂无说明"}\n\n你可以继续问这个任务怎么做，也可以点下面开始执行。`,
      task.status === taskStatuses.planned ? [{ id: "confirm-active-task", label: "确认并开始", taskId: task.id }] : [{ id: "open-topic", label: "查看任务详情", target: "execution", taskId: task.id }]
    );
    showToast("已发送任务到对话。", "success");
  };

  const sendGoalToTerminal = async (goal) => {
    if (!goal) return;
    const relatedTasks = goalTasksForContext(goal);
    const taskLines = relatedTasks.length
      ? relatedTasks.map((task, index) => `  ${index + 1}. ${task.title} [${taskStatusLabel(task)}]`)
      : ["  暂未绑定具体任务"];
    await appendContextToTerminal(["Goal context", `Goal: ${goal.shortTitle || goal.title || "当前目标"}`, `Status: ${goalStatusLabelText(goal.status)}`, `Summary: ${goal.summary || "暂无说明"}`, "Tasks:", ...taskLines]);
    showToast("已发送目标到终端。", "success");
  };

  const sendTaskToTerminal = async (todo) => {
    const task = resolveGoalTodoTask(todo);
    if (!task) return;
    setActiveTaskId(task.id);
    setReadonlyPlan(task.plan || null);
    await appendContextToTerminal(["Task context", `Task: ${task.title}`, `Status: ${taskStatusLabel(task)}`, `Goal: ${task.goalTitle || todo?.goalTitle || "当前目标"}`, `Summary: ${task.plan?.summary || todo?.description || "暂无说明"}`, "Next: 在这里手动输入要运行的检查或命令。"]);
    showToast("已发送任务到终端。", "success");
  };

  return { sendGoalToChat, sendGoalToTerminal, sendTaskToChat, sendTaskToTerminal };
}

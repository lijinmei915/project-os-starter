function failureMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createConversationActionController({
  activeTaskId, applySnapshot, beginActionFeedback, confirmWorkspaceGoal, createWorkspaceGoal,
  executeGuardedCheck, executePatchApply, executePatchDraft, executeRegisteredConversationAction,
  finishActionFeedback, generatePlan, markTaskWaiting, selectEngineeringFile, selectTask,
  createRepairTask, generatePatchDraft, onEnsureModelAvailable, runGuardedCheck, setError, setSelectedEngineeringFile, startHermesAgent, stopPlanGeneration, taskStatuses, tasks, topicPayloadFromOutline,
}) {
  return async function runChatAction(action) {
    return executeRegisteredConversationAction(action, {
      "create-stage-goal": async (nextAction) => {
        const title = String(nextAction.title || "").trim();
        if (!title) return false;
        const feedbackKey = `create-stage-goal-${Date.now()}`;
        beginActionFeedback(feedbackKey, "正在登记阶段目标...");
        setError("");
        try {
          const createdSnapshot = await createWorkspaceGoal({ summary: String(nextAction.summary || "").trim(), title });
          const goalId = createdSnapshot?.goals?.activeGoalId;
          if (!goalId) throw new Error("阶段目标已创建，但没有返回目标 ID。");
          const confirmedSnapshot = await confirmWorkspaceGoal({ id: goalId });
          const confirmedGoal = confirmedSnapshot?.goals?.goals?.find((goal) => goal.id === goalId);
          if (!confirmedGoal?.parentProjectGoalId) throw new Error("阶段目标已创建，但没有关联到当前项目目标，请检查目标数据后重试。");
          applySnapshot(confirmedSnapshot);
          finishActionFeedback(feedbackKey, "success", `已登记阶段目标：${title}`);
          return true;
        } catch (error) {
          const message = failureMessage(error);
          setError(message);
          finishActionFeedback(feedbackKey, "failed", `登记阶段目标失败：${message}`);
          return false;
        }
      },
      "open-reference": async (nextAction) => {
        if (nextAction.kind === "file") {
          await selectEngineeringFile({ path: nextAction.target, title: nextAction.label });
          return true;
        }
        if (nextAction.kind === "task") return Boolean(selectTask(nextAction.target) ?? true);
        if (nextAction.kind === "terminal") {
          window.dispatchEvent(new Event("omnidesk:open-terminal"));
          return true;
        }
        const topic = topicPayloadFromOutline(nextAction.target);
        if (!topic) return false;
        setSelectedEngineeringFile(topic);
        return true;
      },
      "confirm-active-task": async (nextAction) => {
        const task = tasks.find((item) => item.id === (nextAction.taskId || activeTaskId));
        if (!task) return false;
        if (task.status !== taskStatuses.running) {
          const feedbackKey = `confirm-task-${task.id}`;
          beginActionFeedback(feedbackKey, "正在确认模型并启动任务...");
          setError("");
          try {
            if (onEnsureModelAvailable && !await onEnsureModelAvailable()) {
              setError("当前模型不可用，任务没有开始。请更新 Key 或切换连接后重试。");
              finishActionFeedback(feedbackKey, "failed", "模型不可用，任务未启动。");
              return false;
            }
            if (startHermesAgent && !await startHermesAgent(task)) {
              finishActionFeedback(feedbackKey, "failed", "Agent 没有成功启动，任务状态未改变。");
              return false;
            }
            if (await markTaskWaiting(task.id) === false) {
              finishActionFeedback(feedbackKey, "failed", "任务未能开始，请检查当前状态。");
              return false;
            }
            finishActionFeedback(feedbackKey, "success", "任务已进入执行工作面。");
          } catch (error) {
            const message = failureMessage(error);
            setError(message);
            finishActionFeedback(feedbackKey, "failed", `任务启动失败：${message}`);
            return false;
          }
        }
        return true;
      },
      "open-topic": async (nextAction) => {
        if (["execution", "task-list"].includes(nextAction.target)) {
          const taskId = nextAction.taskId || activeTaskId;
          if (taskId) selectTask(taskId);
          if (nextAction.target === "task-list") setSelectedEngineeringFile(topicPayloadFromOutline("task-list"));
          return true;
        }
        const topic = topicPayloadFromOutline(nextAction.target);
        if (!topic) return false;
        setSelectedEngineeringFile(topic);
        return true;
      },
      retry: async (nextAction) => (await generatePlan({ task: nextAction.task, attachments: [] })).status === "succeeded",
      "generate-plan": async (nextAction) => {
        const outcome = await generatePlan({ task: nextAction.task, attachments: [] });
        if (outcome.status === "succeeded") setSelectedEngineeringFile(null);
        return outcome.status === "succeeded";
      },
      "generate-patch": (nextAction) => nextAction.taskId
        ? generatePatchDraft(nextAction.taskId)
        : executePatchDraft(nextAction.task, `conversation-patch-${nextAction.requestId || nextAction.task?.id || Date.now()}`, { isActive: nextAction.isActive }),
      "create-repair-task": (nextAction) => createRepairTask?.(nextAction.taskId),
      "apply-patch": (nextAction) => {
        const task = tasks.find((item) => item.id === nextAction.taskId);
        return task ? executePatchApply(task, { feedbackKey: `conversation-apply-${nextAction.taskId}`, onProgress: nextAction.onProgress }) : false;
      },
      cancel: () => {
        stopPlanGeneration();
        return true;
      },
      "run-check": (nextAction) => nextAction.taskId
        ? runGuardedCheck(nextAction.taskId, nextAction.checkId)
        : executeGuardedCheck(nextAction.checkId, `conversation-check-${nextAction.requestId || Date.now()}`),
    });
  };
}

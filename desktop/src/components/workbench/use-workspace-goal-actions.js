import { resolveWorkspaceGoal } from "../../lib/workspace-context";

// Coordinates Workspace goal mutations while keeping persistence and model clients injected.
export function useWorkspaceGoalActions({
  applySnapshot,
  beginActionFeedback,
  buildPreviewPlan,
  createTaskFromPlan,
  executionClient,
  finishActionFeedback,
  goalClient,
  isTauri,
  loadWorkspaceSnapshot,
  persistTask,
  provider,
  setDecomposingGoal,
  setError,
  setGoalRefinementMode,
  setSigningGoal,
  setValidatingGoal,
  showToast,
  snapshot,
  taskStatuses,
  updateWorkspaceGoal,
}) {
  const validateGoal = async () => {
    const goalId = String(resolveWorkspaceGoal(snapshot)?.id || "").trim();
    if (!goalId) {
      showToast("没有可验收的当前目标。请先建立或切换目标。", "warning");
      return false;
    }
    const feedbackKey = "validate-goal";
    beginActionFeedback(feedbackKey, "正在验证目标...");
    setValidatingGoal(true);
    setError("");
    try {
      applySnapshot(await goalClient.runGoalValidation({ goalId, loadWorkspaceSnapshot }));
      finishActionFeedback(feedbackKey, "success", "目标验收已完成。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      finishActionFeedback(feedbackKey, "failed", `目标验收失败：${message}`);
      return false;
    } finally {
      setValidatingGoal(false);
    }
  };

  const signOffGoal = async () => {
    const goalId = String(resolveWorkspaceGoal(snapshot)?.id || "").trim();
    if (!goalId) {
      showToast("没有可确认完成的当前目标。请先建立或切换目标。", "warning");
      return false;
    }
    const feedbackKey = "signoff-goal";
    beginActionFeedback(feedbackKey, "正在确认完成...");
    setSigningGoal(true);
    setError("");
    try {
      applySnapshot(await goalClient.signOffGoalValidation({ goalId, loadWorkspaceSnapshot }));
      setGoalRefinementMode(false);
      finishActionFeedback(feedbackKey, "success", "目标已确认完成。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      finishActionFeedback(feedbackKey, "failed", `确认完成失败：${message}`);
      return false;
    } finally {
      setSigningGoal(false);
    }
  };

  const createGoal = async (input) => {
    setError("");
    try {
      applySnapshot(await goalClient.createWorkspaceGoal({
        input: { summary: input?.summary?.trim() || "新的目标已开始。", title: input?.title?.trim() || "新的目标" },
        loadWorkspaceSnapshot,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const switchGoal = async (id) => {
    setError("");
    try {
      applySnapshot(await goalClient.switchWorkspaceGoal({ input: { id }, loadWorkspaceSnapshot }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmGoal = async (id) => {
    setError("");
    try {
      applySnapshot(await goalClient.confirmWorkspaceGoal({ input: { id }, loadWorkspaceSnapshot }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmDecomposition = async (goal, draftItems) => {
    if (!goal?.id || !draftItems?.length) return false;
    setDecomposingGoal(true);
    setError("");
    try {
      const createdTasks = [];
      for (const item of draftItems) {
        const plan = buildPreviewPlan({ task: item.title }, snapshot);
        const task = createTaskFromPlan({ ...plan, summary: item.detail, steps: [item.detail, ...plan.steps] }, item.title, snapshot, {
          goalId: goal.id,
          goalTitle: goal.shortTitle || goal.title || "",
          origin: "goal-decomposition",
          requestId: `goal-decomposition:${goal.id}:${item.id}`,
        });
        createdTasks.push(await persistTask({ ...task, status: taskStatuses.waitingApproval }, { durable: true }));
      }
      applySnapshot(await goalClient.confirmGoalDecomposition({ input: { id: goal.id, taskIds: createdTasks.map((task) => task.id) }, loadWorkspaceSnapshot }));
      showToast("任务拆解已确认，目标现在可以开始推进。", "success");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setDecomposingGoal(false);
    }
  };

  const generateDecomposition = async (goal) => {
    if (!isTauri || !provider?.enabled || !provider?.model) {
      throw new Error("请先在桌面端完成模型连接并启用可用模型。浏览器预览不会伪造任务拆解。 ");
    }
    const plan = await executionClient.generateReadonlyPlan({
      input: { attachments: [], task: `请为当前目标「${goal?.title || "未命名目标"}」生成 3 到 7 个可执行任务。每项必须具体、可验证，并避免重复；目标说明：${goal?.summary || "暂无补充说明"}` },
    });
    const steps = Array.isArray(plan?.steps) ? plan.steps.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 7) : [];
    if (!steps.length) throw new Error("模型没有返回可确认的任务拆解，请重试或调整目标说明。 ");
    return steps.map((detail, index) => ({ id: `model-${index + 1}`, title: detail, detail: plan.summary || "模型生成的任务拆解。" }));
  };

  const updateGoal = async (input) => {
    const nextSnapshot = await updateWorkspaceGoal(input);
    if (nextSnapshot) applySnapshot(nextSnapshot);
    return nextSnapshot;
  };

  return { confirmDecomposition, confirmGoal, createGoal, generateDecomposition, refineGoal: () => setGoalRefinementMode(true), signOffGoal, switchGoal, updateGoal, validateGoal };
}

function failureMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createAgentTopicGoalActions({
  archiveWorkspaceGoal,
  archivingGoal,
  mergeTargetGoalId,
  mergeWorkspaceGoal,
  mergingGoal,
  reload,
  restoreWorkspaceGoal,
  setMutationError,
}) {
  const run = async (action) => {
    try {
      await action();
      reload();
      return true;
    } catch (error) {
      setMutationError(failureMessage(error));
      return false;
    }
  };

  return {
    archiveGoal: () => {
      if (!archivingGoal) return Promise.resolve(false);
      return run(() => archiveWorkspaceGoal(archivingGoal.id));
    },
    mergeGoal: () => {
      if (!mergingGoal || !mergeTargetGoalId) {
        setMutationError("请选择接收目标。");
        return Promise.resolve(false);
      }
      return run(() => mergeWorkspaceGoal(mergingGoal.id, mergeTargetGoalId));
    },
    restoreGoal: (goal) => {
      if (!goal?.id) return Promise.resolve(false);
      return run(() => restoreWorkspaceGoal(goal.id));
    },
  };
}

import { useTaskBoardState } from "./use-task-board-state";
import { buildTaskBoardViewModel } from "../../lib/task-board-view-model";

export function useAgentTopicTaskBoard({ activeTaskId, isNoiseTask, snapshot, statuses, tasks }) {
  const boardState = useTaskBoardState();
  const viewModel = buildTaskBoardViewModel({
    activeTaskId,
    filter: boardState.taskFilter,
    isNoiseTask,
    snapshot,
    sort: boardState.taskSort,
    statuses,
    tasks,
  });
  return { ...boardState, ...viewModel };
}

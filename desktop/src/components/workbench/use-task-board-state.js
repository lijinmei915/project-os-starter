import { useState } from "react";

export function useTaskBoardState() {
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSort, setTaskSort] = useState("goal");
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSummary, setNewTaskSummary] = useState("");
  const [newTaskGoalId, setNewTaskGoalId] = useState("");
  const [createTaskError, setCreateTaskError] = useState("");
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [goalHistoryOpen, setGoalHistoryOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskSummary, setEditingTaskSummary] = useState("");
  const [editingTaskGoalId, setEditingTaskGoalId] = useState("");
  const [archivingTask, setArchivingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingGoalTitle, setEditingGoalTitle] = useState("");
  const [editingGoalSummary, setEditingGoalSummary] = useState("");
  const [archivingGoal, setArchivingGoal] = useState(null);
  const [mergingGoal, setMergingGoal] = useState(null);
  const [mergeTargetGoalId, setMergeTargetGoalId] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [taskActionDialog, setTaskActionDialog] = useState(null);
  const [taskModelPreflight, setTaskModelPreflight] = useState(false);

  return {
    archivingGoal, archivingTask, createGoalOpen, createTaskError, createTaskOpen,
    deletingTask, editingGoal, editingGoalSummary, editingGoalTitle, editingTask,
    editingTaskGoalId, editingTaskSummary, editingTaskTitle, goalHistoryOpen,
    mergeTargetGoalId, mergingGoal, mutationError, newGoalTitle, newTaskGoalId,
    newTaskSummary, newTaskTitle, setArchivingGoal, setArchivingTask, setCreateGoalOpen,
    setCreateTaskError, setCreateTaskOpen, setDeletingTask, setEditingGoal,
    setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
    setEditingTaskSummary, setEditingTaskTitle, setGoalHistoryOpen, setMergeTargetGoalId,
    setMergingGoal, setMutationError, setNewGoalTitle, setNewTaskGoalId, setNewTaskSummary,
    setNewTaskTitle, setTaskActionDialog, setTaskFilter, setTaskModelPreflight, setTaskSort,
    taskActionDialog, taskFilter, taskModelPreflight, taskSort,
  };
}

import { useState } from "react";

export function useTaskSession({ fallbackPlan }) {
  const [readonlyPlan, setReadonlyPlan] = useState(fallbackPlan);
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  return {
    activeTask,
    activeTaskId,
    readonlyPlan,
    setActiveTaskId,
    setReadonlyPlan,
    setTasks,
    tasks,
  };
}

import { useCallback, useEffect, useState } from "react";

function nextId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useActionFeedback() {
  const [toast, setToast] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const showToast = useCallback((message, variant = "success") => setToast({ id: nextId(), message, variant }), []);
  const beginActionFeedback = useCallback((key, message) => setActionFeedback({ id: nextId(), key, message, status: "running" }), []);
  const finishActionFeedback = useCallback((key, status, message) => {
    setActionFeedback((current) => current?.key && current.key !== key ? current : { id: nextId(), key, message, status });
    showToast(message, status === "failed" ? "danger" : "success");
  }, [showToast]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!actionFeedback || actionFeedback.status === "running") return undefined;
    const timer = window.setTimeout(() => setActionFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);
  return { actionFeedback, beginActionFeedback, finishActionFeedback, showToast, toast };
}

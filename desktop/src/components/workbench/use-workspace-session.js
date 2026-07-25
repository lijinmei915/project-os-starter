import { useCallback, useEffect, useState } from "react";

export function useWorkspaceSession({ fallbackSnapshot, loadSnapshot, runtimeSource }) {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [source, setSource] = useState(runtimeSource());
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const applySnapshot = useCallback((nextSnapshot) => {
    setSnapshot({ ...fallbackSnapshot, ...nextSnapshot });
    setSource(runtimeSource());
    setError("");
  }, [fallbackSnapshot, runtimeSource]);

  const refreshSnapshot = useCallback(async () => {
    const nextSnapshot = await loadSnapshot();
    applySnapshot(nextSnapshot);
    return nextSnapshot;
  }, [applySnapshot, loadSnapshot]);

  useEffect(() => {
    let cancelled = false;
    refreshSnapshot()
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setSource("preview");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [refreshSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => { refreshSnapshot().catch(() => {}); }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  return {
    applySnapshot,
    error,
    loading,
    ready,
    refreshSnapshot,
    setError,
    setLoading,
    setSnapshot,
    snapshot,
    source,
  };
}

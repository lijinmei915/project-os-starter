import { useEffect, useRef } from "react";

// Keeps every Workspace snapshot refresh source on the same debounced lifecycle.
export function useWorkspaceSnapshotRefresh({ isTauri, refreshSnapshot, showToast, workspaceRegistryClient, workspacePath }) {
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (!isTauri) return undefined;
    let cancelled = false;
    let unlisten = null;
    const startWatcher = async () => {
      try {
        unlisten = await workspaceRegistryClient.subscribeWorkspaceFileChanges(async (event) => {
          const now = Date.now();
          if (now - lastRefreshRef.current < 1200) return;
          lastRefreshRef.current = now;
          try {
            await refreshSnapshot();
            if (cancelled) return;
            const path = event.payload?.path ? `：${event.payload.path}` : "";
            showToast(`治理骨架已变化，页面已同步${path}`, "success");
          } catch (err) {
            if (!cancelled) showToast(`治理状态自动同步失败：${err instanceof Error ? err.message : String(err)}`, "danger");
          }
        });
        await workspaceRegistryClient.startWorkspaceFileWatcher();
      } catch (err) {
        if (!cancelled) showToast(`工程文件监听启动失败：${err instanceof Error ? err.message : String(err)}`, "danger");
      }
    };
    startWatcher();
    return () => { cancelled = true; unlisten?.(); };
  }, [isTauri, refreshSnapshot, showToast, workspacePath, workspaceRegistryClient]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 800) return;
      lastRefreshRef.current = now;
      try {
        await refreshSnapshot();
      } catch (err) {
        if (!cancelled) showToast(`治理状态刷新失败：${err instanceof Error ? err.message : String(err)}`, "danger");
      }
    };
    window.addEventListener("omnidesk:snapshot-refresh-requested", refresh);
    return () => { cancelled = true; window.removeEventListener("omnidesk:snapshot-refresh-requested", refresh); };
  }, [refreshSnapshot, showToast, workspacePath]);

  useEffect(() => {
    if (isTauri) return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 30000) return;
      lastRefreshRef.current = now;
      try {
        await refreshSnapshot();
      } catch (err) {
        if (!cancelled) showToast(`治理状态轮询失败：${err instanceof Error ? err.message : String(err)}`, "danger");
      }
    }, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isTauri, refreshSnapshot, showToast, workspacePath]);
}

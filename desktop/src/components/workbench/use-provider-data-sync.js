import { useEffect } from "react";
import { classifyProviderFailure } from "../../lib/provider-presentation";

/** Loads Provider configuration, catalog, and persisted health records. */
export function useProviderDataSync({
  fallbackModelCatalog,
  fallbackProvider,
  getModelCatalog,
  getModelHealth,
  getProviderStatus,
  setComposerModelTests,
  setModelCatalog,
  setProvider,
  setProviderError,
}) {
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getProviderStatus(fallbackProvider),
      getModelCatalog(fallbackModelCatalog),
      getModelHealth().catch(() => ({
        schemaVersion: "omnidesk.model-health.v0.1",
        entries: [],
      })),
    ])
      .then(([status, catalog, modelHealth]) => {
        if (cancelled) return;
        setProvider({ ...fallbackProvider, ...status });
        setModelCatalog({ ...fallbackModelCatalog, ...catalog });
        const entries = Array.isArray(modelHealth?.entries) ? modelHealth.entries : [];
        setComposerModelTests(Object.fromEntries(
          entries.map((entry) => [
            [entry.apiBase || entry.api_base || "", entry.apiKeyEnv || entry.api_key_env || "", entry.model || ""].join("|"),
            {
              checkedAt: entry.checkedAt || entry.checked_at || "",
              message: entry.message || "",
              status: entry.status === "unavailable" ? classifyProviderFailure(entry.message) : (entry.status || "unknown"),
            },
          ])
        ));
      })
      .catch((err) => {
        if (!cancelled) setProviderError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackModelCatalog, fallbackProvider, getModelCatalog, getModelHealth, getProviderStatus, setComposerModelTests, setModelCatalog, setProvider, setProviderError]);
}

import { useEffect, useRef, useState } from "react";
import projectOverviewContract from "../../../../schemas/project-overview-contract.v0.1.json";
import { capabilityManifestSignature } from "../../capability-policy";
import { buildProjectFactStore, diffProjectFactStores } from "../../fact-store";
import { createProjectOverviewSlotRuntime } from "../../project-overview-slot-runtime";
import { clearFactRefreshFailure, readFactRefreshFailure, writeFactRefreshFailure } from "../../lib/workspace-fact-refresh-store";
import { ProjectOverviewHeader, ProjectOverviewSectionSlot, ProjectOverviewSlotRenderer } from "./project-overview-renderer";

export function WorkspaceFactsPreview({ onNavigate, onRefreshFacts, report, snapshot }) {
  const refreshProjectKey = report?.project?.path || snapshot?.currentProjectPath || snapshot?.currentProjectId || snapshot?.projectName || "current-project";
  const refreshSignature = [refreshProjectKey, ...(snapshot?.factFreshness?.changedSources || [])].filter(Boolean).join("|");
  const initialRefreshFailure = readFactRefreshFailure(refreshProjectKey);
  const hasPersistedRefreshFailure = initialRefreshFailure?.signature === refreshSignature;
  const [currentReport, setCurrentReport] = useState(report);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshState, setRefreshState] = useState(hasPersistedRefreshFailure ? "error" : "idle");
  const [refreshError, setRefreshError] = useState(hasPersistedRefreshFailure ? initialRefreshFailure.message : "");
  const [factFreshnessStatus, setFactFreshnessStatus] = useState(snapshot?.factFreshness?.status || "unknown");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(report?.generatedAt || "");
  const [autoRefreshKey, setAutoRefreshKey] = useState("");
  const overviewActionHandlersRef = useRef({});
  const overviewRuntimeRef = useRef(null);
  const overviewRuntimeStateRef = useRef(null);
  if (!overviewRuntimeRef.current) {
    overviewRuntimeRef.current = createProjectOverviewSlotRuntime({
      actions: {
        "refresh-project-facts": (...args) => overviewActionHandlersRef.current["refresh-project-facts"]?.(...args),
        "open-architecture": (...args) => overviewActionHandlersRef.current["open-architecture"]?.(...args),
        "open-source": (...args) => overviewActionHandlersRef.current["open-source"]?.(...args),
      },
      components: { ProjectOverviewHeader, ProjectOverviewSectionSlot },
    });
  }
  const refreshFacts = async () => {
    setRefreshing(true);
    setRefreshError("");
    setRefreshState("loading");
    try {
      const nextReport = await onRefreshFacts?.();
      const refreshedAt = nextReport?.generatedAt || new Date().toISOString();
      if (nextReport) setCurrentReport({ ...nextReport, generatedAt: refreshedAt });
      clearFactRefreshFailure(refreshProjectKey);
      setFactFreshnessStatus("fresh");
      setLastRefreshedAt(refreshedAt);
      setRefreshState("success");
      window.setTimeout(() => setRefreshState("idle"), 1800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "项目事实更新失败";
      writeFactRefreshFailure(refreshProjectKey, { message, signature: refreshSignature });
      setRefreshError(message);
      setRefreshState("error");
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    setCurrentReport(report);
    setFactFreshnessStatus(snapshot?.factFreshness?.status || "unknown");
    if (report?.generatedAt) setLastRefreshedAt((current) => !current || new Date(report.generatedAt) > new Date(current) ? report.generatedAt : current);
  }, [report, snapshot?.factFreshness?.status]);
  useEffect(() => {
    const persistedFailure = readFactRefreshFailure(refreshProjectKey);
    if (persistedFailure?.signature === refreshSignature) {
      setAutoRefreshKey(refreshSignature);
      setRefreshError(persistedFailure.message || "项目事实更新失败");
      setRefreshState("error");
      return;
    }
    setAutoRefreshKey("");
    setRefreshError("");
    setRefreshState("idle");
  }, [refreshProjectKey, refreshSignature]);
  useEffect(() => {
    if (snapshot?.factFreshness?.status !== "stale") return;
    if (!refreshSignature || refreshSignature === autoRefreshKey) return;
    const persistedFailure = readFactRefreshFailure(refreshProjectKey);
    if (persistedFailure?.signature === refreshSignature) {
      setAutoRefreshKey(refreshSignature);
      setRefreshError(persistedFailure.message || "项目事实更新失败");
      setRefreshState("error");
      return;
    }
    setAutoRefreshKey(refreshSignature);
    refreshFacts();
  }, [refreshProjectKey, refreshSignature, snapshot?.factFreshness?.status, autoRefreshKey]);
  const factStore = buildProjectFactStore({ report: currentReport, snapshot: { ...snapshot, factFreshness: { ...snapshot?.factFreshness, status: factFreshnessStatus, updatedAt: lastRefreshedAt || snapshot?.factFreshness?.updatedAt } } });
  overviewActionHandlersRef.current = {
    "refresh-project-facts": () => refreshFacts(),
    "open-architecture": () => onNavigate?.("system-architecture"),
    "open-source": (path) => onNavigate?.({ type: "file", path }),
  };
  const previousRuntimeState = overviewRuntimeStateRef.current;
  const projectChanged = previousRuntimeState?.store.projectId !== factStore.projectId;
  const capabilitySignature = capabilityManifestSignature(snapshot?.projectCapabilities);
  const capabilitiesChanged = previousRuntimeState?.capabilitySignature !== capabilitySignature;
  const changedFactIds = projectChanged ? factStore.facts.map((fact) => fact.id) : diffProjectFactStores(previousRuntimeState?.store, factStore);
  const runtimeResult = !previousRuntimeState || projectChanged || capabilitiesChanged
    ? { descriptors: overviewRuntimeRef.current.compile({ capabilityManifest: snapshot?.projectCapabilities, contract: projectOverviewContract, store: factStore, surface: "project-overview" }) }
    : overviewRuntimeRef.current.reconcile({ capabilityManifest: snapshot?.projectCapabilities, changedFactIds, contract: projectOverviewContract, previousDescriptors: previousRuntimeState.descriptors, sourcePaths: snapshot?.factFreshness?.changedSources || [], store: factStore, surface: "project-overview" });
  const slotDescriptors = runtimeResult.descriptors;
  overviewRuntimeStateRef.current = { capabilitySignature, descriptors: slotDescriptors, store: factStore };
  return <div className="workspaceFacts projectOverviewSurface"><ProjectOverviewSlotRenderer descriptors={slotDescriptors} refreshError={refreshError} refreshState={refreshState} refreshing={refreshing} /></div>;
}

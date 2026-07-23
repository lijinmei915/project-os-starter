export function factRefreshFailureStorageKey(projectKey) {
  return `omnidesk:fact-refresh-failure:${encodeURIComponent(projectKey || "current-project")}`;
}

export function readFactRefreshFailure(projectKey, storage = window.localStorage) {
  try {
    return JSON.parse(storage.getItem(factRefreshFailureStorageKey(projectKey)) || "null");
  } catch {
    return null;
  }
}

export function writeFactRefreshFailure(projectKey, failure, { now = () => new Date(), storage = window.localStorage } = {}) {
  try {
    const previous = readFactRefreshFailure(projectKey, storage);
    storage.setItem(factRefreshFailureStorageKey(projectKey), JSON.stringify({
      ...failure,
      attemptedAt: now().toISOString(),
      retryCount: previous?.signature === failure.signature ? Number(previous.retryCount || 0) + 1 : 1,
    }));
  } catch {
    // Refresh recovery remains available for this session when storage is unavailable.
  }
}

export function clearFactRefreshFailure(projectKey, storage = window.localStorage) {
  try {
    storage.removeItem(factRefreshFailureStorageKey(projectKey));
  } catch {
    // Storage cleanup failure must not turn a successful refresh into an error.
  }
}

import { useCallback, useEffect, useRef, useState } from "react";

const emptyRegistry = { schemaVersion: "omnidesk.mcp-servers.v0.1", servers: [] };

export function useMcpManagement({ client, native, projectId, projectPath }) {
  const [registry, setRegistry] = useState(emptyRegistry);
  const [evidenceByServer, setEvidenceByServer] = useState({});
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const refreshRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      refreshRequestRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const refreshRequest = ++refreshRequestRef.current;
    const canCommit = () => mountedRef.current && refreshRequest === refreshRequestRef.current;
    if (!native) {
      if (canCommit()) {
        setRegistry(emptyRegistry);
        setEvidenceByServer({});
        setError("");
      }
      return emptyRegistry;
    }
    if (canCommit()) {
      setLoading(true);
      setError("");
    }
    try {
      const nextRegistry = await client.getMcpServerRegistry();
      const servers = Array.isArray(nextRegistry?.servers) ? nextRegistry.servers : [];
      const evidence = await Promise.all(servers.map(async (server) => {
        if (!server.enabled) return [server.id, null];
        return [server.id, await client.getMcpDiscoveryEvidence(server.id)];
      }));
      if (canCommit()) {
        setRegistry(nextRegistry);
        setEvidenceByServer(Object.fromEntries(evidence));
      }
      return nextRegistry;
    } catch (error_) {
      if (canCommit()) setError(error_ instanceof Error ? error_.message : String(error_));
      return emptyRegistry;
    } finally {
      if (canCommit()) setLoading(false);
    }
  }, [client, native]);

  useEffect(() => {
    void refresh();
  }, [projectId, projectPath, refresh]);

  const perform = useCallback(async (key, operation, { refreshAfter = false } = {}) => {
    if (!native) throw new Error("浏览器预览不能管理 MCP，请在桌面 App 窗口里使用。");
    if (mountedRef.current) {
      setBusyKey(key);
      setError("");
    }
    try {
      const result = await operation();
      if (refreshAfter) await refresh();
      return result;
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : String(error_);
      if (mountedRef.current) setError(message);
      throw error_;
    } finally {
      if (mountedRef.current) setBusyKey("");
    }
  }, [native, refresh]);

  return {
    busyKey,
    error,
    evidenceByServer,
    loading,
    native,
    refresh,
    registry,
    removeServer: (id) => perform(`remove:${id}`, () => client.removeMcpServer(id), { refreshAfter: true }),
    requestCall: (serverId, remoteName, arguments_) => perform(`call:${serverId}:${remoteName}`, () => client.requestMcpCall(serverId, remoteName, arguments_)),
    requestDiscovery: (serverId) => perform(`discover:${serverId}`, () => client.requestMcpDiscovery(serverId)),
    saveServer: (server) => perform(`save:${server.id || "new"}`, () => client.saveMcpServer(server), { refreshAfter: true }),
  };
}

import React, { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Trash2, Wrench } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { buildMcpToolArguments, emptyMcpServerDraft, initialMcpToolValues, mcpServerDraft, mcpToolFields } from "../../lib/mcp-tool-form";
import { useMcpManagement } from "./use-mcp-management";

const activeRunStatuses = new Set(["awaiting-approval", "queued", "running", "interrupted"]);

function runToolName(run) {
  return run?.checkpoint?.toolName || run?.approval?.name || "";
}

function runServerId(run) {
  return run?.checkpoint?.toolArguments?.serverId || run?.approval?.arguments?.serverId || "";
}

function runStatus(run) {
  return {
    "awaiting-approval": "等待审批",
    cancelled: "已取消",
    completed: "已完成",
    failed: "失败",
    interrupted: "已中断",
    queued: "等待继续",
    running: "正在执行",
    succeeded: "已完成",
  }[run?.status] || run?.status || "未知状态";
}

function McpRunRow({ busy, onApprove, onCancel, onExport, run }) {
  const toolName = runToolName(run);
  const action = toolName === "mcp_discover" ? "发现工具" : "调用工具";
  const remoteName = run?.checkpoint?.toolArguments?.remoteName;
  return (
    <div className="mcpRunRow" data-mcp-run-id={run.id}>
      <div>
        <strong>{action}{remoteName ? ` · ${remoteName}` : ""}</strong>
        <span>{run.summary || `${action}已进入受控执行流程。`}</span>
      </div>
      <Badge status={runStatus(run)}>{runStatus(run)}</Badge>
      <div className="mcpInlineActions">
        {run.status === "awaiting-approval" ? <Button disabled={busy} size="sm" type="button" variant="primary" onClick={() => onApprove(run)}>批准并执行</Button> : null}
        {activeRunStatuses.has(run.status) ? <Button disabled={busy} size="sm" type="button" variant="ghost" onClick={() => onCancel(run)}>取消</Button> : null}
        <Button disabled={busy} size="sm" type="button" variant="ghost" onClick={() => onExport(run)}>导出证据</Button>
      </div>
    </div>
  );
}

function ServerEditor({ busy, existing, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => mcpServerDraft(existing));
  const [error, setError] = useState("");
  useEffect(() => setDraft(mcpServerDraft(existing)), [existing]);
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateArg = (index, value) => update({ args: draft.args.map((arg, itemIndex) => itemIndex === index ? value : arg) });
  const updateEnv = (index, patch) => update({ env: draft.env.map((binding, itemIndex) => itemIndex === index ? { ...binding, ...patch } : binding) });
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!/^[a-z0-9_-]{1,64}$/.test(draft.id)) {
      setError("ID 仅支持小写字母、数字、- 和 _。");
      return;
    }
    if (!draft.name.trim() || !draft.command.trim()) {
      setError("请填写名称和启动命令。");
      return;
    }
    try {
      await onSave({
        ...draft,
        args: draft.args.map((value) => value.trim()).filter(Boolean),
        command: draft.command.trim(),
        env: draft.env.map((binding) => ({ name: binding.name.trim(), sourceEnv: binding.sourceEnv.trim() })).filter((binding) => binding.name || binding.sourceEnv),
        id: draft.id.trim(),
        name: draft.name.trim(),
      });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : String(error_));
    }
  };

  return (
    <form className="mcpEditor" onSubmit={submit}>
      <div className="mcpEditorGrid">
        <Field label="Server ID" hint={existing ? "保存后不可改名；如需新 ID，请新建 Server。" : "小写字母、数字、- 或 _。"}>{({ id }) => <Input id={id} autoComplete="off" disabled={Boolean(existing)} value={draft.id} onChange={(event) => update({ id: event.target.value })} />}</Field>
        <Field label="显示名称">{({ id }) => <Input id={id} autoComplete="off" value={draft.name} onChange={(event) => update({ name: event.target.value })} />}</Field>
        <Field className="mcpEditorCommand" label="启动命令" hint="填写可执行文件名或绝对路径，不要粘贴带空格的整条 Shell 命令。">{({ id }) => <Input id={id} autoComplete="off" placeholder="npx 或 /absolute/path/server" value={draft.command} onChange={(event) => update({ command: event.target.value })} />}</Field>
        <div className="mcpSwitchField"><div><strong>启用 Server</strong><span>关闭后不能发现或调用。</span></div><Switch aria-label="启用 Server" checked={draft.enabled} onCheckedChange={(enabled) => update({ enabled })} /></div>
      </div>

      <div className="mcpEditorCollection">
        <div className="mcpSubsectionHeader"><div><strong>启动参数</strong><span>每一行会作为一个独立参数传给进程。</span></div><Button size="sm" type="button" variant="ghost" onClick={() => update({ args: [...draft.args, ""] })}><Plus aria-hidden="true" size={13} />添加参数</Button></div>
        {draft.args.map((arg, index) => <div className="mcpConfigRow" key={`arg-${index}`}><Input aria-label={`启动参数 ${index + 1}`} value={arg} onChange={(event) => updateArg(index, event.target.value)} /><Button aria-label={`删除启动参数 ${index + 1}`} size="icon" title="删除参数" type="button" variant="ghost" onClick={() => update({ args: draft.args.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 aria-hidden="true" size={13} /></Button></div>)}
        {!draft.args.length ? <span className="mcpEmptyLine">没有启动参数</span> : null}
      </div>

      <div className="mcpEditorCollection">
        <div className="mcpSubsectionHeader"><div><strong>环境变量映射</strong><span>只保存变量名，不保存密钥值。</span></div><Button size="sm" type="button" variant="ghost" onClick={() => update({ env: [...draft.env, { name: "", sourceEnv: "" }] })}><Plus aria-hidden="true" size={13} />添加映射</Button></div>
        {draft.env.map((binding, index) => <div className="mcpConfigRow mcpEnvRow" key={`env-${index}`}><Input aria-label={`Server 环境变量 ${index + 1}`} placeholder="传给 Server，如 API_KEY" value={binding.name} onChange={(event) => updateEnv(index, { name: event.target.value })} /><Input aria-label={`本机来源环境变量 ${index + 1}`} placeholder="本机变量，如 MY_API_KEY" value={binding.sourceEnv} onChange={(event) => updateEnv(index, { sourceEnv: event.target.value })} /><Button aria-label={`删除环境变量映射 ${index + 1}`} size="icon" title="删除映射" type="button" variant="ghost" onClick={() => update({ env: draft.env.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 aria-hidden="true" size={13} /></Button></div>)}
        {!draft.env.length ? <span className="mcpEmptyLine">没有环境变量映射</span> : null}
      </div>

      {error ? <Notice variant="danger">{error}</Notice> : null}
      <div className="mcpEditorActions"><Button disabled={busy} type="button" variant="ghost" onClick={onCancel}>取消</Button><Button disabled={busy} type="submit" variant="primary"><Save aria-hidden="true" size={13} />保存 Server</Button></div>
    </form>
  );
}

function McpToolCallForm({ busy, onCancel, onRequestCall, serverId, tool }) {
  const schema = tool?.descriptor?.inputSchema || { type: "object" };
  const fields = useMemo(() => mcpToolFields(schema), [schema]);
  const [values, setValues] = useState(() => initialMcpToolValues(schema));
  const [errors, setErrors] = useState({});
  useEffect(() => {
    setValues(initialMcpToolValues(schema));
    setErrors({});
  }, [schema, tool?.remoteName]);
  const submit = async (event) => {
    event.preventDefault();
    const result = buildMcpToolArguments(schema, values);
    setErrors(result.errors);
    if (!result.valid) return;
    await onRequestCall(serverId, tool.remoteName, result.arguments_);
  };
  return (
    <form className="mcpToolForm" onSubmit={submit}>
      {!fields.length ? <Notice variant="muted">此工具不需要参数。提交后仍会先创建独立审批。</Notice> : null}
      <div className="mcpToolFieldGrid">
        {fields.map((field) => {
          const label = `${field.name}${field.required ? " *" : ""}`;
          const hint = field.description || `${field.type}${field.required ? " · 必填" : " · 可选"}`;
          if (field.type === "boolean") return <div className="mcpSwitchField" key={field.name}><div><strong>{label}</strong><span>{hint}</span></div><Switch aria-label={label} checked={Boolean(values[field.name])} onCheckedChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} /></div>;
          if (field.type === "null") return <Notice key={field.name} variant="muted">{label}：提交时固定为空值。</Notice>;
          return <Field error={errors[field.name]} hint={hint} key={field.name} label={label}>{({ id }) => field.enum
            ? <Select id={id} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">请选择</option>{field.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</Select>
            : ["object", "array"].includes(field.type)
              ? <Textarea id={id} rows={3} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
              : <Input id={id} inputMode={["number", "integer"].includes(field.type) ? "numeric" : undefined} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}</Field>;
        })}
      </div>
      <div className="mcpEditorActions"><Button type="button" variant="ghost" onClick={onCancel}>收起</Button><Button disabled={busy} type="submit" variant="primary"><Wrench aria-hidden="true" size={13} />创建调用审批</Button></div>
    </form>
  );
}

export function McpManagementPanel({ agentRuns = [], client, native, onApproveAgentRun, onCancelAgentRun, onExportAgentRun, onRefreshAgentRuns, projectId, projectPath }) {
  const management = useMcpManagement({ client, native, projectId, projectPath });
  const servers = Array.isArray(management?.registry?.servers) ? management.registry.servers : [];
  const [selectedServerId, setSelectedServerId] = useState("");
  const [editingServerId, setEditingServerId] = useState(null);
  const [callingTool, setCallingTool] = useState("");
  const [deletingServerId, setDeletingServerId] = useState("");
  const [runBusyId, setRunBusyId] = useState("");
  useEffect(() => {
    if (!servers.length) setSelectedServerId("");
    else if (!servers.some((server) => server.id === selectedServerId)) setSelectedServerId(servers[0].id);
  }, [selectedServerId, servers]);
  const selectedServer = servers.find((server) => server.id === selectedServerId) || null;
  const evidence = selectedServer ? management.evidenceByServer?.[selectedServer.id] : null;
  const tools = Array.isArray(evidence?.result?.tools) ? evidence.result.tools : [];
  const mcpRuns = agentRuns.filter((run) => run?.executorId === "tool-gateway" && ["mcp_discover", "mcp_call"].includes(runToolName(run)));
  const selectedRuns = selectedServer ? mcpRuns.filter((run) => runServerId(run) === selectedServer.id).slice(0, 6) : [];
  const pendingDiscoveryFor = (serverId) => mcpRuns.some((run) => runServerId(run) === serverId && runToolName(run) === "mcp_discover" && activeRunStatuses.has(run.status));

  const requestAndRefreshRuns = async (operation) => {
    let result;
    try {
      result = await operation();
    } catch {
      return { ok: false, result: null };
    }
    try {
      await onRefreshAgentRuns?.();
    } catch {}
    return { ok: true, result };
  };
  const handleRunAction = async (run, operation, refreshEvidence = false) => {
    setRunBusyId(run.id);
    try {
      await operation(run);
      if (refreshEvidence) await management.refresh();
    } finally {
      setRunBusyId("");
    }
  };

  if (!management.native) return <Notice variant="info">MCP 配置、发现与调用只能在桌面 App 中操作；浏览器预览保持只读。</Notice>;

  return (
    <div className="mcpManagement" data-mcp-management>
      {management.error ? <Notice variant="danger">{management.error}</Notice> : null}
      <section className="mcpSection" aria-labelledby="mcp-servers-title">
        <div className="mcpSectionHeader"><div><strong id="mcp-servers-title">MCP Servers</strong><span>配置 stdio Server；密钥只通过本机环境变量引用。</span></div><div className="mcpInlineActions"><Button disabled={management.loading} size="sm" type="button" variant="ghost" onClick={() => management.refresh()}><RefreshCw aria-hidden="true" size={13} />刷新</Button><Button size="sm" type="button" variant="outline" onClick={() => setEditingServerId("")}><Plus aria-hidden="true" size={13} />添加 Server</Button></div></div>
        {management.loading ? <Notice variant="muted">正在读取 MCP 配置…</Notice> : null}
        {!management.loading && !servers.length && editingServerId === null ? <Notice variant="info">尚未配置 MCP Server。添加后，发现工具仍需单独审批。</Notice> : null}
        {servers.length ? <div className="mcpServerList" role="list">{servers.map((server) => {
          const removeKey = `remove:${server.id}`;
          const removing = management.busyKey === removeKey;
          return <div className={server.id === selectedServerId ? "mcpServerRow is-selected" : "mcpServerRow"} key={server.id} role="listitem"><button className="mcpServerSelect" type="button" onClick={() => { setSelectedServerId(server.id); setCallingTool(""); }}><span><strong>{server.name}</strong><code>{server.id}</code></span><span>{server.command}</span></button><Badge status={server.enabled ? "可用" : "已暂停"}>{server.enabled ? "已启用" : "已停用"}</Badge><div className="mcpInlineActions"><Button disabled={!server.enabled || pendingDiscoveryFor(server.id) || Boolean(management.busyKey)} size="sm" type="button" variant="primary" onClick={() => requestAndRefreshRuns(() => management.requestDiscovery(server.id))}>{pendingDiscoveryFor(server.id) ? "等待审批" : "发现工具"}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setEditingServerId(server.id)}>编辑</Button><Dialog open={deletingServerId === server.id} onOpenChange={(open) => { if (open) setDeletingServerId(server.id); else if (!removing) setDeletingServerId(""); }}><DialogTrigger asChild><Button aria-label={`删除 ${server.name}`} size="icon" title="删除 Server" type="button" variant="ghost"><Trash2 aria-hidden="true" size={13} /></Button></DialogTrigger><DialogContent title="删除 MCP Server？" description="配置会被删除；已有运行证据仍保留，但该 Server 将不能继续发现或调用。">{management.error ? <Notice variant="danger">{management.error}</Notice> : null}<div className="mcpDialogActions"><DialogClose asChild><Button disabled={removing} type="button" variant="ghost">取消</Button></DialogClose><Button disabled={Boolean(management.busyKey)} type="button" variant="danger" onClick={async () => { try { await management.removeServer(server.id); setDeletingServerId(""); } catch {} }}>{removing ? "正在删除" : "确认删除"}</Button></div></DialogContent></Dialog></div></div>;
        })}</div> : null}
        {editingServerId !== null ? <ServerEditor busy={Boolean(management.busyKey)} existing={servers.find((server) => server.id === editingServerId)} onCancel={() => setEditingServerId(null)} onSave={async (server) => { await management.saveServer(server); setSelectedServerId(server.id); setEditingServerId(null); }} /> : null}
      </section>

      {selectedServer ? <section className="mcpSection" aria-labelledby="mcp-approvals-title"><div className="mcpSectionHeader"><div><strong id="mcp-approvals-title">审批与运行</strong><span>发现与每次调用分别审批，取消后不会启动 Server。</span></div></div>{selectedRuns.length ? <div className="mcpRunList">{selectedRuns.map((run) => <McpRunRow busy={runBusyId === run.id} key={run.id} run={run} onApprove={(item) => handleRunAction(item, onApproveAgentRun, runToolName(item) === "mcp_discover")} onCancel={(item) => handleRunAction(item, onCancelAgentRun)} onExport={(item) => handleRunAction(item, onExportAgentRun)} />)}</div> : <Notice variant="muted">当前 Server 暂无发现或调用审批记录。</Notice>}</section> : null}

      {selectedServer ? <section className="mcpSection" aria-labelledby="mcp-tools-title"><div className="mcpSectionHeader"><div><strong id="mcp-tools-title">已发现工具</strong><span>{evidence ? `${tools.length} 个工具 · ${evidence.discoveredAt || "已记录证据"}` : "需要先批准一次能力发现。"}</span></div>{evidence?.result?.truncated ? <Badge status="需注意">结果已截断</Badge> : null}</div>{tools.length ? <div className="mcpToolList">{tools.map((tool) => <div className="mcpToolRow" key={tool.remoteName}><div className="mcpToolHeader"><div><strong>{tool.remoteName}</strong><span>{tool.descriptor?.description || "无说明"}</span></div><Button disabled={Boolean(management.busyKey)} size="sm" type="button" variant={callingTool === tool.remoteName ? "secondary" : "outline"} onClick={() => setCallingTool((current) => current === tool.remoteName ? "" : tool.remoteName)}>{callingTool === tool.remoteName ? "收起" : "准备调用"}</Button></div>{callingTool === tool.remoteName ? <McpToolCallForm busy={Boolean(management.busyKey)} onCancel={() => setCallingTool("")} onRequestCall={async (serverId, remoteName, arguments_) => { const request = await requestAndRefreshRuns(() => management.requestCall(serverId, remoteName, arguments_)); if (request.ok) setCallingTool(""); }} serverId={selectedServer.id} tool={tool} /> : null}</div>)}</div> : <Notice variant="info">尚无有效发现结果。配置变更或切换项目后，需要重新发现。</Notice>}</section> : null}
    </div>
  );
}

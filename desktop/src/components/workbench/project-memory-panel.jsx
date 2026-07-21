import React, { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { Panel } from "../ui/panel";
import { Tooltip } from "../ui/tooltip";
import { OverviewPageHeader } from "./overview-section";
import { getProjectMemory, saveProjectMemory } from "../../lib/project-memory-client";
import { appendMemoryAudit, normalizeProjectMemory } from "../../lib/project-memory";

const kindLabels = {
  constraint: "协作约束",
  decision: "决策",
  lesson: "经验",
  preference: "偏好",
  result: "执行结果",
};

const auditLabels = {
  read: "已用于对话",
  "write-created": "已沉淀候选",
  "write-merged": "已合并重复记忆",
  "write-conflict": "发现冲突",
};

function sourceLabel(item) {
  if (item.source?.taskId) return `任务 ${item.source.taskId}`;
  if (item.source?.conversationId) return `对话 ${item.source.conversationId}`;
  return "项目记忆";
}

function formatTime(value) {
  if (!value) return "刚刚记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function MemoryItem({ item, onConfirm, onForget, onUpdate, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);
  const saveEdit = () => {
    const content = draft.trim();
    if (!content) return;
    onUpdate(item.id, content);
    setEditing(false);
  };
  return (
    <Panel as="article" className="projectMemoryItem" padding="sm">
      <div className="projectMemoryItemHead">
        <div className="projectMemoryItemMeta">
          <Badge variant={item.status === "confirmed" ? "success" : "warning"}>{item.status === "confirmed" ? "已确认" : "待确认"}</Badge>
          <Badge variant="neutral">{kindLabels[item.kind] || "记忆"}</Badge>
          {item.conflictsWith?.length ? <Badge variant="danger">存在冲突</Badge> : null}
          <span>{sourceLabel(item)}</span>
          <span>{formatTime(item.updatedAt || item.createdAt)}</span>
        </div>
        <div className="projectMemoryItemActions">
          {item.status === "candidate" ? <Tooltip content="确认后才会供后续对话使用"><Button aria-label="确认记忆" disabled={saving} size="icon" variant="ghost" onClick={() => onConfirm(item.id)}><Check aria-hidden="true" size={15} /></Button></Tooltip> : null}
          <Tooltip content={editing ? "保存修正" : "修正内容"}><Button aria-label={editing ? "保存修正" : "修正记忆"} disabled={saving} size="icon" variant="ghost" onClick={editing ? saveEdit : () => setEditing(true)}>{editing ? <Check aria-hidden="true" size={15} /> : <Pencil aria-hidden="true" size={14} />}</Button></Tooltip>
          <Tooltip content="遗忘此条记忆"><Button aria-label="遗忘记忆" disabled={saving} size="icon" variant="ghost" onClick={() => onForget(item.id)}><Trash2 aria-hidden="true" size={15} /></Button></Tooltip>
        </div>
      </div>
      {editing ? <div className="projectMemoryEdit"><Input aria-label="记忆内容" value={draft} onChange={(event) => setDraft(event.target.value)} /><Button size="sm" variant="outline" onClick={() => { setDraft(item.content); setEditing(false); }}>取消</Button></div> : <p>{item.content}</p>}
      <footer>置信度 {Math.round(item.confidence * 100)}% · 版本 {item.version || 1}{item.conflictsWith?.length ? ` · 与 ${item.conflictsWith.length} 条记忆冲突` : ""}</footer>
    </Panel>
  );
}

export function ProjectMemoryPanel({ onOpenSource, renderSourceButtons }) {
  const [memory, setMemory] = useState(() => normalizeProjectMemory());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setMemory(normalizeProjectMemory(await getProjectMemory())); } catch (cause) { setError(cause instanceof Error ? cause.message : "读取项目记忆失败。"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const persist = async (next) => {
    setSaving(true);
    setError("");
    try { setMemory(normalizeProjectMemory(await saveProjectMemory(next))); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存项目记忆失败。"); } finally { setSaving(false); }
  };
  const update = (id, patch, audit) => persist(appendMemoryAudit({
    ...memory,
    items: memory.items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString(), version: (item.version || 1) + 1 } : item),
  }, { itemIds: [id], type: audit?.type || "write-updated", reason: audit?.reason || "用户修正了记忆内容。" }));
  const confirm = (id) => {
    const item = memory.items.find((entry) => entry.id === id);
    const conflicts = new Set(item?.conflictsWith || []);
    const now = new Date().toISOString();
    persist(appendMemoryAudit({
      ...memory,
      items: memory.items.map((entry) => entry.id === id
        ? { ...entry, status: "confirmed", updatedAt: now, version: (entry.version || 1) + 1 }
        : conflicts.has(entry.id) ? { ...entry, status: "superseded", updatedAt: now, version: (entry.version || 1) + 1 } : entry),
    }, { itemIds: [id, ...conflicts], type: conflicts.size ? "write-resolved-conflict" : "write-confirmed", reason: conflicts.size ? "用户确认新记忆，并替代相反的既有记忆。" : "用户确认候选记忆可供后续对话使用。" }));
  };
  const forget = (id) => persist(appendMemoryAudit({ ...memory, items: memory.items.filter((entry) => entry.id !== id) }, { itemIds: [id], type: "write-forgotten", reason: "用户遗忘此条记忆。" }));
  const confirmed = memory.items.filter((item) => item.status === "confirmed");
  const candidates = memory.items.filter((item) => item.status === "candidate");
  return <section className="overviewSurface projectMemorySurface">
    <OverviewPageHeader
      title="长期记忆"
      description="已确认的内容会在后续相关对话中作为协作上下文使用；候选内容必须先由你确认。"
      meta={<span>{memory.updatedAt ? `更新于 ${formatTime(memory.updatedAt)}` : "尚未沉淀记忆"}</span>}
      sources={renderSourceButtons(onOpenSource, [".omnidesk/data/memory.json", "docs/DECISIONS.md", "docs/LESSONS.md"])}
      status={<Badge variant={confirmed.length ? "success" : "neutral"}>{confirmed.length ? `${confirmed.length} 条已确认` : "尚未确认"}</Badge>}
    />
    {error ? <Notice variant="danger">{error}</Notice> : null}
    <section className="projectMemorySection">
      <header><div><strong>待确认</strong><span>模型归纳的决策和结果不会自动影响后续回答。</span></div><Badge variant={candidates.length ? "warning" : "neutral"}>{candidates.length} 条</Badge></header>
      {loading ? <Notice variant="muted">正在读取当前项目的记忆。</Notice> : candidates.length ? <div className="projectMemoryList">{candidates.map((item) => <MemoryItem item={item} key={item.id} saving={saving} onConfirm={confirm} onForget={forget} onUpdate={(id, content) => update(id, { content })} />)}</div> : <Notice variant="muted">暂无待确认内容。</Notice>}
    </section>
    <section className="projectMemorySection">
      <header><div><strong>已确认</strong><span>仅这些未过期的记忆可被当前项目的后续对话检索。</span></div><Badge variant="success">{confirmed.length} 条</Badge></header>
      {loading ? null : confirmed.length ? <div className="projectMemoryList">{confirmed.map((item) => <MemoryItem item={item} key={item.id} saving={saving} onConfirm={() => {}} onForget={forget} onUpdate={(id, content) => update(id, { content })} />)}</div> : <Notice variant="muted">尚无已确认记忆。你在对话中给出的明确协作约束会自动沉淀到这里。</Notice>}
    </section>
    <section className="projectMemorySection">
      <header><div><strong>最近使用记录</strong><span>记录条目 ID、选择原因和请求关联，不重复保存记忆正文。</span></div><Badge variant="neutral">{memory.audit.length} 条</Badge></header>
      {loading ? null : memory.audit.length ? <div className="projectMemoryAudit">{memory.audit.slice(-8).reverse().map((event) => <div key={event.id}><Badge variant={event.type === "write-conflict" ? "danger" : event.type === "read" ? "info" : "neutral"}>{auditLabels[event.type] || event.type}</Badge><p>{event.reason || "未提供原因"}</p><span>{formatTime(event.at)} · {event.itemIds.length ? `${event.itemIds.length} 条记忆` : "未关联条目"}{event.requestId ? ` · 请求 ${event.requestId}` : ""}</span></div>)}</div> : <Notice variant="muted">尚无读写记录。</Notice>}
    </section>
  </section>;
}

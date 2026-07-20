import React, { useMemo, useState } from "react";
import { FileCode2, Search } from "lucide-react";

import { componentGovernanceGroups } from "../../design-governance-catalog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { OverviewPageHeader, OverviewSection } from "./overview-section";

function ComponentPreview({ componentId }) {
  if (componentId === "button") return <div className="componentPreviewRow"><Button variant="primary">主要操作</Button><Button>默认操作</Button><Button variant="ghost">幽灵操作</Button><Button disabled>不可用</Button></div>;
  if (componentId === "badge") return <div className="componentPreviewRow"><Badge variant="neutral">中性</Badge><Badge variant="info">信息 / 推进</Badge><Badge variant="success">成功 / 可用</Badge><Badge variant="warning">提醒 / 风险</Badge><Badge variant="danger">失败 / 阻塞</Badge></div>;
  if (componentId === "input") return <div className="componentPreviewColumn"><Input aria-label="组件预览输入框" defaultValue="OmniDesk" /><Input aria-label="不可用输入框" disabled value="不可编辑" readOnly /></div>;
  if (componentId === "select") return <Select aria-label="组件预览选择框" defaultValue="ready"><option value="ready">已就绪</option><option value="running">处理中</option><option value="done">已完成</option></Select>;
  if (componentId === "tabs") return <Tabs defaultValue="preview"><TabsList><TabsTrigger value="preview">预览</TabsTrigger><TabsTrigger value="usage">用法</TabsTrigger></TabsList><TabsContent value="preview"><Notice variant="muted">当前标签内容</Notice></TabsContent><TabsContent value="usage"><Notice variant="info">并列视图保持同一上下文。</Notice></TabsContent></Tabs>;
  if (componentId === "notice") return <div className="componentPreviewColumn"><Notice variant="info">信息反馈</Notice><Notice variant="success">操作成功</Notice><Notice variant="danger">操作失败</Notice></div>;
  if (componentId === "switch") return <div className="componentPreviewRow"><Switch aria-label="关闭状态" /><Switch aria-label="开启状态" defaultChecked /><Switch aria-label="不可用状态" disabled /></div>;
  if (componentId === "overview-page-header") return <OverviewPageHeader title="治理页面标题" description="说明当前页面的唯一职责和数据来源。" status={<Badge status="done">已登记</Badge>} actions={<Button size="sm">页面动作</Button>} />;
  if (componentId === "overview-section") return <OverviewSection title="治理分区" subtitle="一至三项自适应" items={[{ label: "状态", content: "已接入" }, { label: "来源", content: "OmniDesk" }, { label: "下一步", content: "保持同步" }]} />;
  return <Notice variant="muted">该组件是结构型 Pattern 或 Composition，完整效果请在右侧“使用页面”所列工作面查看。</Notice>;
}

export function ComponentGovernancePanel({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("button");
  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return componentGovernanceGroups;
    return componentGovernanceGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => `${item.name} ${item.summary}`.toLowerCase().includes(normalized)),
    })).filter((group) => group.items.length);
  }, [query]);
  const selected = componentGovernanceGroups.flatMap((group) => group.items).find((item) => item.id === selectedId)
    || filteredGroups[0]?.items[0]
    || componentGovernanceGroups[0].items[0];

  return (
    <div className="designGovernanceSurface">
      <OverviewPageHeader
        title="组件"
        description="查看 OmniDesk 已登记的真实组件、状态、使用边界与源码归属。"
        status={<Badge>{componentGovernanceGroups.reduce((total, group) => total + group.items.length, 0)} 个已登记</Badge>}
        sources={<><code>docs/design/component-index.md</code><code>desktop/src/components</code></>}
      />
      <div className="governanceCatalogLayout">
        <aside className="governanceCatalog" aria-label="组件目录">
          <label className="governanceCatalogSearch">
            <Search aria-hidden="true" />
            <Input aria-label="搜索组件" onChange={(event) => setQuery(event.target.value)} placeholder="搜索组件" value={query} />
          </label>
          <div className="governanceCatalogGroups">
            {filteredGroups.length ? filteredGroups.map((group) => (
              <section className="governanceCatalogGroup" key={group.id}>
                <header><strong>{group.title}</strong><span>{group.items.length}</span></header>
                {group.items.map((item) => (
                  <button className={`governanceCatalogItem${selected.id === item.id ? " active" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
                    <strong>{item.name}</strong>
                    <span>{item.summary}</span>
                  </button>
                ))}
              </section>
            )) : <Notice variant="muted">没有匹配的组件。</Notice>}
          </div>
        </aside>
        <section className="governanceDetail">
          <header className="governanceDetailHeader">
            <div><span>组件详情</span><h3>{selected.name}</h3><p>{selected.summary}</p></div>
            <Button onClick={() => onNavigate?.({ type: "file", path: selected.sourcePath })} size="sm"><FileCode2 aria-hidden="true" />查看源码</Button>
          </header>
          <section className="componentPreviewStage" aria-label={`${selected.name} 预览`}><ComponentPreview componentId={selected.id} /></section>
          <div className="governanceDetailGrid">
            <section><span>Variants</span><div className="governancePills">{selected.variants.map((item) => <code key={item}>{item}</code>)}</div></section>
            <section><span>Size</span><div className="governancePills">{selected.sizes.map((item) => <code key={item}>{item}</code>)}</div></section>
            <section><span>States</span><div className="governancePills">{selected.states.map((item) => <code key={item}>{item}</code>)}</div></section>
            <section><span>使用页面</span><div className="governancePills">{selected.usedBy.map((item) => <span key={item}>{item}</span>)}</div></section>
          </div>
          <section className="governanceSourceRow"><div><span>源码位置</span><code>{selected.sourcePath}</code></div><Badge status="done">基础可访问性已覆盖</Badge></section>
        </section>
      </div>
    </div>
  );
}

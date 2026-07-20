import React, { useState } from "react";
import { FileCode2 } from "lucide-react";

import { tokenGovernanceGroups } from "../../design-governance-catalog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { OverviewPageHeader } from "./overview-section";

function TokenSample({ token }) {
  if (token.sample === "color") return <span className="tokenColorSample" style={{ background: `var(${token.name})` }} />;
  if (token.sample === "type" || token.sample === "mono") return <span className={`tokenTypeSample${token.sample === "mono" ? " mono" : ""}`} style={token.sample === "type" ? { fontSize: `var(${token.name})` } : undefined}>Aa</span>;
  if (token.sample === "space") return <span className="tokenSpaceSample" style={{ width: `var(${token.name})` }} />;
  return <span className="tokenRadiusSample" style={{ borderRadius: `var(${token.name})` }} />;
}

export function TokenGovernancePanel({ onNavigate }) {
  const [selectedGroupId, setSelectedGroupId] = useState(tokenGovernanceGroups[0].id);
  const selectedGroup = tokenGovernanceGroups.find((group) => group.id === selectedGroupId) || tokenGovernanceGroups[0];
  const tokenCount = tokenGovernanceGroups.reduce((total, group) => total + group.tokens.length, 0);

  return (
    <div className="designGovernanceSurface">
      <OverviewPageHeader
        title="Token"
        description="查看当前桌面端实际使用的语义变量；文档定义规则，CSS 提供运行时值。"
        status={<Badge>{tokenCount} 个代表 Token</Badge>}
        actions={<Button onClick={() => onNavigate?.({ type: "file", path: "desktop/src/styles.css" })} size="sm"><FileCode2 aria-hidden="true" />查看样式源</Button>}
        sources={<><code>docs/design/tokens.md</code><code>desktop/src/styles.css</code></>}
      />
      <div className="governanceCatalogLayout tokenCatalogLayout">
        <aside className="governanceCatalog" aria-label="Token 分类">
          <div className="governanceCatalogGroups">
            {tokenGovernanceGroups.map((group) => (
              <button className={`tokenGroupButton${selectedGroup.id === group.id ? " active" : ""}`} key={group.id} onClick={() => setSelectedGroupId(group.id)} type="button">
                <span><strong>{group.title}</strong><small>{group.description}</small></span>
                <Badge>{group.tokens.length}</Badge>
              </button>
            ))}
          </div>
        </aside>
        <section className="governanceDetail">
          <header className="governanceDetailHeader"><div><span>Token 分类</span><h3>{selectedGroup.title}</h3><p>{selectedGroup.description}</p></div></header>
          <div className="tokenTable" role="table" aria-label={`${selectedGroup.title} Token`}>
            <div className="tokenTableHeader" role="row"><span>预览</span><span>变量</span><span>用途</span></div>
            {selectedGroup.tokens.map((token) => (
              <div className="tokenTableRow" key={token.name} role="row">
                <TokenSample token={token} />
                <code>{token.name}</code>
                <span>{token.usage}</span>
              </div>
            ))}
          </div>
          <section className="governanceSourceRow"><div><span>治理规则</span><p>组件只读取语义 Token；新增原始视觉值必须先进入 Token 层。</p></div><Badge status="done">运行时已接入</Badge></section>
        </section>
      </div>
    </div>
  );
}

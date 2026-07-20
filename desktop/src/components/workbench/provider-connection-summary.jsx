import { Button } from "../ui/button";

export function ProviderConnectionSummary({ connectionName, enabled, hasApiKey, isPreview, model, onTest, status, statusLabel, testing }) {
  return (
    <section className={`providerConnectionSummary ${status}`} aria-label="当前连接状态">
      <div>
        <strong>{connectionName || "当前连接"}</strong>
        <span>{model || "未选模型"} · {enabled ? "已启用" : "未启用"} · {hasApiKey ? "Key 已保存" : "未保存 Key"}</span>
      </div>
      <div className="providerConnectionSummaryAction">
        <span>{statusLabel}</span>
        <Button className="textAction" size="sm" variant="ghost" type="button" onClick={onTest} disabled={testing || isPreview}>
          {testing ? "测试中" : "测试当前"}
        </Button>
      </div>
    </section>
  );
}

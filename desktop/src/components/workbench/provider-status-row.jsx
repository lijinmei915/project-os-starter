import React from "react";

export function ProviderStatusRow({ enabled, hasApiKey }) {
  return (
    <div className="providerStatus">
      <span className={`dot ${enabled && hasApiKey ? "" : "mutedDot"}`} />
      <span>{enabled ? "已启用" : "未启用"}</span>
      <span>{hasApiKey ? "Key 已保存" : "未保存 Key"}</span>
    </div>
  );
}

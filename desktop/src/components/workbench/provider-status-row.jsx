import React from "react";

export function ProviderStatusRow({ enabled, hasApiKey, keyLabel, statusLabel, variant = "default" }) {
  return (
    <div className={`providerStatus providerStatus-${variant}`}>
      <span className={`dot ${enabled && hasApiKey ? "" : "mutedDot"}`} />
      <span>{statusLabel || (enabled ? "已启用" : "未启用")}</span>
      <span>{keyLabel || (hasApiKey ? "Key 已保存" : "未保存 Key")}</span>
    </div>
  );
}

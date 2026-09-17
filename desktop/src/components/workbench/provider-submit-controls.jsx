import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { Switch } from "../ui/switch";

export function ProviderSubmitControls({ disabledHint = "关闭后，宿主应用不会使用当前连接。", enabled, isPreview, onEnabledChange, probeError, submitLabel = "保存并启用" }) {
  return (
    <>
      <div className="toggleRow">
        <Switch aria-label="启用当前连接" checked={enabled} onCheckedChange={onEnabledChange} />
        <span>
          启用当前连接
          <small>{disabledHint}</small>
        </span>
      </div>
      <Button variant="primary" type="submit" disabled={isPreview}>{submitLabel}</Button>
      {probeError ? <Notice className="providerError" variant="danger">{probeError}</Notice> : null}
    </>
  );
}

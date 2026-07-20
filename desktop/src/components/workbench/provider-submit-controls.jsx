import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { Switch } from "../ui/switch";

export function ProviderSubmitControls({ enabled, isPreview, onEnabledChange, probeError }) {
  return (
    <>
      <div className="toggleRow">
        <Switch aria-label="启用当前连接" checked={enabled} onCheckedChange={onEnabledChange} />
        <span>
          启用当前连接
          <small>关闭后不调用模型，改用本地规则回答。</small>
        </span>
      </div>
      <Button variant="primary" type="submit" disabled={isPreview}>保存并启用</Button>
      {probeError ? <Notice className="providerError" variant="danger">{probeError}</Notice> : null}
    </>
  );
}

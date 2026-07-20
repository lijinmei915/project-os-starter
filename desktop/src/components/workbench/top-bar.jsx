import { Plus } from "lucide-react";
import { SystemSettingsMenu } from "./system-settings-menu";
import { ThemeMenu } from "./theme-menu";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Tooltip } from "../ui/tooltip";

export function TopBar({ onStartConversation, providerButtonLabel, providerHealth, providerPanel }) {
  const health = providerHealth || { status: "unknown", label: "Checking" };
  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark" aria-hidden="true"><span className="markGlyph" /></div>
        <div><div className="brandTitle">OmniDesk</div><div className="brandSubtitle">超级个人工作台</div></div>
      </div>
      <div className="topActions">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="modelStatusButton" variant="subtle" type="button" aria-label="连接设置">
              <span className={`dot modelHealthDot modelHealthDot-${health.status}`} />
              {providerButtonLabel || "连接"}
            </Button>
          </DialogTrigger>
          <DialogContent className="providerDialog" title="模型设置" description="配置 OmniDesk 调用的大模型、API Key 和网关地址。">
            {providerPanel}
          </DialogContent>
        </Dialog>
        <ThemeMenu />
        <SystemSettingsMenu />
        <Tooltip content="开始一段新的对话">
          <Button variant="primary" type="button" onClick={onStartConversation}><Plus className="buttonIcon" strokeWidth={2.25} aria-hidden="true" />新对话</Button>
        </Tooltip>
      </div>
    </header>
  );
}

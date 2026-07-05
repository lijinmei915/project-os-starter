import React from "react";
import { Settings } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip } from "../ui/tooltip";

const settingsSections = [
  { title: "项目管理", meta: "registry" },
  { title: "模型连接", meta: "provider" },
  { title: "本地存储", meta: "storage" },
  { title: "安全隐私", meta: "privacy" },
  { title: "高级设置", meta: "advanced" },
];

export function SystemSettingsMenu() {
  return (
    <DropdownMenu>
      <Tooltip content="系统设置">
        <DropdownMenuTrigger asChild>
          <Button variant="subtle" size="icon" type="button" aria-label="系统设置">
            <Settings className="buttonIcon" strokeWidth={2.25} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="settingsMenuContent">
        <div className="themeMenuGroup">
          <div className="themeMenuLabel">系统设置</div>
          <div className="settingsMenuList">
            {settingsSections.map((section) => (
              <DropdownMenuItem className="settingsMenuItem" key={section.title}>
                <span>{section.title}</span>
                <em>{section.meta}</em>
              </DropdownMenuItem>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

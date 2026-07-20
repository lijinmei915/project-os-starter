import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva("uiBadge", {
  variants: {
    variant: {
      default: "uiBadge-neutral",
      neutral: "uiBadge-neutral",
      info: "uiBadge-info",
      success: "uiBadge-success",
      warning: "uiBadge-warning",
      danger: "uiBadge-danger",
      planned: "uiBadge-info",
      waiting: "uiBadge-warning",
      running: "uiBadge-info",
      caution: "uiBadge-warning",
      progress: "uiBadge-info",
      done: "uiBadge-success",
      failed: "uiBadge-danger",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

// Product-facing labels map to semantic color roles. Screens choose a state,
// never a color; unknown labels deliberately remain neutral.
const statusVariantMap = {
  planned: "info",
  "waiting approval": "warning",
  "repair pending": "warning",
  "waiting repair approval": "warning",
  "repair failed": "danger",
  running: "info",
  caution: "warning",
  done: "success",
  failed: "danger",
  "已识别": "success",
  "已发现": "info",
  "计划中": "info",
  "启动中": "info",
  "已接入": "success",
  "规则已接入": "success",
  "运行时已接入": "success",
  "已完成": "success",
  "已确认": "success",
  "已通过": "success",
  "验收通过": "success",
  "已登记": "success",
  "可用": "success",
  "可启动": "success",
  "待确认": "warning",
  "需注意": "warning",
  "信息不完整": "warning",
  "待配置": "warning",
  "待识别": "warning",
  "未识别": "warning",
  "待建立": "warning",
  "待拆解": "warning",
  "待确认完成": "warning",
  "待开始": "info",
  "已暂停": "warning",
  "需处理": "danger",
  "未通过": "danger",
  "验收中": "info",
  "缺少验收标准": "warning",
  "启动入口待补": "warning",
  "待沉淀": "warning",
  "需关注": "warning",
  "中": "warning",
  "低": "info",
  "高": "danger",
  "进行中": "info",
  "处理中": "info",
  "打磨中": "info",
  "交付中": "info",
  "失败": "danger",
  "阻塞": "danger",
  "高风险": "danger",
};

export function Badge({ children, className, status, variant, ...props }) {
  const labelVariant = typeof children === "string" ? statusVariantMap[children] : undefined;
  return (
    <span
      className={cn(badgeVariants({ variant: variant || statusVariantMap[status] || labelVariant || "default" }), className)}
      {...props}
    >
      {children}
    </span>
  );
}

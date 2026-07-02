import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";

export function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root className={cn("uiTabs", className)} {...props} />;
}

export function TabsList({ className, ...props }) {
  return <TabsPrimitive.List className={cn("uiTabsList", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }) {
  return <TabsPrimitive.Trigger className={cn("uiTabsTrigger", className)} {...props} />;
}

export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn("uiTabsContent", className)} {...props} />;
}

export function runtimeCapabilitySpecs(topicId, { activeTaskCount, currentTask, failedTaskCount, memoryCount, profileMissingCount, recentResultCount, snapshot, taskNextActionLabel, visibleTaskCount }) {
  const execution = {
    "task-list": { files: [".omnidesk/data/tasks/*", ".omnidesk/data/task-backlog.json"], next: currentTask ? `当前查看「${currentTask.title}」，下一步：${taskNextActionLabel}。` : "从对话或目标创建第一项任务。", status: failedTaskCount ? "有失败项" : activeTaskCount ? "推进中" : visibleTaskCount ? "已归档" : "待创建", title: "任务", tone: failedTaskCount ? "danger" : visibleTaskCount ? "success" : "warning", value: "让接入项目在一处选择任务、查看详情并推进下一步。" },
    "execution-terminal": { files: ["desktop/package.json", "desktop/src-tauri/Cargo.toml", "desktop/src/conversation-runtime/capabilities.js"], next: "把常用检查和构建命令标为受控命令，和普通终端输入区分开。", status: "可用", title: "执行终端", tone: "success", value: "让用户知道哪些命令是安全入口，哪些只是普通终端操作。" },
    "execution-results": { files: [".omnidesk/evidence/runs/*", ".omnidesk/evidence/desktop-summary.md", "HANDOFF.md"], next: failedTaskCount ? "重跑失败检查或生成修复任务。" : "把成功结果沉淀到 run summary 和交接记录。", status: failedTaskCount ? "需处理" : recentResultCount ? "有结果" : "待生成", title: "执行结果", tone: failedTaskCount ? "danger" : recentResultCount ? "success" : "warning", value: "让接入项目保留执行证据，并能从失败结果直接进入修复闭环。" },
  };
  const memory = {
    "project-facts": { files: [".omnidesk/data/project-profile.json", ".omnidesk/cache/workspace-facts.json", ".omnidesk/data/state.json", "PROJECT.md"], next: profileMissingCount ? "补齐缺失事实，并标记哪些来自用户确认、哪些来自文件推断。" : "把事实来源、可信度和更新时机展示出来。", status: profileMissingCount ? "待补齐" : "已识别", title: "项目事实", tone: profileMissingCount ? "warning" : "success", value: "让接入项目不再从零理解，Agent 可以直接知道项目定位、阶段、技术栈和治理域。" },
    "user-preferences": { files: [".omnidesk/data/project-profile.json", "OmniDesk global: user-profile.json"], next: "提供偏好确认入口，并区分项目级偏好和全局偏好。", status: snapshot?.projectProfile?.userPreferences ? "已记录" : "待确认", title: "用户偏好", tone: snapshot?.projectProfile?.userPreferences ? "success" : "warning", value: "让 Agent 记住用户对协作方式、视觉偏好、风险边界和表达方式的要求。" },
    "long-term-memory": { files: [".omnidesk/data/memory/*", "docs/LESSONS.md", "docs/DECISIONS.md", "HANDOFF.md"], next: "把重要对话、决策和踩坑经验沉淀为可复用长期记忆。", status: memoryCount ? "已接入" : "待沉淀", title: "长期记忆", tone: memoryCount ? "success" : "warning", value: "让接入项目保留长期上下文，避免重复解释历史决策和约束。" },
    "conversation-summary": { files: [".omnidesk/data/conversations/*", ".omnidesk/data/tasks/*"], next: "把会话摘要和任务、项目事实、偏好更新关联起来。", status: "待产品化", title: "会话摘要", tone: "warning", value: "让对话不只是聊天记录，而能沉淀成任务、事实、偏好和交接线索。" },
  };
  return { execution: execution[topicId] || null, memory: memory[topicId] || null };
}

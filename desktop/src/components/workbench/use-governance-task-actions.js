/** Workspace governance task builders with injected persistence and feedback. */
export function useGovernanceTaskActions({ activeConversationId, snapshot, designImplementationTopics, governanceFileHealthLabel, createTaskFromPlan, persistTask, showToast }) {
  const createGovernanceTask = async ({ files = [], status = "" } = {}) => {
    const actionableFiles = files.filter((file) => file?.path);
    if (!actionableFiles.length) return false;
    const statusTitle = { changed: "审阅本地变更治理文件", missing: "补齐缺失治理文件", stale: "同步可能过期治理文件" }[status] || "处理治理文件";
    const statusAction = { changed: "逐个审阅本地变更，确认是否需要同步到项目状态或交接记录。", missing: "确认缺失是否合理，必要时生成补齐方案。", stale: "复查文件内容是否过期，必要时同步到最新项目状态。" }[status] || "确认治理文件状态并给出处理方案。";
    const fileList = actionableFiles.map((file) => file.path);
    const domainNames = [...new Set(actionableFiles.map((file) => file.domainTitle).filter(Boolean))];
    const plan = {
      candidateChanges: fileList.map((file) => `必要时${status === "missing" ? "补齐" : "同步"} ${file}`),
      checks: ["bash scripts/check-runtime.sh .", "bash scripts/check-doc-structure.sh ."],
      filesToRead: fileList,
      guardrails: ["先只读确认问题，不自动写文件。", "缺失文件需要判断是否确实属于当前项目。", "有本地变更的治理文件要保留用户已有改动。", "进入 Apply 前必须生成 Patch 草案并由用户确认。"],
      mode: "governance-file-task",
      projectName: snapshot.projectName,
      steps: [`聚焦治理域：${domainNames.slice(0, 4).join("、") || "治理文件"}`, statusAction, "生成最小处理方案和 Patch 草案。", "运行治理检查并更新执行结果。"],
      summary: `${statusTitle}：${fileList.slice(0, 3).join("、")}${fileList.length > 3 ? ` 等 ${fileList.length} 个文件` : ""}`,
      task: statusTitle,
      trace: [`GOVERNANCE_FILE_STATUS: ${status || "all"}`, `GOVERNANCE_FILE_COUNT: ${fileList.length}`],
    };
    const task = createTaskFromPlan(plan, statusTitle, snapshot, { conversationId: activeConversationId });
    await persistTask({ ...task, governanceFileStatus: status, governanceFiles: actionableFiles });
    showToast(`已生成治理文件任务：${statusTitle}`, "success");
    return true;
  };
  const createDesignGovernanceTask = async ({ files = [], topic = {} } = {}) => {
    const actionableFiles = files.filter((file) => file?.path);
    if (!actionableFiles.length) return false;
    const topicConfig = designImplementationTopics[topic?.id] || {};
    const taskTitle = topicConfig.task || `审阅${topic?.title || "设计实现"}`;
    const fileList = actionableFiles.map((file) => file.path);
    const statusSummary = [...new Set(actionableFiles.map((file) => governanceFileHealthLabel(file.status)).filter(Boolean))];
    const plan = {
      candidateChanges: fileList.map((file) => `必要时同步 ${file}`),
      checks: ["npm --prefix desktop run web:build", "bash scripts/check-runtime.sh .", "bash scripts/check-doc-structure.sh ."],
      filesToRead: fileList,
      guardrails: ["先判断架构、契约、规范和实现是否一致，不直接重构。", "只生成最小治理任务和 Patch 草案，进入 Apply 前必须由用户确认。", "涉及代码结构时保留现有模块边界，不做无关 UI 优化。"],
      mode: "design-implementation-governance",
      projectName: snapshot.projectName,
      steps: [`聚焦设计实现入口：${topic?.title || "设计实现"}`, statusSummary.length ? `确认资产状态：${statusSummary.join("、")}` : "确认设计实现资产状态。", "比对架构、数据契约、界面规范和实现结构是否一致。", "生成最小处理方案，并运行构建和治理检查。"],
      summary: `${taskTitle}：${fileList.slice(0, 3).join("、")}${fileList.length > 3 ? ` 等 ${fileList.length} 个文件` : ""}`,
      task: taskTitle,
      trace: [`DESIGN_GOVERNANCE_TOPIC: ${topic?.id || "design-implementation"}`, `DESIGN_GOVERNANCE_FILE_COUNT: ${fileList.length}`],
    };
    const task = createTaskFromPlan(plan, taskTitle, snapshot, { conversationId: activeConversationId });
    await persistTask({ ...task, designGovernanceFiles: actionableFiles, designGovernanceTopic: topic?.id || "design-implementation" });
    showToast(`已生成设计实现治理任务：${taskTitle}`, "success");
    return true;
  };
  return { createDesignGovernanceTask, createGovernanceTask };
}

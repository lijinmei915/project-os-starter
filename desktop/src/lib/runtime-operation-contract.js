/**
 * Shared UI-side operation metadata. Every client must refer to an id here;
 * runtime-specific adapters only decide transport and permission policy.
 */
export const previewApiRoot = "/__omnidesk";
const operation = (path, error, preview) => ({ endpoint: `${previewApiRoot}/${path}`, error, preview });

export const runtimeOperations = Object.freeze({
  execute_approved_agent_tool: operation("execute-approved-agent-tool", "执行已批准工具失败。", "deny"), approve_agent_run: operation("approve-agent-run", "批准 Agent Run 失败。", "deny"), submit_agent_interaction: operation("submit-agent-interaction", "提交 Agent 追问失败。", "deny"), resume_agent_run: operation("resume-agent-run", "恢复 Agent Run 失败。", "deny"), cancel_agent_run: operation("cancel-agent-run", "取消 Agent Run 失败。", "deny"), export_agent_run_timeline: operation("export-agent-run-timeline", "导出 Agent Run 时间线失败。", "deny"), continue_agent_run: operation("continue-agent-run", "继续 Agent Run 失败。", "deny"),
  list_agent_runs: operation("agent-runs", "读取 Agent 运行记录失败。", "allow"), get_agent_scheduler: operation("agent-scheduler", "读取 Agent 调度状态失败。", "deny"), get_agent_tool_registry: operation("agent-tool-registry", "读取 Agent 工具能力失败。", "deny"), get_mcp_server_registry: operation("mcp-server-registry", "读取 MCP Server 配置失败。", "deny"), save_mcp_server: operation("save-mcp-server", "保存 MCP Server 失败。", "deny"), remove_mcp_server: operation("remove-mcp-server", "删除 MCP Server 失败。", "deny"), get_mcp_discovery_evidence: operation("mcp-discovery-evidence", "读取 MCP 发现结果失败。", "deny"), request_mcp_discovery: operation("request-mcp-discovery", "创建 MCP 能力发现审批失败。", "deny"), request_mcp_call: operation("request-mcp-call", "创建 MCP 工具调用审批失败。", "deny"), execute_agent_read_tool: operation("execute-agent-read-tool", "读取项目上下文失败。", "allow"), read_engineering_file: operation("read-engineering-file", "读取文件失败。", "allow"), run_guarded_check: operation("run-guarded-check", "基础检查执行失败。", "deny"), generate_patch_draft: operation("generate-patch-draft", "生成改动草稿失败。", "allow"), get_hermes_executor_status: operation("get-hermes-executor-status", "读取 Hermes 执行器状态失败。", "allow"),
  save_desktop_conversation: operation("save-desktop-conversation", "保存对话失败。", "deny"), save_desktop_task: operation("save-desktop-task", "保存任务失败。", "deny"), delete_desktop_task: operation("delete-desktop-task", "删除任务失败。", "deny"), delete_desktop_conversation: operation("delete-desktop-conversation", "删除对话失败。", "deny"), update_project_capability: operation("update-project-capability", "启用项目能力失败。", "deny"),
  run_goal_validation: operation("run-goal-validation", "目标验收运行失败。", "deny"), sign_off_goal_validation: operation("sign-off-goal", "目标签收失败。", "deny"), create_goal: operation("create-goal", "目标创建失败。", "deny"), update_goal: operation("update-goal", "目标更新失败。", "deny"), archive_goal: operation("archive-goal", "目标归档失败。", "deny"), restore_goal: operation("restore-goal", "目标恢复失败。", "deny"), merge_goal: operation("merge-goal", "目标合并失败。", "deny"), switch_active_goal: operation("switch-goal", "目标切换失败。", "deny"), confirm_goal: operation("confirm-goal", "目标确认失败。", "deny"), confirm_goal_decomposition: operation("confirm-goal-decomposition", "目标拆解确认失败。", "deny"),
  switch_registry_project: operation("switch-project", "项目切换失败。", "deny"), add_registry_project: operation("add-project", "项目添加失败。", "deny"), preview_project_path: operation("preview-project-path", "项目扫描失败。", "allow"), relocate_registry_project: operation("relocate-project", "路径更新失败。", "deny"), rename_registry_project: operation("rename-project", "项目重命名失败。", "deny"), remove_registry_project: operation("remove-project", "项目移除失败。", "deny"),
  save_provider_config: operation("save-provider-config", "连接保存失败。", "deny"), test_provider_model_with_cache: operation("test-provider-model", "模型不可用。", "deny"), probe_provider_models: operation("probe-provider-models", "读取模型列表失败。", "deny"), delete_provider_profile: operation("delete-provider-profile", "删除连接失败。", "deny"), save_project_memory: operation("save-project-memory", "保存项目记忆失败。", "deny"),
});

export function previewOperation(command) {
  const operation = runtimeOperations[command];
  if (!operation) throw new Error("当前是浏览器预览，只能查看界面；请在桌面 App 窗口里保存配置。");
  if (operation.preview !== "allow") throw new Error("浏览器预览不能执行此操作，请在桌面 App 窗口里使用。");
  return operation;
}

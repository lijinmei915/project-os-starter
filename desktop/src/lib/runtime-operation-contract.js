/**
 * Shared UI-side operation metadata. Every client must refer to an id here;
 * runtime-specific adapters only decide transport and permission policy.
 */
export const runtimeOperations = Object.freeze({
  execute_approved_agent_tool: { endpoint: "/__project-os/execute-approved-agent-tool", error: "执行已批准工具失败。", preview: "deny" },
  approve_agent_run: { endpoint: "/__project-os/approve-agent-run", error: "批准 Agent Run 失败。", preview: "deny" },
  resume_agent_run: { endpoint: "/__project-os/resume-agent-run", error: "恢复 Agent Run 失败。", preview: "deny" },
  list_agent_runs: { endpoint: "/__project-os/agent-runs", error: "读取 Agent 运行记录失败。", preview: "allow" },
  execute_agent_read_tool: { endpoint: "/__project-os/execute-agent-read-tool", error: "读取项目上下文失败。", preview: "allow" },
  read_engineering_file: { endpoint: "/__project-os/read-engineering-file", error: "读取文件失败。", preview: "allow" },
  run_project_os_action: { endpoint: "/__project-os/run-project-os-action", error: "治理动作执行失败。", preview: "deny" },
  run_guarded_check: { endpoint: "/__project-os/run-guarded-check", error: "基础检查执行失败。", preview: "deny" },
  generate_patch_draft: { endpoint: "/__project-os/generate-patch-draft", error: "生成改动草稿失败。", preview: "allow" },
  get_hermes_executor_status: { endpoint: "/__project-os/get-hermes-executor-status", error: "读取 Hermes 执行器状态失败。", preview: "allow" },
  save_desktop_conversation: { endpoint: "/__project-os/save-desktop-conversation", error: "保存对话失败。", preview: "deny" },
  save_desktop_task: { endpoint: "/__project-os/save-desktop-task", error: "保存任务失败。", preview: "deny" },
  delete_desktop_task: { endpoint: "/__project-os/delete-desktop-task", error: "删除任务失败。", preview: "deny" },
  delete_desktop_conversation: { endpoint: "/__project-os/delete-desktop-conversation", error: "删除对话失败。", preview: "deny" },
  update_project_capability: { endpoint: "/__project-os/update-project-capability", error: "启用项目能力失败。", preview: "deny" },
  run_goal_validation: { endpoint: "/__project-os/run-goal-validation", error: "目标验收运行失败。", preview: "deny" },
  sign_off_goal_validation: { endpoint: "/__project-os/sign-off-goal", error: "目标签收失败。", preview: "deny" },
  create_goal: { endpoint: "/__project-os/create-goal", error: "目标创建失败。", preview: "deny" },
  update_goal: { endpoint: "/__project-os/update-goal", error: "目标更新失败。", preview: "deny" },
  archive_goal: { endpoint: "/__project-os/archive-goal", error: "目标归档失败。", preview: "deny" },
  restore_goal: { endpoint: "/__project-os/restore-goal", error: "目标恢复失败。", preview: "deny" },
  merge_goal: { endpoint: "/__project-os/merge-goal", error: "目标合并失败。", preview: "deny" },
  switch_active_goal: { endpoint: "/__project-os/switch-goal", error: "目标切换失败。", preview: "deny" },
  confirm_goal: { endpoint: "/__project-os/confirm-goal", error: "目标确认失败。", preview: "deny" },
  confirm_goal_decomposition: { endpoint: "/__project-os/confirm-goal-decomposition", error: "目标拆解确认失败。", preview: "deny" },
  switch_registry_project: { endpoint: "/__project-os/switch-project", error: "项目切换失败。", preview: "deny" },
  add_registry_project: { endpoint: "/__project-os/add-project", error: "项目添加失败。", preview: "deny" },
  preview_project_path: { endpoint: "/__project-os/preview-project-path", error: "项目扫描失败。", preview: "allow" },
  relocate_registry_project: { endpoint: "/__project-os/relocate-project", error: "路径更新失败。", preview: "deny" },
  rename_registry_project: { endpoint: "/__project-os/rename-project", error: "项目重命名失败。", preview: "deny" },
  remove_registry_project: { endpoint: "/__project-os/remove-project", error: "项目移除失败。", preview: "deny" },
  save_provider_config: { endpoint: "/__project-os/save-provider-config", error: "连接保存失败。", preview: "deny" },
  test_provider_model_with_cache: { endpoint: "/__project-os/test-provider-model", error: "模型不可用。", preview: "deny" },
  probe_provider_models: { endpoint: "/__project-os/probe-provider-models", error: "读取模型列表失败。", preview: "deny" },
  delete_provider_profile: { endpoint: "/__project-os/delete-provider-profile", error: "删除连接失败。", preview: "deny" },
  save_project_memory: { endpoint: "/__project-os/save-project-memory", error: "保存项目记忆失败。", preview: "deny" },
});

export function previewOperation(command) {
  const operation = runtimeOperations[command];
  if (!operation) throw new Error("当前是浏览器预览，只能查看界面；请在桌面 App 窗口里保存配置。");
  if (operation.preview !== "allow") throw new Error("浏览器预览不能执行此操作，请在桌面 App 窗口里使用。");
  return operation;
}

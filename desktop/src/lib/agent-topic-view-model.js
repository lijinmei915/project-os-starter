import { activeProviderProfileName } from "./provider-presentation";
import { agentConfigCapabilitySpec } from "./agent-topic-agent-config";
import { assetCapabilitySpec } from "./agent-topic-asset-capability";
import { runtimeCapabilitySpecs } from "./agent-topic-runtime-capability";
import { flowCapabilitySpec } from "./agent-topic-flow-capability";
import { buildAgentTopicCards } from "./agent-topic-cards";

const previewExtensions = new Set(["md", "mdx", "txt", "json", "jsonc", "yaml", "yml", "toml", "js", "jsx", "ts", "tsx", "css", "scss", "html", "rs", "sh", "py", "sql"]);
const aggregatePaths = new Set(["desktop/*", "docs/*", "schemas/*", "docs/data/*", "scripts/*"]);

export function canPreviewAgentTopicFile(file) {
  if (!file || typeof file !== "string" || file.includes("*") || file.endsWith("/") || file.includes(":")) return false;
  if (file.startsWith("/") || file.startsWith(".env") || file.includes("/.env") || file.includes(".omnidesk/desktop-provider")) return false;
  if (file.split("/").includes("..") || aggregatePaths.has(file)) return false;
  return previewExtensions.has(file.split(".").pop());
}

export function buildAgentTopicViewModel({
  activeGoalFromSnapshot, activeTasks, checksForPlan, composerModelAvailability, currentTask,
  doneTasks, failedTasks, goalStatusLabel, phaseLabel, provider, recentResultTasks, snapshot,
  taskNextAction, tasks, topic, visibleTasks,
}) {
  const id = topic?.id || "";
  const domains = Array.isArray(snapshot?.workspaceFacts?.governanceDomains) ? snapshot.workspaceFacts.governanceDomains : [];
  const domain = (id, title) => domains.find((item) => item.id === id || item.title === title);
  const countFiles = (item) => Array.isArray(item?.files) ? item.files.length : 0;
  const countRisks = (item) => (Array.isArray(item?.fileStatuses) ? item.fileStatuses : []).filter((file) => ["missing", "changed", "stale"].includes(file.status || "")).length;
  const engineeringDomain = domain("engineering-files", "工程文件");
  const governanceDomain = domain("governance-files", "治理文件");
  const reportDomain = domain("report-artifacts", "报告产物");
  const schemaDomain = domain("schema-assets", "Schema");
  const profileMissingCount = Array.isArray(snapshot?.projectProfile?.missingFields) ? snapshot.projectProfile.missingFields.length : 0;
  const memoryItems = Array.isArray(snapshot?.memory) ? snapshot.memory : [];
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const validationChecks = Array.isArray(snapshot?.goalValidationReport?.checks) ? snapshot.goalValidationReport.checks : [];
  const providerName = activeProviderProfileName(provider) || "未命名连接";
  const modelStatus = composerModelAvailability?.[provider?.model]?.status || (provider?.model ? "未测试" : "未选择");
  const modelEnabled = provider?.enabled ? "已启用" : "未启用";
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const nextActionLabel = currentTask ? taskNextAction(currentTask).label : "";
  const { execution, memory } = runtimeCapabilitySpecs(id, {
    activeTaskCount: activeTasks.length, currentTask, failedTaskCount: failedTasks.length,
    memoryCount: memoryItems.length, profileMissingCount, recentResultCount: recentResultTasks.length,
    snapshot, taskNextActionLabel: nextActionLabel, visibleTaskCount: visibleTasks.length,
  });
  const agentConfigSpec = agentConfigCapabilitySpec(id, provider);
  const assetSpec = assetCapabilitySpec(id, {
    assetDomainFileCount: countFiles, assetDomainRiskCount: countRisks,
    domains: { engineeringDomain, governanceDomain, reportDomain, schemaDomain }, snapshot,
  });
  const cards = buildAgentTopicCards({
    activeGoal, activeTaskCount: activeTasks.length, assetDomainFileCount: countFiles, assetDomainRiskCount: countRisks,
    conversationCount: Array.isArray(snapshot?.conversations) ? snapshot.conversations.length : 0, currentTask,
    doneTaskCount: doneTasks.length, failedTaskCount: failedTasks.length, goalCount: goals.length,
    goalStatusLabel, memoryCount: memoryItems.length, modelEnabled, modelStatus,
    passedChecks: validationChecks.filter((check) => check?.success).length, profileKnownCount: Math.max(0, 5 - profileMissingCount),
    profileMissingCount, projectPhase: phaseLabel(snapshot?.phase || snapshot?.workspaceFacts?.project?.lifecycle), provider,
    providerName, snapshot, taskNextActionLabel: nextActionLabel, topic, topicId: id, validationChecks,
    visibleTaskCount: visibleTasks.length, domains: { doneGoals: goals.filter((goal) => goal.status === "done").length,
      engineering: engineeringDomain, governance: governanceDomain, latestResult: doneTasks[0]?.title || failedTasks[0]?.title || "",
      openGoals: goals.filter((goal) => goal.status !== "done").length, schema: schemaDomain },
  });
  const activeCapabilitySpec = agentConfigSpec || assetSpec || execution || memory || flowCapabilitySpec(id, topic);
  return {
    activeCapabilitySpec, activeGoal, archivedGoals: goals.filter((goal) => goal.status === "archived"),
    archivedTasks: tasks.filter((task) => Boolean(task.archivedAt)), cards,
    capabilityKind: agentConfigSpec ? "接入能力" : assetSpec ? "资产能力" : execution ? "执行能力" : memory ? "记忆能力" : "流程能力",
    currentChecks: checksForPlan(currentTask?.plan || {}), currentPlan: currentTask?.plan || {},
    doneGoals: goals.filter((goal) => goal.status === "done"), modelAvailable: Boolean(provider?.enabled && modelStatus === "available"),
  };
}

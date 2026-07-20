import { canProjectAccess, normalizeProjectAccessMode, projectAccessError, projectAccessModes } from "../lib/project-access-policy.js";
import { createApprovalRequest, createObservation, createToolCall, toolCallStatuses, toolRiskLevels } from "./contract.js";
import { defaultToolRegistry, normalizeToolArguments } from "./tool-registry.js";

function decision(status, values = {}) {
  return Object.freeze({ status, ...values });
}

export function createToolGateway({ accessMode, handlers = {}, projectRoot, registry = defaultToolRegistry, surface = "desktop" } = {}) {
  const mode = normalizeProjectAccessMode(accessMode);
  const root = String(projectRoot || "").trim();
  if (!root) throw new Error("tool gateway requires a project root");

  function prepare({ arguments: inputArguments, id, name, runId, requestedAt } = {}) {
    const definition = registry.get(name);
    if (!definition) return decision("denied", { reason: `未注册的工具：${String(name || "unknown")}` });
    if (surface !== "desktop" && definition.risk !== toolRiskLevels.read) {
      return decision("denied", { reason: "浏览器预览只允许读取项目，不能写入文件或执行检查。" });
    }
    if (definition.id === "run_check" && mode !== projectAccessModes.controlled) {
      return decision("denied", { reason: projectAccessError(mode, definition.accessAction) });
    }
    if (!canProjectAccess(mode, definition.accessAction)) {
      return decision("denied", { reason: projectAccessError(mode, definition.accessAction) });
    }
    let arguments_;
    try {
      arguments_ = normalizeToolArguments(definition, inputArguments);
    } catch (error) {
      return decision("denied", { reason: error instanceof Error ? error.message : String(error) });
    }
    const toolCall = createToolCall({
      approvalRequired: definition.approvalRequired,
      arguments: arguments_,
      id,
      name: definition.id,
      requestedAt,
      risk: definition.risk,
      runId,
    });
    if (!definition.approvalRequired) return decision("ready", { definition, toolCall });
    const approval = createApprovalRequest({
      id: `${toolCall.id}:approval`,
      reason: definition.risk === toolRiskLevels.write ? "修改项目文件" : "运行项目检查",
      requestedAt: toolCall.requestedAt,
      runId,
      toolCallId: toolCall.id,
    });
    return decision("awaiting-approval", { approval, definition, toolCall });
  }

  async function execute(prepared, { approval } = {}) {
    if (!prepared || !["ready", "awaiting-approval"].includes(prepared.status)) throw new Error("tool call is not executable");
    const { definition, toolCall } = prepared;
    if (toolCall.approvalRequired && (approval?.toolCallId !== toolCall.id || approval?.token !== prepared.approval?.token || approval?.status !== "approved")) {
      throw new Error("tool call requires an independent approved request");
    }
    const handler = handlers[definition.id];
    if (typeof handler !== "function") throw new Error(`tool handler is unavailable: ${definition.id}`);
    try {
      const data = await handler({ arguments: toolCall.arguments, projectRoot: root });
      return Object.freeze({
        observation: createObservation({ id: `${toolCall.id}:observation`, runId: toolCall.runId, success: true, summary: data?.summary || `${definition.id} completed`, toolCallId: toolCall.id }),
        toolCall: Object.freeze({ ...toolCall, status: toolCallStatuses.completed }),
        data: data ?? null,
      });
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      return Object.freeze({
        observation: createObservation({ id: `${toolCall.id}:observation`, runId: toolCall.runId, success: false, summary, toolCallId: toolCall.id }),
        toolCall: Object.freeze({ ...toolCall, status: toolCallStatuses.failed }),
        data: null,
      });
    }
  }

  return Object.freeze({ execute, mode, prepare, projectRoot: root, surface });
}

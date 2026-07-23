import { isDialogueActionRequest } from "./conversation-record.js";

export function isActionRequestMessage(message, hasAttachments = false) {
  return isDialogueActionRequest(displayText(message), hasAttachments);
}

export function actionPromptsForMessage(message, intent) {
  const text = displayText(message).trim();
  if (!text) return [];
  if (intent === "task") {
    return [{ id: "generate-plan", label: "生成计划", task: text }];
  }
  const actions = [];
  if (/状态|进度|下一步|总结|概况|现在/.test(text)) {
    actions.push({ id: "open-topic", label: "查看当前进度", target: "project-progress" });
  }
  if (/风险|检查|验证|报告/.test(text)) {
    actions.push({ id: "open-topic", label: "查看风险与验收", target: text.includes("风险") ? "project-risks" : "validation-report" });
  }
  if (/开发|任务|执行|patch|改代码|实现/.test(text.toLowerCase())) {
    actions.push({ id: "open-topic", label: "查看任务", target: "task-list" });
  }
  return actions.slice(0, 2);
}

export function profilePatchesFromMessage(message) {
  const text = displayText(message).trim();
  if (!text) return [];
  const patches = [];
  const push = (key, value, confidence) => patches.push({ key, value, status: "user_confirmed", source: "conversation", confidence, notes: text });
  if (/技术小白|不懂技术|非技术|小白/.test(text)) {
    push("user.skillLevel", text, 0.85);
    push("product.targetUsers", ["技术小白"], 0.7);
  }
  if (/目标用户|用户画像|面向|给.*用/.test(text)) push("product.targetUsers", text, 0.75);
  if (/长期目标|最终|北极星|愿景/.test(text)) push("product.longTermGoal", text, 0.75);
  if (/使用场景|场景|什么时候|接手|启动|持续/.test(text)) push("product.useCases", text, 0.7);
  if (/不要|别|少|希望|偏好|喜欢|不喜欢|自然|主流/.test(text)) push("user.globalPreferences", text, 0.8);
  return patches;
}

function displayText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

import { isDialogueActionRequest } from "../lib/conversation-record.js";

export function classifyConversationIntent(message, hasAttachments = false) {
  const text = String(message || "").trim();
  const compact = text.replace(/[。！？!?,，\s]/g, "").toLowerCase();
  if (!text && hasAttachments) return "task";
  if (/(你是什么模型|当前.*模型|模型.*是什么|which model|what model)/i.test(text)) return "model-status";
  if (/(网络.*可用|网络.*好了|联网|连接.*好了|provider|api.*可用|模型.*可用)/i.test(text)) return "connection-status";
  if (!/[?？]$/.test(text)
    && !/(为什么|怎么|如何|是什么|要不要|可以吗|能不能)/.test(text)
    && (/(阶段目标|下一阶段|本阶段)/.test(text) || /^(?:接下来|下一步)(?:我们)?(?:要|想|准备|先)/.test(text))) return "stage-goal";
  if (isDialogueActionRequest(text, hasAttachments)) return "task";
  if (/(建议|改进|优化方向)/.test(text)) return "question";
  if (/(状态|进度|下一步|总结|概况|现在)/.test(text)) return "project-status";
  if (/(风险|检查|验证|报告)/.test(text)) return "project-inspect";
  if (["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(compact)) return "chat";
  if (/(为什么|怎么|哪些|还有哪些|是什么|吗|呢|看一下|看看)/.test(text)) return "question";
  if (/(开发|任务|执行|patch|改代码|实现)/i.test(text)) return "project-inspect";
  return "chat";
}

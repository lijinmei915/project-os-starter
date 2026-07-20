export const resourceBudget = Object.freeze({
  attachmentMaxBytes: 8 * 1024 * 1024,
  attachmentMaxCount: 6,
  attachmentMaxTotalBytes: 24 * 1024 * 1024,
  filePreviewMaxBytes: 80 * 1024,
  terminalChunkLimit: 2000,
  terminalLogLimit: 8,
  terminalTextLimit: 50000,
});

export function selectAttachmentFiles(files = [], currentAttachments = []) {
  const availableCount = Math.max(resourceBudget.attachmentMaxCount - currentAttachments.length, 0);
  const currentBytes = currentAttachments.reduce((total, attachment) => total + Number(attachment?.size || 0), 0);
  let acceptedBytes = 0;
  const accepted = [];
  const rejected = [];
  for (const file of files) {
    if (accepted.length >= availableCount) { rejected.push({ file, reason: "count" }); continue; }
    if (file.size > resourceBudget.attachmentMaxBytes) { rejected.push({ file, reason: "file-size" }); continue; }
    if (currentBytes + acceptedBytes + file.size > resourceBudget.attachmentMaxTotalBytes) { rejected.push({ file, reason: "total-size" }); continue; }
    accepted.push(file);
    acceptedBytes += file.size;
  }
  return { accepted, rejected };
}

export function attachmentBudgetMessage(rejected = []) {
  if (!rejected.length) return "";
  const reasons = new Set(rejected.map((item) => item.reason));
  if (reasons.has("count")) return `一次最多添加 ${resourceBudget.attachmentMaxCount} 张图片。`;
  if (reasons.has("file-size")) return "单张图片不能超过 8 MB。";
  return "图片附件合计不能超过 24 MB。";
}

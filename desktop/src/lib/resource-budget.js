export const resourceBudget = Object.freeze({
  attachmentMaxBytes: 4 * 1024 * 1024,
  attachmentMaxCount: 4,
  attachmentMaxTotalBytes: 12 * 1024 * 1024,
  filePreviewMaxBytes: 80 * 1024,
  terminalChunkLimit: 2000,
  terminalLogLimit: 8,
  terminalTextLimit: 50000,
});

export const supportedAttachmentMimeTypes = Object.freeze(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

export function selectAttachmentFiles(files = [], currentAttachments = []) {
  const availableCount = Math.max(resourceBudget.attachmentMaxCount - currentAttachments.length, 0);
  const currentBytes = currentAttachments.reduce((total, attachment) => total + Number(attachment?.size || 0), 0);
  let acceptedBytes = 0;
  const accepted = [];
  const rejected = [];
  for (const file of files) {
    if (!supportedAttachmentMimeTypes.includes(String(file.type || "").toLowerCase())) { rejected.push({ file, reason: "type" }); continue; }
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
  if (reasons.has("type")) return "仅支持 PNG、JPEG、WebP、GIF 图片。";
  if (reasons.has("count")) return `一次最多添加 ${resourceBudget.attachmentMaxCount} 张图片。`;
  if (reasons.has("file-size")) return "单张图片不能超过 4 MB。";
  return "图片附件合计不能超过 12 MB。";
}

import { useCallback, useEffect, useRef, useState } from "react";
import { attachmentBudgetMessage, selectAttachmentFiles } from "../../lib/resource-budget";

export function useChatAttachments({ readFileAsDataUrl }) {
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const attachmentsRef = useRef([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const clearAttachments = useCallback(() => {
    setAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.url));
      return [];
    });
    setAttachmentError("");
  }, []);

  const addImageFiles = useCallback(async (fileList) => {
    const imageFiles = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const { accepted, rejected } = selectAttachmentFiles(imageFiles, attachmentsRef.current);
    setAttachmentError(attachmentBudgetMessage(rejected));
    if (!accepted.length) return;
    const nextAttachments = await Promise.all(accepted.map(async (file) => ({
      dataUrl: await readFileAsDataUrl(file),
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID?.() || Date.now()}`,
      name: file.name || "截图",
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    })));
    setAttachments((current) => [...current, ...nextAttachments]);
  }, [readFileAsDataUrl]);

  const removeAttachment = useCallback((id) => {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id);
      if (attachment) URL.revokeObjectURL(attachment.url);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(() => () => {
    attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.url));
  }, []);

  return { addImageFiles, attachmentError, attachments, clearAttachments, removeAttachment };
}

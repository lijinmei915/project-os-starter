import { useEffect } from "react";

/** Handles delegated project-path copy actions across Preview and Tauri. */
export function useProjectPathCopy({ copyTextToSystemClipboard, onProjectActionError, onProjectPathCopied }) {
  useEffect(() => {
    const copyProjectPath = async (projectPath) => {
      let systemCopyError = null;
      const fallbackCopy = () => {
        const textarea = document.createElement("textarea");
        textarea.value = projectPath;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("浏览器拒绝写入剪贴板");
      };

      try {
        try {
          await copyTextToSystemClipboard(projectPath);
        } catch (err) {
          systemCopyError = err;
          if (!navigator.clipboard?.writeText) fallbackCopy();
          else {
            try { await navigator.clipboard.writeText(projectPath); }
            catch { fallbackCopy(); }
          }
        }
        onProjectActionError?.("");
        onProjectPathCopied?.(projectPath);
      } catch (err) {
        const message = systemCopyError instanceof Error
          ? systemCopyError.message
          : err instanceof Error
            ? err.message
            : String(err);
        onProjectActionError?.(`复制路径失败：${message}`);
      }
    };

    const handleCopyProjectPath = (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-copy-project-path]") : null;
      const projectPath = target?.getAttribute("data-copy-project-path") || "";
      if (projectPath) copyProjectPath(projectPath);
    };
    document.addEventListener("click", handleCopyProjectPath, true);
    return () => document.removeEventListener("click", handleCopyProjectPath, true);
  }, [copyTextToSystemClipboard, onProjectActionError, onProjectPathCopied]);
}

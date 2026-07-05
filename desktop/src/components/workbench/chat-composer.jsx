import React from "react";
import { ArrowUp, Mic, Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";

export function ChatComposer({
  attachments = [],
  className,
  disabled,
  inputRef,
  onChange,
  onFilesSelected,
  onPaste,
  onRemoveAttachment,
  onSubmit,
  placeholder,
  sending,
  value,
}) {
  const fileInputRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const hasValue = Boolean(value?.trim()) || attachments.length > 0;
  const isDisabled = disabled || !hasValue;

  const setTextareaRef = React.useCallback((node) => {
    textareaRef.current = node;
    if (typeof inputRef === "function") {
      inputRef(node);
    } else if (inputRef) {
      inputRef.current = node;
    }
  }, [inputRef]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [value, attachments.length]);

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form className={cn("chatComposer", className)} onSubmit={onSubmit}>
      <div className="chatComposerShell" data-state={hasValue ? "filled" : "empty"}>
        {attachments.length ? (
          <div className="chatComposerAttachments">
            {attachments.map((attachment) => (
              <div className="chatAttachment" key={attachment.id}>
                <img src={attachment.url} alt={attachment.name} />
                <span>{attachment.name}</span>
                <button
                  aria-label={`移除 ${attachment.name}`}
                  className="chatAttachmentRemove"
                  onClick={() => onRemoveAttachment?.(attachment.id)}
                  type="button"
                >
                  <X aria-hidden="true" strokeWidth={2.25} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          aria-label="任务输入"
          className="chatComposerInput"
          disabled={disabled}
          ref={setTextareaRef}
          onKeyDown={handleKeyDown}
          onChange={onChange}
          onPaste={onPaste}
          placeholder={placeholder}
          rows={1}
          value={value}
        />
        <div className="chatComposerToolbar" aria-label="对话工具">
          <input
            accept="image/*"
            className="chatComposerFileInput"
            multiple
            onChange={(event) => {
              onFilesSelected?.(event.target.files);
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label="添加附件"
            className="chatComposerTool"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Plus aria-hidden="true" strokeWidth={2.25} />
          </button>
          <span className="chatComposerHint">
            {attachments.length ? `${attachments.length} 张图片` : "本地工作区"}
          </span>
        </div>
        <div className="chatComposerActions">
          <button
            aria-label="语音输入，稍后支持"
            className="chatComposerVoice"
            disabled
            title="语音输入稍后支持"
            type="button"
          >
            <Mic aria-hidden="true" strokeWidth={2.25} />
          </button>
        <Button
          className="chatComposerSend"
          size="icon"
          type="submit"
          variant="primary"
          aria-label="发送"
          aria-busy={sending}
          disabled={isDisabled}
        >
            {sending ? "…" : <ArrowUp aria-hidden="true" strokeWidth={2.35} />}
        </Button>
        </div>
      </div>
    </form>
  );
}

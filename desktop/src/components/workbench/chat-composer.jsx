import React from "react";
import { ImagePlus, X } from "lucide-react";
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
  const hasValue = Boolean(value?.trim()) || attachments.length > 0;
  const isDisabled = disabled || !hasValue;

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
          ref={inputRef}
          onKeyDown={handleKeyDown}
          onChange={onChange}
          onPaste={onPaste}
          placeholder={placeholder}
          rows={1}
          value={value}
        />
        <div className="chatComposerMeta">
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
            aria-label="添加图片"
            className="chatComposerTool"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <ImagePlus aria-hidden="true" strokeWidth={2.25} />
          </button>
          <span>{attachments.length ? `${attachments.length} 张图片 · Enter 发送` : hasValue ? "准备发送" : "Enter 发送 · Shift Enter 换行"}</span>
        </div>
        <Button
          className="chatComposerSend"
          size="icon"
          type="submit"
          variant="primary"
          aria-label="发送"
          aria-busy={sending}
          disabled={isDisabled}
        >
          {sending ? "…" : "➤"}
        </Button>
      </div>
    </form>
  );
}

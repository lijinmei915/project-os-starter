import React from "react";
import { ArrowUp, Mic, Plus, X } from "lucide-react";
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
  onStop,
  onSubmit,
  onVoiceInput,
  modelLabel,
  placeholder,
  sending,
  value,
}) {
  const fileInputRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const recognitionRef = React.useRef(null);
  const voiceBaseRef = React.useRef("");
  const [previewAttachment, setPreviewAttachment] = React.useState(null);
  const [isListening, setIsListening] = React.useState(false);
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");
  const hasValue = Boolean(value?.trim()) || attachments.length > 0;
  const isDisabled = sending ? false : disabled || !hasValue;
  const voiceDisabled = disabled || !speechSupported || !onVoiceInput;

  React.useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (disabled && isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
    }
  }, [disabled, isListening]);

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

  const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;

  const startVoiceInput = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || !onVoiceInput) {
      setVoiceError("当前环境不支持语音输入");
      return;
    }

    recognitionRef.current?.abort?.();
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language?.startsWith("zh") ? navigator.language : "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    voiceBaseRef.current = value?.trim() ? value.trim() : "";
    setVoiceError("");

    recognition.onresult = (event) => {
      const spokenText = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")
        .trim();
      const base = voiceBaseRef.current;
      const nextValue = [base, spokenText].filter(Boolean).join(base && spokenText ? " " : "");
      onVoiceInput(nextValue);
    };

    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" ? "麦克风权限未开启" : "语音输入中断";
      setVoiceError(message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError("语音输入启动失败");
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }
    startVoiceInput();
  };

  return (
    <form className={cn("chatComposer", className)} onSubmit={onSubmit}>
      <div className="chatComposerShell" data-state={hasValue ? "filled" : "empty"}>
        {attachments.length ? (
          <div className="chatComposerAttachments">
            {attachments.map((attachment) => (
              <div className="chatAttachment" key={attachment.id}>
                <button
                  aria-label={`预览 ${attachment.name}`}
                  className="chatAttachmentPreview"
                  onClick={() => setPreviewAttachment(attachment)}
                  type="button"
                >
                  <img src={attachment.url} alt={attachment.name} />
                </button>
                <span title={attachment.name}>{attachment.name}</span>
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
          placeholder={sending ? "要求后续变更" : placeholder}
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
        <div className="chatComposerStatus" aria-live="polite">
          {sending ? <span className="chatComposerSpinner" aria-hidden="true" /> : null}
          <span>{modelLabel || "模型"}</span>
        </div>
        <div className="chatComposerActions">
          <button
            aria-label={isListening ? "停止语音输入" : "语音输入"}
            aria-pressed={isListening}
            className={cn(
              "chatComposerVoice",
              isListening && "listening",
              !speechSupported && "unsupported"
            )}
            disabled={voiceDisabled}
            onClick={toggleVoiceInput}
            title={voiceError || (speechSupported ? "语音输入" : "当前环境不支持语音输入")}
            type="button"
          >
            <Mic aria-hidden="true" strokeWidth={2.25} />
          </button>
        <button
          className={`chatComposerSend${sending ? " sending" : ""}`}
          type={sending ? "button" : "submit"}
          aria-label={sending ? "停止生成" : "发送"}
          aria-busy={sending}
          disabled={isDisabled}
          onClick={sending ? onStop : undefined}
        >
            {sending ? <span className="chatComposerStopIcon" aria-hidden="true" /> : <ArrowUp aria-hidden="true" strokeWidth={2.35} />}
        </button>
        </div>
      </div>
      {previewAttachment ? (
        <div className="chatImagePreview" role="dialog" aria-modal="true" aria-label={`预览 ${previewAttachment.name}`} onClick={() => setPreviewAttachment(null)}>
          <div className="chatImagePreviewPanel" onClick={(event) => event.stopPropagation()}>
            <div className="chatImagePreviewHeader">
              <span>{previewAttachment.name}</span>
              <button className="chatImagePreviewClose" type="button" onClick={() => setPreviewAttachment(null)} aria-label="关闭图片预览">
                <X aria-hidden="true" strokeWidth={2.25} />
              </button>
            </div>
            <img src={previewAttachment.url} alt={previewAttachment.name} />
          </div>
        </div>
      ) : null}
    </form>
  );
}

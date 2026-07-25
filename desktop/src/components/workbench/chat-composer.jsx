import React from "react";
import { ArrowUp, Check, ChevronDown, Loader2, Mic, Plus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { cn } from "../../lib/cn";

function modelUsage(model) {
  const name = String(model || "").toLowerCase();
  if (/image|dall|flux|sdxl|stable/.test(name)) return "图像";
  if (/codex|code|coder/.test(name)) return "编程";
  if (/reason|thinking|r1|o1|o3|o4/.test(name)) return "推理";
  if (/mini|nano|flash|lite|small|compact/.test(name)) return "轻量";
  return "对话";
}

function modelDescription(model) {
  const usage = modelUsage(model);
  if (usage === "图像") return "图像生成";
  if (usage === "编程") return "代码任务";
  if (usage === "推理") return "复杂推理";
  if (usage === "轻量") return "更快轻量";
  return "通用对话";
}

function modelAvailabilityLabel(entry) {
  if (entry?.status === "available") return "可用";
  if (entry?.status === "unavailable") return "不可用";
  return "未验证";
}

function flatModelOptions(models) {
  return Array.from(new Set((models || []).filter(Boolean)));
}

function defaultFavoriteModelOptions(models, currentModel) {
  const uniqueModels = Array.from(new Set((models || []).filter(Boolean)));
  const favorites = uniqueModels.filter((model) => {
    const name = String(model).toLowerCase();
    if (model === currentModel) return true;
    return (
      !/image|dall|flux|sdxl|stable/.test(name) &&
      !/-\d{4}-\d{2}-\d{2}$/.test(name) &&
      !/preview|deprecated|legacy/.test(name) &&
      !/nano|mini|compact/.test(name)
    );
  }).slice(0, 5);
  return Array.from(new Set([currentModel, ...favorites].filter(Boolean)));
}

const favoriteModelsStorageKey = "omnidesk.favoriteModels.v1";

function readFavoriteModels() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(favoriteModelsStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeFavoriteModels(models) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(favoriteModelsStorageKey, JSON.stringify(models));
}

export function ChatComposer({
  attachmentError = "",
  attachments = [],
  className,
  disabled,
  inputRef,
  onChange,
  onFilesSelected,
  onPaste,
  onRemoveAttachment,
  onModelMenuOpen,
  onModelSelect,
  onModelTest,
  onStop,
  onSubmit,
  onVoiceInput,
  currentModel,
  modelAvailability = {},
  modelLoading,
  modelLabel,
  modelOptions = [],
  modelProfile,
  modelSource,
  modelTesting,
  placeholder,
  sending,
  toolbarHint: toolbarHintOverride,
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
  const [storedFavoriteModels, setStoredFavoriteModels] = React.useState(() => readFavoriteModels());
  const hasValue = Boolean(value?.trim()) || attachments.length > 0;
  const hasTakeoverInput = sending && hasValue;
  const isDisabled = sending ? false : disabled || !hasValue;
  const voiceDisabled = disabled || !speechSupported || !onVoiceInput;
  const flatModels = flatModelOptions(modelOptions);
  const defaultFavoriteModels = defaultFavoriteModelOptions(modelOptions, currentModel);
  const favoriteModels = (storedFavoriteModels.length ? storedFavoriteModels : defaultFavoriteModels)
    .filter((model) => flatModels.includes(model) || model === currentModel);
  const currentModelStatus = modelAvailability[currentModel]?.status || "unknown";
  const currentModelStatusLabel = currentModelStatus === "available"
    ? "Work"
    : currentModelStatus === "unavailable"
      ? "Not work"
      : "Checking";
  const toolbarHint = toolbarHintOverride || (isListening
    ? "正在听写"
    : attachments.length
      ? `${attachments.length} 张图片`
      : "");

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

  const updateFavoriteModels = React.useCallback((updater) => {
    setStoredFavoriteModels((current) => {
      const base = current.length ? current : defaultFavoriteModels;
      const next = Array.from(new Set(updater(base).filter(Boolean)));
      writeFavoriteModels(next);
      return next;
    });
  }, [defaultFavoriteModels]);

  const addFavoriteModel = React.useCallback((model) => {
    updateFavoriteModels((current) => [model, ...current].slice(0, 12));
  }, [updateFavoriteModels]);

  const removeFavoriteModel = React.useCallback((model) => {
    updateFavoriteModels((current) => current.filter((item) => item !== model));
  }, [updateFavoriteModels]);

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
    onSubmit?.(event);
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
        {attachmentError ? <p className="chatComposerAttachmentError" role="status">{attachmentError}</p> : null}
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
          {toolbarHint ? <span className="chatComposerHint">{toolbarHint}</span> : null}
        </div>
        <DropdownMenu onOpenChange={(open) => {
          if (open) onModelMenuOpen?.();
        }}>
          <DropdownMenuTrigger asChild>
            <button className="chatComposerStatus" type="button" aria-label="选择模型">
              {modelLoading ? <span className="chatComposerSpinner" aria-hidden="true" /> : null}
              <span className="chatComposerStatusLabel">{modelLabel || "模型"}</span>
              {modelLoading ? (
                <Loader2 className="chatComposerStatusIcon" aria-hidden="true" strokeWidth={2} />
              ) : (
                <ChevronDown className="chatComposerStatusIcon" aria-hidden="true" strokeWidth={2.2} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="chatComposerModelMenu" align="end">
            <div className="chatComposerModelHeader">
              <div className="chatComposerModelHeaderText">
                <span>{modelProfile || "当前 API"}</span>
                <strong>{currentModel || modelLabel || "未选择模型"}</strong>
              </div>
              <button
                className={`chatComposerModelHealth chatComposerModelHealth-${currentModelStatus}`}
                disabled={!currentModel || modelTesting}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onModelTest?.(currentModel);
                }}
                type="button"
                title="重新检查当前模型连接"
              >
                <span className="chatComposerModelHealthDot" aria-hidden="true" />
                {modelTesting ? "Checking" : currentModelStatusLabel}
              </button>
            </div>
            <div className="chatComposerModelSource">
              <span>{modelSource || "当前可用模型"}</span>
              <span>{modelOptions.length ? `${modelOptions.length} 个` : "0 个"}</span>
            </div>
            {favoriteModels.length ? (
              <div className="chatComposerFavoriteModels" aria-label="我的常选">
                <div className="chatComposerModelSectionTitle">我的常选</div>
                <div className="chatComposerFavoriteGrid">
                  {favoriteModels.map((model) => (
                    <button
                      className={`chatComposerFavoriteModel${model === currentModel ? " active" : ""}`}
                      key={model}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onModelSelect?.(model);
                      }}
                      type="button"
                    >
                      <span>{model}</span>
                      {model === currentModel ? <Check aria-hidden="true" strokeWidth={2.2} /> : null}
                      <span
                        aria-label={`从常选移除 ${model}`}
                        className="chatComposerFavoriteRemove"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeFavoriteModel(model);
                        }}
                        role="button"
                        tabIndex={0}
                        title="从常选移除"
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          removeFavoriteModel(model);
                        }}
                      >
                        <X aria-hidden="true" strokeWidth={2.2} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {flatModels.length ? (
              <div className="chatComposerModelSection">
                <div className="chatComposerModelSectionTitle">全部模型</div>
                {flatModels.map((model) => (
                  <DropdownMenuItem
                    className="chatComposerModelItem"
                    key={model}
                    onSelect={() => onModelSelect?.(model)}
                >
                  <span className="chatComposerModelName">{model}</span>
                    <span className={`chatComposerModelMeta ${modelAvailability[model]?.status || ""}`}>
                      {model === currentModel ? `当前 · ${modelAvailabilityLabel(modelAvailability[model])}` : `${modelDescription(model)} · ${modelAvailabilityLabel(modelAvailability[model])}`}
                    </span>
                  <span className="chatComposerModelItemActions">
                    {model === currentModel ? <Check aria-hidden="true" strokeWidth={2.2} /> : null}
                    {!favoriteModels.includes(model) ? (
                      <button
                        aria-label={`添加 ${model} 到常选`}
                        className="chatComposerModelAdd"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          addFavoriteModel(model);
                        }}
                        type="button"
                      >
                        <Plus aria-hidden="true" strokeWidth={2.2} />
                      </button>
                    ) : null}
                  </span>
                </DropdownMenuItem>
                ))}
              </div>
            ) : null}
            {!modelOptions.length ? (
              <div className="chatComposerModelEmpty">没有读取到模型列表</div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
          className={`chatComposerSend${sending && !hasTakeoverInput ? " sending" : ""}${hasTakeoverInput ? " takeover" : ""}`}
          type="button"
          aria-label={hasTakeoverInput ? "发送新要求" : sending ? "停止生成" : "发送"}
          aria-busy={sending}
          disabled={isDisabled}
          onClick={hasTakeoverInput ? onSubmit : sending ? onStop : onSubmit}
        >
            {sending && !hasTakeoverInput ? <span className="chatComposerStopIcon" aria-hidden="true" /> : <ArrowUp aria-hidden="true" strokeWidth={2.35} />}
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

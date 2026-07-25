import { ChatComposer } from "./chat-composer";

export function ChatDock({
  attachmentError, attachments, chatLoading, composerRef, onFilesSelected, onInputChange, onPaste,
  onRemoveAttachment, onStop, onSubmit, onVoiceInput, currentModel, modelAvailability,
  modelLabel, modelLoading, modelOptions, modelProfile, modelSource, modelTesting,
  onLoadComposerModels, onSelectComposerModel, onTestComposerModel, goalRefinementMode,
  taskContext, taskContextHeader, processing, planLoading, taskInput,
}) {
  const placeholder = goalRefinementMode
    ? "说说哪里还不满意，比如交互、视觉、文案、流程或结果..."
    : taskContext
      ? `补充「${taskContext.title || "当前任务"}」的要求，或调整下一步...`
      : "问项目情况、描述想法，或说要改什么...";
  return (
    <section className="chatDock" aria-label="对话输入">
      {taskContextHeader}
      <ChatComposer
        attachmentError={attachmentError}
        attachments={attachments}
        inputRef={composerRef}
        disabled={false}
        onFilesSelected={onFilesSelected}
        onChange={onInputChange}
        onPaste={onPaste}
        onRemoveAttachment={onRemoveAttachment}
        onStop={onStop}
        onSubmit={onSubmit}
        onVoiceInput={onVoiceInput}
        currentModel={currentModel}
        modelAvailability={modelAvailability}
        modelLabel={modelLabel}
        modelLoading={modelLoading}
        modelOptions={modelOptions}
        modelProfile={modelProfile}
        modelSource={modelSource}
        modelTesting={modelTesting}
        onModelMenuOpen={onLoadComposerModels}
        onModelSelect={onSelectComposerModel}
        onModelTest={onTestComposerModel}
        placeholder={placeholder}
        sending={planLoading || chatLoading || processing}
        value={taskInput}
      />
    </section>
  );
}

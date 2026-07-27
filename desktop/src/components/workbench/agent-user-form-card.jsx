import React, { useMemo, useState } from "react";
import { agentInteractionPresentation } from "../../lib/conversation-agent-events";
import { agentRunWorkflowState, workflowStateIsFailure } from "../../lib/workflow-state";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

function initialAnswers(fields) {
  return Object.fromEntries((fields || []).map((field) => [field.id, field.type === "multi-choice" ? [] : field.type === "confirm" ? false : ""]));
}

export function AgentUserFormCard({ interaction, onRetry, onSubmit, run = {} }) {
  const fields = Array.isArray(interaction?.fields) ? interaction.fields : [];
  const [answers, setAnswers] = useState(() => initialAnswers(fields));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const submitted = interaction?.status === "submitted";
  const presentation = agentInteractionPresentation(interaction, { ...run, workflowFailed: workflowStateIsFailure(agentRunWorkflowState(run)) });
  const submit = async (action) => {
    if (submitted || saving) return;
    if (action === "submit") {
      const missing = fields.find((field) => field.required && (Array.isArray(answers[field.id]) ? !answers[field.id].length : field.type === "confirm" ? !answers[field.id] : !String(answers[field.id] || "").trim()));
      if (missing) {
        setError(`请完成「${missing.label}」。`);
        return;
      }
    }
    setError("");
    setSaving(true);
    try { await onSubmit?.({ action, answers }); } finally { setSaving(false); }
  };
  const renderedAnswers = useMemo(() => interaction?.response?.answers || {}, [interaction]);

  if (presentation.collapsed) {
    const retry = async () => {
      if (retrying) return;
      setRetrying(true);
      try { await onRetry?.(); } finally { setRetrying(false); }
    };
    return (
      <section className={`conversationUserForm conversationUserForm-collapsed conversationUserForm-${presentation.tone}`} aria-label={interaction?.title || "已处理的确认"}>
        <header><strong>{interaction?.title || "需要确认"}</strong><span>{presentation.label}</span></header>
        <p className="conversationUserFormSummary">{presentation.summary}</p>
        {presentation.tone === "failed" ? <footer><Button disabled={retrying} onClick={retry} size="sm" type="button" variant="outline">{retrying ? "正在重新开始" : "重新开始"}</Button>{presentation.detail ? <details className="conversationUserFormDetails"><summary>查看详情</summary><code>{presentation.detail}</code></details> : null}</footer> : null}
      </section>
    );
  }

  return (
    <section className="conversationUserForm" aria-label={interaction?.title || "需要确认"}>
      <header>
        <div><strong>{interaction?.title || "需要确认"}</strong>{interaction?.description ? <p>{interaction.description}</p> : null}</div>
        <span>{saving ? "正在保存回答" : presentation.label}</span>
      </header>
      <div className="conversationUserFormFields">
        {fields.map((field) => (
          <Field key={field.id} label={field.label} error={error && field.required && !answers[field.id] ? error : ""}>
            {({ id }) => submitted ? <div className="conversationUserFormAnswer">{String(renderedAnswers[field.id] ?? "未填写")}</div> : field.type === "text" ? (
              <Input id={id} value={answers[field.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} />
            ) : field.type === "confirm" ? (
              <label className="conversationUserFormOption"><input checked={Boolean(answers[field.id])} id={id} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.checked }))} type="checkbox" /> <span>确认</span></label>
            ) : (
              <div className="conversationUserFormOptions" role={field.type === "single-choice" ? "radiogroup" : "group"}>
                {(field.options || []).map((option) => {
                  const selected = field.type === "multi-choice" ? (answers[field.id] || []).includes(option.value) : answers[field.id] === option.value;
                  return <label className="conversationUserFormOption" key={option.value}><input checked={selected} name={field.type === "single-choice" ? `${interaction.id}-${field.id}` : undefined} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: field.type === "multi-choice" ? (event.target.checked ? [...(current[field.id] || []), option.value] : (current[field.id] || []).filter((value) => value !== option.value)) : option.value }))} type={field.type === "multi-choice" ? "checkbox" : "radio"} value={option.value} /> <span>{option.label}</span></label>;
                })}
              </div>
            )}
          </Field>
        ))}
      </div>
      {error ? <p className="conversationUserFormError">{error}</p> : null}
      {!submitted ? <footer><Button disabled={saving} onClick={() => submit("submit")} size="sm" type="button" variant="primary">{saving ? "正在保存" : "提交"}</Button><Button disabled={saving} onClick={() => submit("skip")} size="sm" type="button" variant="ghost">跳过</Button></footer> : null}
    </section>
  );
}

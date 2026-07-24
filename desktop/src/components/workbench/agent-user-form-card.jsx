import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

function initialAnswers(fields) {
  return Object.fromEntries((fields || []).map((field) => [field.id, field.type === "multi-choice" ? [] : field.type === "confirm" ? false : ""]));
}

function answerSummary(interaction, runStatus) {
  const response = interaction?.response;
  if (!response) return "";
  if (response.action === "skip") return "已跳过";
  if (["queued", "running"].includes(runStatus)) return "AI 正在继续";
  if (runStatus === "failed") return "继续失败";
  return "已提交";
}

export function AgentUserFormCard({ interaction, onSubmit, runStatus = "" }) {
  const fields = Array.isArray(interaction?.fields) ? interaction.fields : [];
  const [answers, setAnswers] = useState(() => initialAnswers(fields));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitted = interaction?.status === "submitted";
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

  return (
    <section className="conversationUserForm" aria-label={interaction?.title || "需要确认"}>
      <header>
        <div><strong>{interaction?.title || "需要确认"}</strong>{interaction?.description ? <p>{interaction.description}</p> : null}</div>
        <span>{saving ? "正在保存回答" : submitted ? answerSummary(interaction, runStatus) : "等待你的回答"}</span>
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

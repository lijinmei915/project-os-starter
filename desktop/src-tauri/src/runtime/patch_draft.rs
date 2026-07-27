use crate::runtime::agent_executor::{
    default_agent_executor, AgentExecutionMode, AgentExecutionRequest,
};
use crate::runtime::patch::{
    files_from_unified_diff, normalize_hermes_unified_diff, provider_draft_prompt, PatchDraft,
};
#[cfg(not(test))]
use crate::runtime::provider::sync_hermes_runtime_config;
use crate::runtime::provider::{
    chat_completion_content, post_chat_completion, prepare_for_request, read_secret,
    record_failure, require_success, trim_for_trace, ProviderConfig,
};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// Inputs for the complete read-only Patch Draft lifecycle. The command
/// adapter owns request registration and cleanup; this domain owns all draft
/// semantics, model selection, bounded regeneration and downgrade evidence.
pub struct GenerateDraftInput<'a> {
    pub app_root: &'a Path,
    pub project_root: &'a Path,
    pub configured_provider: &'a ProviderConfig,
    pub task: &'a Value,
    pub cancellation: Option<CancellationToken>,
}

/// Generates one governed Patch Draft without writing project files. A failed
/// Hermes response gets exactly one regeneration with the same authorized
/// context, then a normal Provider fallback. Placeholder drafts remain
/// explicitly non-applicable to the Apply path.
pub async fn generate_draft(input: GenerateDraftInput<'_>) -> Result<PatchDraft, String> {
    let title = input
        .task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名任务")
        .to_string();
    let plan = input
        .task
        .get("plan")
        .ok_or_else(|| "任务缺少 plan，无法生成 patch 草案".to_string())?;
    let files = crate::runtime::patch::plan_context_files(plan, input.project_root);
    if let Some(reason) = crate::runtime::patch::draft_ineligibility_reason(plan, &files) {
        return Ok(crate::runtime::patch::not_applicable_draft(
            &title, &files, &reason,
        ));
    }
    let contexts = crate::runtime::patch::read_context_files(input.project_root, &files)?;
    if !input.configured_provider.enabled {
        return Ok(crate::runtime::patch::local_placeholder_draft(
            &title,
            &files,
            &contexts,
            "未配置可用模型；这是不可应用的占位草稿。",
        ));
    }

    let (provider, provider_switch_note) =
        match prepare_for_request(input.app_root, input.configured_provider, &HashSet::new()).await
        {
            Ok(result) => result,
            Err(error) => {
                let mut draft = crate::runtime::patch::local_placeholder_draft(
                    &title,
                    &files,
                    &contexts,
                    &format!("Provider precheck: {error}"),
                );
                draft
                    .trace
                    .push(format!("PROVIDER_PRECHECK_FAILED: {error}"));
                return Ok(draft);
            }
        };
    #[cfg(not(test))]
    if provider.active_profile_id != input.configured_provider.active_profile_id {
        sync_hermes_runtime_config(&provider)?;
    }

    let hermes_result = if let Some(token) = input.cancellation.clone() {
        let cancellation = token.clone();
        tokio::select! {
            _ = cancellation.cancelled() => Err("请求已取消".to_string()),
            result = generate_hermes_draft(&provider, input.project_root, &title, plan, &contexts, None, Some(token)) => result,
        }
    } else {
        generate_hermes_draft(
            &provider,
            input.project_root,
            &title,
            plan,
            &contexts,
            None,
            None,
        )
        .await
    };
    let hermes_error = match hermes_result {
        Ok(mut draft) => {
            if !provider_switch_note.is_empty() {
                draft
                    .trace
                    .push(format!("PROVIDER_SWITCH: {provider_switch_note}"));
            }
            return Ok(draft);
        }
        Err(error) if error == "请求已取消" => return Err(error),
        Err(error) => match generate_hermes_draft(
            &provider,
            input.project_root,
            &title,
            plan,
            &contexts,
            Some(&error),
            None,
        )
        .await
        {
            Ok(mut draft) => {
                draft
                    .trace
                    .push("DRAFT_RETRY: Hermes accepted the regenerated draft".to_string());
                if !provider_switch_note.is_empty() {
                    draft
                        .trace
                        .push(format!("PROVIDER_SWITCH: {provider_switch_note}"));
                }
                return Ok(draft);
            }
            Err(retry_error) => format!("{error}；重试失败：{retry_error}"),
        },
    };

    let provider_result = if let Some(token) = input.cancellation {
        tokio::select! {
            _ = token.cancelled() => Err("请求已取消".to_string()),
            result = generate_provider_draft(&provider, input.project_root, &title, plan, &contexts, Some(&hermes_error)) => result,
        }
    } else {
        generate_provider_draft(
            &provider,
            input.project_root,
            &title,
            plan,
            &contexts,
            Some(&hermes_error),
        )
        .await
    };
    match provider_result {
        Ok(mut draft) => {
            if !provider_switch_note.is_empty() {
                draft
                    .trace
                    .push(format!("PROVIDER_SWITCH: {provider_switch_note}"));
            }
            draft.trace.push(format!(
                "HERMES_FALLBACK: {}",
                trim_for_trace(&hermes_error)
            ));
            Ok(draft)
        }
        Err(error) if error == "请求已取消" => Err(error),
        Err(error) => {
            record_failure(input.app_root, &provider, &error)?;
            let mut draft = crate::runtime::patch::local_placeholder_draft(
                &title,
                &files,
                &contexts,
                &format!("Hermes: {hermes_error}; Provider: {error}"),
            );
            draft.trace.push(format!(
                "HERMES_FALLBACK: {}",
                trim_for_trace(&hermes_error)
            ));
            draft.trace.push(format!("PROVIDER_FALLBACK: {error}"));
            Ok(draft)
        }
    }
}

/// Provider draft transport belongs outside the standalone Patch Normalizer.
/// It reuses the shared prompt and diff validators after the Patch Draft
/// lifecycle has selected a usable connection and bounded its retry policy.
pub async fn generate_provider_draft(
    provider: &ProviderConfig,
    root: &Path,
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
    retry_reason: Option<&str>,
) -> Result<PatchDraft, String> {
    let api_key = read_secret(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let prompt = provider_draft_prompt(title, plan, contexts, retry_reason);
    let response = post_chat_completion(
        provider,
        &api_key,
        &json!({
            "model": provider.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are OmniDesk Local Agent Core. Return only strict JSON. Do not include markdown fences."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.15
        }),
        Duration::from_secs(60),
    )
    .await?;
    let content = chat_completion_content(require_success(response, "provider").await?).await?;
    let mut draft: PatchDraft = serde_json::from_str(&content)
        .map_err(|err| format!("patch draft JSON 解析失败: {}", err))?;
    draft.diff = normalize_hermes_unified_diff(&draft.diff, contexts)?;
    draft.files = files_from_unified_diff(&draft.diff);
    draft.allowed_files = contexts.iter().map(|(path, _)| path.clone()).collect();
    draft.context_files = draft.allowed_files.clone();
    draft.draft_attempt = usize::from(retry_reason.is_some()) + 1;
    draft.failure_reason = retry_reason.unwrap_or("").to_string();
    draft.not_applicable = false;
    draft
        .guardrails
        .push("当前只是 patch 草案，尚未写入文件。".to_string());
    draft
        .trace
        .push(format!("PROVIDER_PATCH: {}", provider.model));
    Ok(draft)
}

pub async fn generate_hermes_draft(
    provider: &ProviderConfig,
    root: &Path,
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
    retry_reason: Option<&str>,
    cancellation: Option<CancellationToken>,
) -> Result<PatchDraft, String> {
    let api_key = read_secret(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }
    let allowed = contexts
        .iter()
        .map(|(path, _)| path.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let retry_instruction = retry_reason
        .map(|reason| format!(" The previous draft was rejected: {reason}. Regenerate a corrected diff; do not change the allowed file list."))
        .unwrap_or_default();
    let prompt = format!(
        "Implement the coding task `{title}` according to this plan: {plan}. You are in a governed project. First use only read_file, list_files, search_project, or git_status tool calls to inspect the minimum context. Then return ONLY a final JSON envelope: {{\"type\":\"final\",\"result\":{{\"summary\":\"...\",\"diff\":\"unified diff\",\"files\":[\"...\"]}}}}. Never apply changes or run checks. Only these planned context files may appear in the final diff: {allowed}.{retry_instruction}",
        title = title, plan = plan, allowed = allowed, retry_instruction = retry_instruction
    );
    let root = root.to_path_buf();
    let api_base = provider.api_base.clone();
    let api_key_env = provider.api_key_env.clone();
    let executor = default_agent_executor();
    let result = tauri::async_runtime::spawn_blocking(move || {
        executor.execute(AgentExecutionRequest {
            mode: AgentExecutionMode::Start,
            root,
            api_key,
            api_base,
            api_key_env,
            prompt,
            max_steps: 20,
            cancellation,
        })
    })
    .await
    .map_err(|err| format!("Agent Executor worker 中断: {err}"))??;
    if result.status != "succeeded" {
        return Err(result.summary);
    }
    let payload = result
        .result
        .ok_or_else(|| "Hermes structured final 缺少 result".to_string())?;
    let summary = payload
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Hermes 已生成结构化改动草稿")
        .to_string();
    let diff = payload
        .get("diff")
        .and_then(Value::as_str)
        .ok_or_else(|| "Hermes structured final 缺少 diff".to_string())?;
    let diff = normalize_hermes_unified_diff(diff, contexts)?;
    let files = files_from_unified_diff(&diff);
    Ok(PatchDraft {
        summary,
        diff,
        files,
        allowed_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        context_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        draft_attempt: usize::from(retry_reason.is_some()) + 1,
        failure_reason: retry_reason.unwrap_or("").to_string(),
        not_applicable: false,
        guardrails: vec![
            "Hermes 只读取上下文并生成草案，不会写入文件。".to_string(),
            "Apply 前必须经过用户确认。".to_string(),
        ],
        trace: vec![
            "PATCH_MODE: hermes-acp governed structured loop".to_string(),
            format!("HERMES_STEPS: {}", result.step),
        ],
    })
}

#[cfg(test)]
mod tests {
    use super::{generate_draft, GenerateDraftInput};
    use crate::runtime::provider::default_config;
    use serde_json::json;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn disabled_provider_returns_a_non_applicable_placeholder_with_fixed_context() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-patch-draft-disabled-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/lib.rs"), "pub fn value() -> u8 { 1 }\n").unwrap();
        let provider = default_config();
        let task = json!({
            "title": "更新实现",
            "plan": {
                "candidateChanges": ["调整返回值"],
                "filesToRead": ["src/lib.rs", ".env.local"]
            }
        });

        let draft = tauri::async_runtime::block_on(generate_draft(GenerateDraftInput {
            app_root: &root,
            project_root: &root,
            configured_provider: &provider,
            task: &task,
            cancellation: None,
        }))
        .unwrap();

        assert!(!draft.not_applicable);
        assert!(draft.diff.contains("PATCH_DRAFT_PENDING"));
        assert_eq!(draft.allowed_files, vec!["src/lib.rs"]);
        assert_eq!(draft.context_files, vec!["src/lib.rs"]);
        assert!(draft.failure_reason.contains("未配置可用模型"));
        fs::remove_dir_all(root).unwrap();
    }
}

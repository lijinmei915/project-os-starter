use crate::runtime::provider::{
    chat_completion_content, post_chat_completion, read_secret, require_success, ProviderConfig,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Duration;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadonlyPlan {
    pub task: String,
    pub project_name: String,
    pub mode: String,
    pub summary: String,
    pub steps: Vec<String>,
    pub files_to_read: Vec<String>,
    pub candidate_changes: Vec<String>,
    pub checks: Vec<String>,
    pub guardrails: Vec<String>,
    pub trace: Vec<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanAttachment {
    pub name: String,
    pub mime_type: String,
    pub data_url: String,
}

pub struct PlanContext {
    pub task: String,
    pub attachments: Vec<PlanAttachment>,
    pub project_name: String,
    pub stage: String,
    pub root: PathBuf,
    pub provider: ProviderConfig,
}

pub fn build_local_readonly_plan(context: PlanContext) -> ReadonlyPlan {
    let mut files_to_read = vec![
        "AGENTS.md".to_string(),
        "PROJECT.md".to_string(),
        "HANDOFF.md".to_string(),
    ];
    for path in ["docs/ARCHITECTURE.md", "docs/PRODUCT_PLAN.md"] {
        if context.root.join(path).exists() {
            files_to_read.push(path.to_string());
        }
    }

    let lower_task = context.task.to_lowercase();
    let mut candidate_changes = vec!["先不改文件；只形成计划和确认点。".to_string()];
    let mut checks = vec!["npm --prefix desktop test".to_string()];
    if lower_task.contains("ui")
        || lower_task.contains("页面")
        || lower_task.contains("组件")
        || lower_task.contains("桌面")
    {
        candidate_changes
            .push("可能涉及 desktop/src/main.jsx 和 desktop/src/styles.css。".to_string());
        checks.push("npm --prefix desktop run web:build".to_string());
    }
    if lower_task.contains("rust")
        || lower_task.contains("tauri")
        || lower_task.contains("core")
        || lower_task.contains("命令")
        || lower_task.contains("本地")
    {
        candidate_changes
            .push("可能涉及 desktop/src-tauri/src/main.rs 和 Tauri capability。".to_string());
        checks.push("cargo check --manifest-path desktop/src-tauri/Cargo.toml".to_string());
    }
    checks.sort();
    checks.dedup();
    files_to_read.sort();
    files_to_read.dedup();
    candidate_changes.sort();
    candidate_changes.dedup();

    let attachment_count = context.attachments.len();
    let attachment_names = context
        .attachments
        .iter()
        .map(|attachment| attachment.name.clone())
        .collect::<Vec<_>>();
    let mut steps = vec![
        "读取入口规则和当前交接，确认任务边界。".to_string(),
        "读取项目状态、推荐结果和相关实现文件，形成最小改动范围。".to_string(),
        "列出候选改动、风险点和需要用户确认的执行步骤。".to_string(),
        "用户确认后，再进入受控执行、diff review 和检查。".to_string(),
    ];
    if attachment_count > 0 {
        steps.insert(
            0,
            format!(
                "结合用户附带截图确认问题位置：{}",
                attachment_names.join("、")
            ),
        );
    }
    let mut trace = vec![
        format!("ROOT: {}", context.root.display()),
        format!("PROJECT: {}", context.project_name),
        format!(
            "PROVIDER: {} / {} ({})",
            context.provider.provider,
            context.provider.model,
            if context.provider.enabled {
                "configured"
            } else {
                "disabled"
            }
        ),
        "PLANNER: local heuristic planner; external model call not enabled yet".to_string(),
    ];
    if attachment_count > 0 {
        trace.push(format!("IMAGE_ATTACHMENTS: {attachment_count}"));
    }
    ReadonlyPlan {
        task: context.task.clone(),
        project_name: context.project_name.clone(),
        mode: "plan".to_string(),
        summary: format!(
            "我会先围绕「{}」理清范围，再给出最小下一步。当前项目为 {}，阶段为 {}。{}",
            context.task,
            context.project_name,
            context.stage,
            if attachment_count > 0 {
                "已收到图片附件，支持视觉的模型会结合截图判断。"
            } else {
                ""
            }
        ),
        steps,
        files_to_read,
        candidate_changes,
        checks,
        guardrails: vec![
            "不自动写文件。".to_string(),
            "不自动运行命令。".to_string(),
            "模型 API key 不进入前端。".to_string(),
            "继续动手前需要用户确认改动范围。".to_string(),
        ],
        trace,
    }
}

pub async fn generate_provider_plan(context: &PlanContext) -> Result<ReadonlyPlan, String> {
    let api_key = read_secret(&context.root, &context.provider.api_key_env).ok_or_else(|| {
        format!(
            "环境变量或 .env.local 中未设置 {}",
            context.provider.api_key_env
        )
    })?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", context.provider.api_key_env));
    }
    let prompt = provider_prompt(context);
    let user_content = if context.attachments.is_empty() {
        Value::String(prompt)
    } else {
        let mut parts = vec![json!({ "type": "text", "text": prompt })];
        for attachment in &context.attachments {
            parts.push(json!({ "type": "image_url", "image_url": { "url": attachment.data_url, "detail": "auto" } }));
        }
        Value::Array(parts)
    };
    let response = post_chat_completion(&context.provider, &api_key, &json!({
        "model": context.provider.model,
        "messages": [
            { "role": "system", "content": "You are OmniDesk Local Agent Core. Return only strict JSON matching the requested schema. Do not include markdown." },
            { "role": "user", "content": user_content }
        ],
        "temperature": 0.2
    }), Duration::from_secs(45)).await?;
    let content = chat_completion_content(require_success(response, "provider").await?).await?;
    let mut plan: ReadonlyPlan =
        serde_json::from_str(&content).map_err(|err| format!("provider JSON 解析失败: {err}"))?;
    plan.mode = "plan".to_string();
    plan.task = context.task.clone();
    plan.project_name = context.project_name.clone();
    plan.guardrails
        .push("真实 provider 已调用，但仍只生成计划，不执行写入。".to_string());
    plan.trace.push(format!(
        "PROVIDER_CALL: {} / {}",
        context.provider.provider, context.provider.model
    ));
    if !context.attachments.is_empty() {
        plan.trace
            .push(format!("VISION_ATTACHMENTS: {}", context.attachments.len()));
    }
    plan.trace.push(format!("ROOT: {}", context.root.display()));
    Ok(plan)
}

fn provider_prompt(context: &PlanContext) -> String {
    format!(
        r#"Generate a readonly execution plan for this local desktop AI workbench task.

Return strict JSON with this exact shape:
{{
  "task": "string",
  "projectName": "string",
  "mode": "readonly-plan",
  "summary": "string",
  "steps": ["string"],
  "filesToRead": ["string"],
  "candidateChanges": ["string"],
  "checks": ["string"],
  "guardrails": ["string"],
  "trace": ["string"]
}}

Constraints:
- Do not propose automatic file writes.
- Do not propose arbitrary shell commands.
- Prefer OmniDesk checks: npm --prefix desktop test, npm --prefix desktop run web:build, cargo check --manifest-path desktop/src-tauri/Cargo.toml.
- Keep the plan concise and actionable.
- Use Chinese for user-facing plan text.

Project: {}
Stage: {}
Root: {}
Task: {}
"#,
        context.project_name,
        context.stage,
        context.root.display(),
        context.task
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_plan_keeps_planning_read_only() {
        let mut provider = crate::runtime::provider::default_config();
        provider.enabled = false;
        let plan = build_local_readonly_plan(PlanContext {
            task: "优化桌面组件".to_string(),
            attachments: Vec::new(),
            project_name: "OmniDesk".to_string(),
            stage: "收口".to_string(),
            root: PathBuf::from("."),
            provider,
        });
        assert_eq!(plan.mode, "plan");
        assert!(plan.guardrails.iter().any(|item| item == "不自动写文件。"));
        assert!(plan
            .checks
            .iter()
            .any(|item| item == "npm --prefix desktop run web:build"));
    }
}

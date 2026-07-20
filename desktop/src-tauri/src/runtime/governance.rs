use std::path::Path;
use std::process::Command;

#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct GovernanceActionResult {
    pub id: String,
    pub label: String,
    pub command: String,
    pub success: bool,
    pub code: Option<i32>,
    pub output: String,
}

struct GovernanceActionSpec {
    id: &'static str,
    label: &'static str,
    script: &'static str,
    args: &'static [&'static str],
}

fn action_spec(id: &str) -> Option<GovernanceActionSpec> {
    match id {
        "scan" => Some(GovernanceActionSpec {
            id: "scan",
            label: "一键扫描",
            script: "scripts/project-runner.sh",
            args: &["--source", "local"],
        }),
        "run" => Some(GovernanceActionSpec {
            id: "run",
            label: "运行治理检查",
            script: "scripts/project-runner.sh",
            args: &["--source", "local"],
        }),
        "check" => Some(GovernanceActionSpec {
            id: "check",
            label: "项目检查",
            script: "scripts/check-ai-project.sh",
            args: &[],
        }),
        "report" => Some(GovernanceActionSpec {
            id: "report",
            label: "生成项目报告",
            script: "scripts/check-ai-project.sh",
            args: &["--write-report"],
        }),
        "recommend" => Some(GovernanceActionSpec {
            id: "recommend",
            label: "生成优化建议",
            script: "scripts/recommend-next.sh",
            args: &[],
        }),
        "prune" => Some(GovernanceActionSpec {
            id: "prune",
            label: "清理过期骨架产物",
            script: "scripts/prune-project-os-artifacts.sh",
            args: &[],
        }),
        _ => None,
    }
}

pub fn execute(
    target: &Path,
    runtime_root: &Path,
    action_id: &str,
    passthrough: &[String],
) -> Result<GovernanceActionResult, String> {
    let spec =
        action_spec(action_id).ok_or_else(|| format!("不允许执行这个治理动作：{action_id}"))?;
    let script = runtime_root.join(spec.script);
    if !script.is_file() {
        return Err(format!("治理动作所需脚本不存在：{}", script.display()));
    }
    let output = Command::new("bash")
        .arg(&script)
        .arg(target)
        .args(spec.args)
        .args(passthrough)
        .current_dir(target)
        .output()
        .map_err(|error| format!("执行治理动作 {} 失败：{error}", spec.id))?;
    Ok(GovernanceActionResult {
        id: spec.id.to_string(),
        label: spec.label.to_string(),
        command: format!("bash {} {}", spec.script, target.display()),
        success: output.status.success(),
        code: output.status.code(),
        output: trim_output(&format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )),
    })
}

fn trim_output(value: &str) -> String {
    let trimmed = value.trim();
    let mut result = trimmed.chars().take(6_000).collect::<String>();
    if trimmed.chars().count() > 6_000 {
        result.push_str("\n...output trimmed...");
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_only_the_governance_action_allowlist() {
        assert!(action_spec("scan").is_some());
        assert!(action_spec("recommend").is_some());
        assert!(action_spec("report").is_some());
        assert!(action_spec("shell").is_none());
    }
}

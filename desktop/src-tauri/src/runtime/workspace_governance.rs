use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

const STATE_PATH: &str = ".omnidesk/data/state.json";
const PROFILE_PATH: &str = ".omnidesk/data/project-profile.json";
const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const REGISTRY_PATH: &str = ".omnidesk/data/desktop-registry.json";
const WORKSPACE_FACTS_PATH: &str = ".omnidesk/cache/workspace-facts.json";

fn runtime_state_exists(root: &Path, relative_path: &str) -> bool {
    crate::runtime::state_namespace::state_path_exists(root, relative_path)
}

fn should_skip_governance_dir(name: &str) -> bool {
    matches!(
        name,
        ".project-os"
            | ".omnidesk"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".git"
            | ".next"
            | ".nuxt"
            | ".vite"
            | ".turbo"
            | ".cache"
            | "coverage"
    )
}

fn is_governance_text_file(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if file_name.starts_with(".env") || file_name.ends_with(".lock") {
        return false;
    }
    matches!(
        path.extension().and_then(|value| value.to_str()),
        Some(
            "md" | "mdx"
                | "txt"
                | "json"
                | "jsonc"
                | "yaml"
                | "yml"
                | "toml"
                | "js"
                | "jsx"
                | "ts"
                | "tsx"
                | "css"
                | "scss"
                | "html"
                | "rs"
                | "sh"
                | "py"
                | "sql"
        )
    )
}

fn collect_governance_files(root: &Path) -> Vec<String> {
    const MAX_FILES: usize = 360;
    const MAX_DEPTH: usize = 5;
    let mut files = Vec::new();
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        if files.len() >= MAX_FILES || depth > MAX_DEPTH {
            continue;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                if !should_skip_governance_dir(&name) {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            if !is_governance_text_file(&path) {
                continue;
            }
            let Ok(relative) = path.strip_prefix(root) else {
                continue;
            };
            files.push(relative.to_string_lossy().replace('\\', "/"));
            if files.len() >= MAX_FILES {
                break;
            }
        }
    }
    files.sort();
    files
}

fn push_domain_file(
    domains: &mut HashMap<&'static str, Vec<String>>,
    domain: &'static str,
    file: &str,
) {
    domains.entry(domain).or_default().push(file.to_string());
}

fn classify_governance_file(file: &str, domains: &mut HashMap<&'static str, Vec<String>>) {
    let lower = file.to_lowercase();
    if matches!(file, "PROJECT.md" | "README.md" | "HANDOFF.md")
        || lower.contains("project-profile")
        || lower.ends_with("state.json")
    {
        push_domain_file(domains, "project-identity", file);
    }
    if file == "HANDOFF.md" || lower.contains("goals") || lower.contains("/runs/") {
        push_domain_file(domains, "current-progress", file);
    }
    if lower.ends_with("package.json") || lower.contains("runbook") || lower.contains("readme") {
        push_domain_file(domains, "runbook", file);
    }
    if file == "AGENTS.md"
        || lower.contains("routing")
        || lower.contains("security")
        || lower.contains("lesson")
        || lower.contains("risk")
    {
        push_domain_file(domains, "risk-boundary", file);
    }
    if lower.starts_with(".omnidesk/") {
        push_domain_file(domains, "local-state", file);
    }
    if lower.starts_with("docs/")
        || lower.contains("architecture")
        || lower.contains("design")
        || lower.contains("code_structure")
        || lower.starts_with("schemas/")
    {
        push_domain_file(domains, "design-implementation", file);
    }
    if lower.starts_with("desktop/src") || lower.starts_with("desktop/src-tauri") {
        push_domain_file(domains, "engineering-assets", file);
    }
}

fn domain_files(
    domains: &HashMap<&'static str, Vec<String>>,
    id: &'static str,
    fallback: &[&str],
) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut files = domains
        .get(id)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|file| seen.insert(file.clone()))
        .collect::<Vec<_>>();
    if files.is_empty() {
        files = fallback.iter().map(|value| (*value).to_string()).collect();
    }
    files.truncate(12);
    files
}

/// Returns paths reported by Git without coupling Workspace projection to the
/// Tauri command layer. An unavailable repository remains a valid empty state.
pub fn git_changed_files(root: &Path) -> HashSet<String> {
    let Ok(output) = Command::new("git")
        .arg("-C")
        .arg(root)
        .arg("status")
        .arg("--porcelain")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
    else {
        return HashSet::new();
    };
    if !output.status.success() {
        return HashSet::new();
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let path = line.get(3..)?.trim();
            let path = path.split(" -> ").last().unwrap_or(path);
            (!path.is_empty()).then(|| path.to_string())
        })
        .collect()
}

fn governance_file_status(root: &Path, changed: &HashSet<String>, file: &str) -> &'static str {
    if file.contains('*') || file.ends_with('/') {
        return "ignored";
    }
    if file.starts_with(".omnidesk/evidence/") {
        return "generated";
    }
    if file.starts_with(".omnidesk/") {
        return if runtime_state_exists(root, file) {
            "found"
        } else {
            "missing"
        };
    }
    if changed.contains(file) {
        return "changed";
    }
    if root.join(file).exists() {
        "found"
    } else {
        "missing"
    }
}

fn governance_file_statuses(
    root: &Path,
    changed: &HashSet<String>,
    files: &[String],
) -> Vec<Value> {
    files.iter().map(|file| {
        let status = governance_file_status(root, changed, file);
        json!({ "path": file, "status": status, "previewable": status != "ignored" && root.join(file).is_file() })
    }).collect()
}

fn governance_status_summary(file_statuses: &[Value]) -> Value {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for item in file_statuses {
        let status = item
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("found");
        *counts.entry(status).or_insert(0) += 1;
    }
    json!({
        "found": counts.get("found").copied().unwrap_or(0),
        "missing": counts.get("missing").copied().unwrap_or(0),
        "changed": counts.get("changed").copied().unwrap_or(0),
        "stale": counts.get("stale").copied().unwrap_or(0),
        "generated": counts.get("generated").copied().unwrap_or(0),
        "ignored": counts.get("ignored").copied().unwrap_or(0)
    })
}

fn governance_domain_json(
    root: &Path,
    changed: &HashSet<String>,
    classified: &HashMap<&'static str, Vec<String>>,
    id: &'static str,
    title: &'static str,
    description: &'static str,
    fallback: &[&str],
    updates_when: &'static str,
) -> Value {
    let files = domain_files(classified, id, fallback);
    let file_statuses = governance_file_statuses(root, changed, &files);
    let status_summary = governance_status_summary(&file_statuses);
    json!({
        "id": id, "title": title, "description": description, "files": files,
        "fileStatuses": file_statuses, "statusSummary": status_summary,
        "updatesWhen": updates_when
    })
}

pub fn governance_domains_from_files(root: &Path) -> Vec<Value> {
    let files = collect_governance_files(root);
    let mut classified = HashMap::new();
    for file in &files {
        classify_governance_file(file, &mut classified);
    }
    let changed = git_changed_files(root);
    vec![
        governance_domain_json(
            root,
            &changed,
            &classified,
            "project-identity",
            "项目概览",
            "项目身份、定位、类型和生命周期。",
            &["PROJECT.md", "README.md", PROFILE_PATH, STATE_PATH],
            "项目定位、类型、阶段或工作区状态变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "current-progress",
            "当前进度",
            "最近完成、当前推进和下一步。",
            &["HANDOFF.md", "PROJECT.md", GOALS_PATH, STATE_PATH],
            "目标任务、交接记录或 git 状态变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "runbook",
            "启动方式",
            "启动、构建、验证和常用脚本。",
            &[
                "package.json",
                "desktop/package.json",
                "docs/RUNBOOK.md",
                "desktop/README.md",
            ],
            "package scripts、运行说明或桌面端配置变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "risk-boundary",
            "风险边界",
            "不可随意改动的约束、风险和协作边界。",
            &["HANDOFF.md", "PROJECT.md", PROFILE_PATH],
            "协作规则、风险说明或项目档案变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "local-state",
            "本地状态",
            "Git、本地工作区、Runtime 状态与执行证据。",
            &[STATE_PATH, ".omnidesk/evidence/", REGISTRY_PATH],
            "文件变更、git 状态或 OmniDesk Runtime 状态变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "design-implementation",
            "设计实现",
            "架构、界面规范、数据契约和实现结构。",
            &[
                "docs/ARCHITECTURE.md",
                "docs/DESIGN_STANDARDS.md",
                "schemas/*",
                "desktop/src/*",
            ],
            "架构、设计 token、schema 或源码入口变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "engineering-assets",
            "工程资产",
            "源码、脚本、模板和适配器。",
            &["desktop/src/*", "desktop/src-tauri/*"],
            "桌面源码或 Runtime 文件变化时自动刷新。",
        ),
    ]
}

fn score_from_checks(checks: &[bool]) -> i32 {
    if checks.is_empty() {
        return 0;
    }
    ((checks.iter().filter(|value| **value).count() as f32 / checks.len() as f32) * 100.0).round()
        as i32
}

fn health_status(score: i32) -> &'static str {
    if score >= 85 {
        "healthy"
    } else if score >= 70 {
        "good"
    } else if score >= 50 {
        "watch"
    } else {
        "risk"
    }
}

pub fn build_health_score(
    root: &Path,
    profile: &crate::runtime::workspace::ProjectProfile,
    overview: &str,
    scripts: &str,
    risk_boundary: &str,
    governance_domains: &[Value],
) -> Value {
    let project_identity = score_from_checks(&[
        !overview.trim().is_empty(),
        !profile.phase_summary.trim().is_empty(),
        !profile.architecture_summary.trim().is_empty(),
        runtime_state_exists(root, PROFILE_PATH),
    ]);
    let governed_file_count = governance_domains
        .iter()
        .filter_map(|domain| domain.get("files").and_then(Value::as_array))
        .map(|files| files.len())
        .sum::<usize>();
    let engineering_files = score_from_checks(&[
        governed_file_count >= 8,
        root.join("PROJECT.md").exists() || root.join("README.md").exists(),
        root.join("HANDOFF.md").exists(),
        runtime_state_exists(root, STATE_PATH),
    ]);
    let run_validation = score_from_checks(&[
        !scripts.trim().is_empty(),
        scripts.contains("dev"),
        scripts.contains("build") || !profile.check_commands.trim().is_empty(),
        scripts.contains("test")
            || scripts.contains("lint")
            || !profile.check_commands.trim().is_empty(),
    ]);
    let risk_boundary_score = score_from_checks(&[
        !risk_boundary.trim().is_empty(),
        !profile.collaboration_rules.trim().is_empty(),
        root.join("AGENTS.md").exists(),
        root.join("HANDOFF.md").exists(),
    ]);
    let continuous_governance = score_from_checks(&[
        runtime_state_exists(root, ".omnidesk"),
        runtime_state_exists(root, ".omnidesk/evidence"),
        runtime_state_exists(root, WORKSPACE_FACTS_PATH),
        root.join(".github/workflows").exists() || root.join(".gitlab-ci.yml").exists(),
    ]);
    let dimensions = vec![
        (
            "projectIdentity",
            "项目身份",
            project_identity,
            "项目名、定位、生命周期和项目档案完整度。",
        ),
        (
            "engineeringFiles",
            "工程文件",
            engineering_files,
            "关键文件识别和治理域覆盖情况。",
        ),
        (
            "runValidation",
            "启动验证",
            run_validation,
            "启动、构建、测试或检查命令识别情况。",
        ),
        (
            "riskBoundary",
            "风险边界",
            risk_boundary_score,
            "风险说明、权限边界和协作规则完整度。",
        ),
        (
            "continuousGovernance",
            "持续治理",
            continuous_governance,
            "本地状态、运行记录和 CI/定期扫描入口。",
        ),
    ];
    let total = (dimensions
        .iter()
        .map(|(_, _, score, _)| *score)
        .sum::<i32>() as f32
        / dimensions.len() as f32)
        .round() as i32;
    json!({
        "score": total, "status": health_status(total), "label": format!("{} / 100", total),
        "summary": if total >= 85 { "项目治理基础扎实，可以推进持续治理。" } else if total >= 70 { "项目已具备治理基础，建议补齐关键短板。" } else if total >= 50 { "项目已有部分治理信号，需要继续补齐事实源。" } else { "项目治理信号较弱，建议从只读体检和基础档案开始。" },
        "dimensions": dimensions.into_iter().map(|(id, label, score, reason)| json!({ "id": id, "label": label, "score": score, "status": health_status(score), "reason": reason })).collect::<Vec<_>>()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_workspace_governance_without_runtime_writes() {
        let root = std::env::temp_dir().join(format!("omnidesk-governance-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("desktop/src")).unwrap();
        fs::write(root.join("PROJECT.md"), "project").unwrap();
        fs::write(root.join("HANDOFF.md"), "handoff").unwrap();
        fs::write(root.join("desktop/src/main.jsx"), "export default null").unwrap();
        let domains = governance_domains_from_files(&root);
        assert!(domains
            .iter()
            .any(|domain| domain["id"] == "project-identity"));
        assert!(domains
            .iter()
            .any(|domain| domain["id"] == "engineering-assets"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn health_score_keeps_the_existing_dimension_contract() {
        let root =
            std::env::temp_dir().join(format!("omnidesk-governance-health-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::create_dir_all(root.join(".omnidesk/evidence")).unwrap();
        fs::write(root.join("PROJECT.md"), "project").unwrap();
        fs::write(root.join("HANDOFF.md"), "handoff").unwrap();
        fs::write(root.join("AGENTS.md"), "rules").unwrap();
        fs::write(root.join(STATE_PATH), "{}").unwrap();
        fs::write(root.join(PROFILE_PATH), "{}").unwrap();
        let profile = crate::runtime::workspace::build_project_profile(&root, "fixture");
        let score = build_health_score(
            &root,
            &profile,
            "overview",
            "npm run dev; npm run build; npm test",
            "boundary",
            &governance_domains_from_files(&root),
        );
        assert!(score["score"].as_i64().is_some());
        assert!(score["dimensions"]
            .as_array()
            .is_some_and(|items| items.len() == 5));
        let _ = fs::remove_dir_all(&root);
    }
}

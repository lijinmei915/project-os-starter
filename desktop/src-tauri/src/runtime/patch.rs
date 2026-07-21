use std::collections::{HashMap, HashSet};
use std::path::{Component, Path};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Transport contract for one read-only Patch Draft. Keeping it with the
/// semantic and unified-diff validators prevents the app command layer from
/// becoming the owner of Patch state.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // The standalone patch-normalizer validates diffs but does not construct drafts.
pub struct PatchDraft {
    pub summary: String,
    pub diff: String,
    pub files: Vec<String>,
    #[serde(default)]
    pub allowed_files: Vec<String>,
    #[serde(default)]
    pub context_files: Vec<String>,
    #[serde(default)]
    pub draft_attempt: usize,
    #[serde(default)]
    pub failure_reason: String,
    #[serde(default)]
    pub not_applicable: bool,
    pub guardrails: Vec<String>,
    pub trace: Vec<String>,
}

/// A draft is allowed only when the plan declares a real engineering change
/// and provides at least one authorized source file. This belongs beside diff
/// validation so every draft producer shares the same semantic boundary.
#[allow(dead_code)] // The standalone patch-normalizer binary shares this module but does not create drafts.
pub fn draft_ineligibility_reason(plan: &Value, files: &[String]) -> Option<String> {
    let candidate_changes = plan
        .get("candidateChanges")
        .or_else(|| plan.get("candidate_changes"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if candidate_changes.is_empty() {
        return Some("任务计划没有声明实际工程改动；当前应先讨论、补充计划或运行已登记检查。".to_string());
    }
    let no_write_change = candidate_changes.iter().all(|item| {
        ["先不写文件", "不自动写文件", "不修改文件", "只形成", "形成下一步建议", "运行检查", "执行检查"]
            .iter()
            .any(|marker| item.contains(marker))
    });
    if no_write_change {
        return Some("任务计划明确不修改工程文件；当前应先运行检查或查看建议，不生成 Patch。".to_string());
    }
    if files.is_empty() {
        return Some("任务计划没有提供可读取且已授权的工程文件；请先补充具体文件范围，再生成 Patch。".to_string());
    }
    None
}

fn is_patch_context_path(path: &str) -> bool {
    !path.starts_with('/')
        && !path.contains("..")
        && !path.starts_with(".env")
        && !path.contains("/.env")
        && !path.contains(".omnidesk/desktop-provider")
}

pub fn normalize_hermes_unified_diff(
    output: &str,
    contexts: &[(String, String)],
) -> Result<String, String> {
    // Only remove standalone response fences. Markdown code fences inside the patch are content.
    let normalized = output
        .lines()
        .filter(|line| !matches!(*line, "```diff" | "```patch" | "```"))
        .collect::<Vec<_>>()
        .join("\n");
    let start = normalized
        .find("--- ")
        .ok_or_else(|| "Hermes 未返回 unified diff".to_string())?;
    let diff = normalized[start..].trim().to_string() + "\n";
    if !diff.contains("@@") || !diff.contains("+++ ") {
        return Err("Hermes 返回内容不是可审阅的 unified diff".to_string());
    }
    let allowed = contexts
        .iter()
        .map(|(path, _)| path.as_str())
        .collect::<HashSet<_>>();
    let files = hermes_diff_header_paths(&diff)?;
    if files.is_empty() || files.iter().any(|path| !allowed.contains(path.as_str())) {
        return Err("Hermes diff 包含未授权的文件，已拒绝草案".to_string());
    }
    normalize_hermes_unified_hunks(&diff, contexts)
}

/// Verify that a unified diff is confined to the files the draft was allowed
/// to inspect. Applying a draft must not trust UI metadata alone.
#[allow(dead_code)] // The standalone patch-normalizer binary shares this module but does not apply drafts.
pub fn validate_unified_diff_authorized(diff: &str, allowed_files: &[String]) -> Result<(), String> {
    let allowed = allowed_files
        .iter()
        .map(|path| path.as_str())
        .collect::<HashSet<_>>();
    if allowed.is_empty() {
        return Err("Patch 草案没有授权文件，不能应用。".to_string());
    }
    let files = hermes_diff_header_paths(diff)?;
    if files.is_empty() || files.iter().any(|path| !allowed.contains(path.as_str())) {
        return Err("Patch 草案包含授权范围之外的文件。".to_string());
    }
    Ok(())
}

/// Native Patch application cannot trust a WebView or provider boundary for
/// path validation. Keep this check with the diff parser so every caller uses
/// the same escape and environment-file rules.
#[allow(dead_code)] // The standalone patch-normalizer does not apply diffs.
pub fn validate_apply_diff_paths(diff: &str) -> Result<(), String> {
    let headers = diff
        .lines()
        .filter(|line| line.starts_with("--- ") || line.starts_with("+++ "))
        .collect::<Vec<_>>();
    if headers.len() < 2 || headers.len() % 2 != 0 {
        return Err("patch 草案缺少完整的文件头。".to_string());
    }
    for header in headers {
        let path = header[4..].split('\t').next().unwrap_or("").trim();
        validate_apply_path(path)?;
    }
    Ok(())
}

#[allow(dead_code)] // Called only by the native Patch application validator.
fn validate_apply_path(path: &str) -> Result<(), String> {
    if path == "/dev/null" {
        return Ok(());
    }
    let relative = path.strip_prefix("a/").or_else(|| path.strip_prefix("b/")).unwrap_or(path);
    let candidate = Path::new(relative);
    if relative.is_empty()
        || candidate.is_absolute()
        || candidate.components().any(|component| matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err("patch 不允许访问项目目录之外的路径。".to_string());
    }
    if candidate.components().any(|component| component.as_os_str().to_string_lossy().starts_with(".env")) {
        return Err("patch 不允许修改受保护的环境文件。".to_string());
    }
    Ok(())
}

#[allow(dead_code)] // The standalone patch-normalizer returns normalized diff text only.
pub fn files_from_unified_diff(diff: &str) -> Vec<String> {
    let mut files = diff
        .lines()
        .filter_map(|line| line.strip_prefix("+++ "))
        .filter_map(|path| {
            let path = path.trim().trim_start_matches("b/");
            (path != "/dev/null" && is_patch_context_path(path)).then(|| path.to_string())
        })
        .collect::<Vec<_>>();
    files.sort();
    files.dedup();
    files
}
fn hermes_diff_header_paths(diff: &str) -> Result<Vec<String>, String> {
    let lines = diff.lines().collect::<Vec<_>>();
    let mut files = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        if !lines[index].starts_with("--- ") {
            index += 1;
            continue;
        }
        let old = unified_diff_header_path(lines[index], "--- ", "a/")?;
        let new_line = lines
            .get(index + 1)
            .ok_or_else(|| "Hermes diff 缺少 +++ 文件头".to_string())?;
        let new = unified_diff_header_path(new_line, "+++ ", "b/")?;
        if old != new || !is_patch_context_path(&new) {
            return Err("Hermes diff 包含不安全或不一致的文件头".to_string());
        }
        files.push(new);
        index += 2;
    }
    files.sort();
    files.dedup();
    Ok(files)
}

fn unified_diff_header_path(
    line: &str,
    prefix: &str,
    expected_prefix: &str,
) -> Result<String, String> {
    let raw = line
        .strip_prefix(prefix)
        .and_then(|value| value.split_whitespace().next())
        .ok_or_else(|| "Hermes diff 文件头格式无效".to_string())?;
    let path = raw.strip_prefix(expected_prefix).unwrap_or(raw);
    if path.is_empty() || path == "/dev/null" {
        return Err("Hermes diff 不支持新增或删除文件".to_string());
    }
    Ok(path.to_string())
}

fn normalize_hermes_unified_hunks(
    diff: &str,
    contexts: &[(String, String)],
) -> Result<String, String> {
    let lines = diff.lines().collect::<Vec<_>>();
    let source_by_path = contexts
        .iter()
        .map(|(path, content)| (path.as_str(), content.as_str()))
        .collect::<HashMap<_, _>>();
    let mut normalized = Vec::with_capacity(lines.len());
    let mut index = 0;
    let mut current_path: Option<String> = None;
    let mut line_offset = 0isize;
    while index < lines.len() {
        let line = lines[index];
        if is_hermes_file_header_at(&lines, index) {
            let path = unified_diff_header_path(lines[index + 1], "+++ ", "b/")?;
            current_path = Some(path);
            line_offset = 0;
            let path = current_path.as_deref().unwrap_or_default();
            normalized.push(format!("--- a/{path}"));
            normalized.push(format!("+++ b/{path}"));
            index += 2;
            continue;
        }
        if !line.starts_with("@@") {
            normalized.push(line.to_string());
            index += 1;
            continue;
        }

        let (old_start, declared_old_count, new_start, declared_new_count, suffix) =
            parse_unified_hunk_header(line)?;
        let mut old_count = 0usize;
        let mut new_count = 0usize;
        let mut body = Vec::new();
        let mut old_body = Vec::new();
        index += 1;
        while index < lines.len()
            && !lines[index].starts_with("@@")
            && !is_hermes_file_header_at(&lines, index)
        {
            let body_line = lines[index];
            match body_line.as_bytes().first() {
                Some(b' ') => {
                    old_count += 1;
                    new_count += 1;
                    old_body.push(&body_line[1..]);
                }
                Some(b'-') => {
                    old_count += 1;
                    old_body.push(&body_line[1..]);
                }
                Some(b'+') => new_count += 1,
                Some(b'\\') => {}
                _ => return Err("Hermes diff hunk 内容格式无效，未自动修复".to_string()),
            }
            body.push(body_line.to_string());
            index += 1;
        }
        let source = current_path
            .as_deref()
            .and_then(|path| source_by_path.get(path).copied())
            .ok_or_else(|| "Hermes diff 未绑定已授权的上下文文件".to_string())?;
        if old_body.is_empty() {
            return Err("Hermes diff 缺少原文件上下文，未创建草案".to_string());
        }
        let matched_old_start = unique_hunk_old_start(source, &old_body);
        if !old_body.is_empty() && matched_old_start.is_none() {
            return Err("Hermes diff 上下文与授权文件不匹配，未创建草案".to_string());
        }
        let mut effective_old_start = matched_old_start.unwrap_or(old_start);
        let has_context = body.iter().any(|line| line.starts_with(' '));
        if !has_context {
            if let Some(matched_start) = matched_old_start {
                let source_lines = source.lines().collect::<Vec<_>>();
                let first = matched_start - 1;
                let last = first + old_body.len();
                if first > 0 {
                    body.insert(0, format!(" {}", source_lines[first - 1]));
                    old_count += 1;
                    new_count += 1;
                    effective_old_start -= 1;
                }
                if let Some(next) = source_lines.get(last) {
                    body.push(format!(" {next}"));
                    old_count += 1;
                    new_count += 1;
                }
            }
        }
        let effective_new_start = if matched_old_start.is_some() {
            effective_old_start.saturating_add_signed(line_offset)
        } else {
            new_start
        };
        if effective_old_start == old_start
            && effective_new_start == new_start
            && old_count == declared_old_count
            && new_count == declared_new_count
        {
            normalized.push(line.to_string());
        } else {
            normalized.push(format!(
                "@@ -{} +{} @@{}",
                format_unified_hunk_range(effective_old_start, old_count),
                format_unified_hunk_range(effective_new_start, new_count),
                suffix
            ));
        }
        line_offset += new_count as isize - old_count as isize;
        normalized.extend(body);
    }
    Ok(normalized.join("\n") + "\n")
}

fn format_unified_hunk_range(start: usize, count: usize) -> String {
    if count == 1 {
        start.to_string()
    } else {
        format!("{start},{count}")
    }
}

fn unique_hunk_old_start(source: &str, old_body: &[&str]) -> Option<usize> {
    if old_body.is_empty() {
        return None;
    }
    let source_lines = source.lines().collect::<Vec<_>>();
    let starts = source_lines
        .windows(old_body.len())
        .enumerate()
        .filter_map(|(index, window)| (window == old_body).then_some(index + 1))
        .collect::<Vec<_>>();
    (starts.len() == 1).then(|| starts[0])
}

fn is_hermes_file_header_at(lines: &[&str], index: usize) -> bool {
    let Some(old) = lines.get(index) else {
        return false;
    };
    let Some(new) = lines.get(index + 1) else {
        return false;
    };
    old.starts_with("--- ") && new.starts_with("+++ ")
}

fn parse_unified_hunk_header(line: &str) -> Result<(usize, usize, usize, usize, String), String> {
    let body = line
        .strip_prefix("@@ ")
        .ok_or_else(|| "Hermes diff hunk 头格式无效".to_string())?;
    let (ranges, suffix) = body
        .split_once(" @@")
        .ok_or_else(|| "Hermes diff hunk 头格式无效".to_string())?;
    let mut parts = ranges.split_whitespace();
    let old = parts
        .next()
        .ok_or_else(|| "Hermes diff hunk 缺少旧范围".to_string())?;
    let new = parts
        .next()
        .ok_or_else(|| "Hermes diff hunk 缺少新范围".to_string())?;
    if parts.next().is_some() {
        return Err("Hermes diff hunk 头格式无效".to_string());
    }
    let (old_start, old_count) = parse_unified_hunk_range(old, '-')?;
    let (new_start, new_count) = parse_unified_hunk_range(new, '+')?;
    Ok((
        old_start,
        old_count,
        new_start,
        new_count,
        suffix.to_string(),
    ))
}

fn parse_unified_hunk_range(value: &str, prefix: char) -> Result<(usize, usize), String> {
    let range = value
        .strip_prefix(prefix)
        .ok_or_else(|| "Hermes diff hunk 范围格式无效".to_string())?;
    let (start, count) = match range.split_once(',') {
        Some((start, count)) => (start, count),
        None => (range, "1"),
    };
    let start = start
        .parse::<usize>()
        .map_err(|_| "Hermes diff hunk 范围格式无效".to_string())?;
    let count = count
        .parse::<usize>()
        .map_err(|_| "Hermes diff hunk 范围格式无效".to_string())?;
    Ok((start, count))
}

#[cfg(test)]
mod tests {
    use super::{draft_ineligibility_reason, normalize_hermes_unified_diff};
    use serde_json::json;

    #[test]
    fn rejects_validation_only_or_unscoped_draft_plans() {
        let validation = json!({ "candidateChanges": ["先不写文件，只形成下一步建议。"] });
        assert!(draft_ineligibility_reason(&validation, &["src/app.ts".to_string()]).is_some());
        let change = json!({ "candidateChanges": ["调整状态提示"] });
        assert!(draft_ineligibility_reason(&change, &[]).is_some());
        assert_eq!(draft_ineligibility_reason(&change, &["src/app.ts".to_string()]), None);
    }

    #[test]
    fn rejects_incomplete_hunk_headers_before_a_patch_can_reach_approval() {
        let context = vec![("README.md".to_string(), "old\n".to_string())];
        let diff = "--- a/README.md\n+++ b/README.md\n@@\n-old\n+new\n";

        assert!(normalize_hermes_unified_diff(diff, &context).is_err());
    }

    #[test]
    fn rejects_diff_files_outside_the_explicit_authorization_set() {
        let diff = "--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n";
        assert!(super::validate_unified_diff_authorized(diff, &["README.md".to_string()]).is_ok());
        assert!(super::validate_unified_diff_authorized(diff, &["src/app.js".to_string()]).is_err());
        assert!(super::validate_unified_diff_authorized(diff, &[]).is_err());
    }

    #[test]
    fn rejects_non_matching_context_without_panicking() {
        let context = vec![(
            "schema.json".to_string(),
            "{\n  \"title\": \"value\"\n}\n".to_string(),
        )];
        let diff = "--- a/schema.json\n+++ b/schema.json\n@@ -1,3 +1,5 @@\n {\n   \"title\": {\n+    \"description\": \"value\"\n   }\n }\n";

        assert!(normalize_hermes_unified_diff(diff, &context).is_err());
    }

    #[test]
    fn rejects_add_only_hunks_without_file_context() {
        let context = vec![(
            "state.test.mjs".to_string(),
            "test(\"existing\", () => {});\n".to_string(),
        )];
        let diff = "--- a/state.test.mjs\n+++ b/state.test.mjs\n@@ -1,0 +1,2 @@\n+test(\"new\", () => {});\n+\n";

        assert!(normalize_hermes_unified_diff(diff, &context).is_err());
    }
}

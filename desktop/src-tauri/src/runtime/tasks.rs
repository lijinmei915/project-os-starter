use crate::runtime::repository::{JsonMutation, Repository};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const TASK_SCHEMA_VERSION: &str = "omnidesk.desktop-task.v0.1";
const LEGACY_TASK_SCHEMA_VERSION: &str = "project-os.desktop-task.v0.1";
const TASK_DIRECTORY: &str = ".omnidesk/data/tasks";
const CONVERSATION_DIRECTORY: &str = ".omnidesk/data/conversations";
const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const BACKLOG_PATH: &str = ".omnidesk/data/task-backlog.json";

pub fn directory(root: &Path) -> std::path::PathBuf {
    crate::runtime::state_namespace::state_path_for_read(root, TASK_DIRECTORY)
        .unwrap_or_else(|_| root.join(TASK_DIRECTORY))
}

pub fn list_repository_records(repository: &Repository) -> Result<Vec<(String, Value)>, String> {
    Ok(repository
        .list_json_records(TASK_DIRECTORY)?
        .into_iter()
        .filter(|(relative, _)| !relative.ends_with("/manifest.json"))
        .collect())
}

/// Query-side task service. Mutation migration follows separately because it
/// also owns goal indexes, linked conversations, and backlog cleanup.
pub fn list(root: &Path) -> Result<Vec<Value>, String> {
    let mut tasks = list_repository_records(&Repository::new(root))?
        .into_iter()
        .map(|(_, task)| {
            project_confirmation_title(project_legacy_execution_state(project_task_schema(task)))
        })
        .collect::<Vec<_>>();
    tasks.sort_by(|a, b| {
        let a_time = a
            .get("updatedAt")
            .and_then(Value::as_str)
            .or_else(|| a.get("createdAt").and_then(Value::as_str))
            .unwrap_or("");
        let b_time = b
            .get("updatedAt")
            .and_then(Value::as_str)
            .or_else(|| b.get("createdAt").and_then(Value::as_str))
            .unwrap_or("");
        b_time.cmp(a_time)
    });
    Ok(project_check_results(root, tasks))
}

/// Only the latest check batch can prove the current task version. This is a
/// read projection: original runs and historical results remain untouched.
fn project_check_results(root: &Path, mut tasks: Vec<Value>) -> Vec<Value> {
    let has_checks = tasks.iter().any(|task| task["executionEvidence"].as_array()
        .is_some_and(|items| items.iter().any(|item| item["kind"] == "check")));
    let current = has_checks.then(|| crate::runtime::validation_revision::capture(root)).and_then(Result::ok);
    for task in &mut tasks {
        if task.pointer("/manualPatchApply/status").and_then(Value::as_str) == Some("applying")
            && task.pointer("/manualPatchApply/processId").and_then(Value::as_u64) != Some(u64::from(std::process::id())) {
            task["status"] = Value::String("interrupted".to_string());
            task["verificationSummary"] = Value::String("上次手动改动执行中断，结果尚待核对；请先查看文件，不能自动重放。".to_string());
        }
        if task.pointer("/manualPatchApply/status").and_then(Value::as_str) == Some("applying") {
            task["verificationFreshness"] = serde_json::json!({"status":"pending","reason":"改动执行结果尚待核对，旧检查不能证明本次改动。"});
            continue;
        }
        let evidence = task["executionEvidence"].as_array();
        let last_apply = evidence.and_then(|items| items.iter().rposition(|item| item["kind"] == "apply" && item["status"] == "succeeded"));
        let last_check = evidence.and_then(|items| items.iter().rposition(|item| item["kind"] == "check"));
        if last_apply.is_some_and(|applied| last_check.is_none_or(|checked| checked < applied)) {
            task["verificationFreshness"] = serde_json::json!({"status":"pending","reason":"最近一次改动后尚未检查，请单独确认运行检查。"});
            continue;
        }
        let latest = task["executionEvidence"].as_array().and_then(|items|
            items.iter().rev().find(|item| item["kind"] == "check"));
        let Some(latest) = latest else {
            if let Some(object) = task.as_object_mut() { object.remove("verificationFreshness"); }
            continue;
        };
        let (status, reason) = if latest["status"] != "succeeded" {
            ("failed", "最近一次检查未通过。")
        } else if let Some(runs) = latest.pointer("/details/runs").and_then(Value::as_array)
            .filter(|runs| !runs.is_empty()) {
            if runs.iter().any(|run| run.get("inputBinding").is_none_or(Value::is_null)) {
                ("unbound", "历史检查未记录代码版本，请重新检查。")
            } else if let Some(current) = current.as_ref() {
                if runs.iter().all(|run| run["success"] == true
                    && run.pointer("/freshness/status").and_then(Value::as_str) == Some("fresh")
                    && run.get("inputBinding") == Some(current)) {
                    ("fresh", "检查结果对应当前源码与验收标准。")
                } else {
                    ("stale", "源码、验收标准或检查批次版本已变化，请重新检查。")
                }
            } else {
                ("unavailable", "无法核对当前代码版本，请重新检查。")
            }
        } else {
            ("unbound", "历史检查未记录代码版本，请重新检查。")
        };
        task["verificationFreshness"] = serde_json::json!({"status":status,"reason":reason});
    }
    tasks
}

fn project_confirmation_title(mut task: Value) -> Value {
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .trim_matches(&['。', '！', '!', '，', ',', ' '][..])
        .to_string();
    if ![
        "好",
        "好的",
        "可以",
        "行",
        "继续",
        "开始",
        "执行",
        "就这样",
        "按这个来",
    ]
    .contains(&title.as_str())
    {
        return task;
    }
    let replacement = task
        .pointer("/plan/task")
        .and_then(Value::as_str)
        .or_else(|| task.pointer("/plan/summary").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty() && !["好", "好的", "可以", "行", "继续"].contains(value))
        .map(str::to_string);
    let Some(replacement) = replacement else {
        return task;
    };
    let Some(object) = task.as_object_mut() else {
        return task;
    };
    object.insert("title".to_string(), Value::String(replacement));
    object.insert(
        "runtimeMigration".to_string(),
        serde_json::json!({
            "fromTitle": title,
            "reason": "历史确认词标题已按现有计划摘要恢复。",
            "version": "confirmation-title-v1"
        }),
    );
    task
}

// Reading legacy records is non-destructive. The next explicit task write
// persists the OmniDesk identity through save(), while list() remains able to
// project existing user history without a bulk rewrite.
fn project_task_schema(mut task: Value) -> Value {
    if task.get("schemaVersion").and_then(Value::as_str) != Some(LEGACY_TASK_SCHEMA_VERSION) {
        return task;
    }
    let Some(object) = task.as_object_mut() else {
        return task;
    };
    object.insert(
        "schemaVersion".to_string(),
        Value::String(TASK_SCHEMA_VERSION.to_string()),
    );
    object.insert(
        "schemaMigration".to_string(),
        serde_json::json!({
            "from": LEGACY_TASK_SCHEMA_VERSION,
            "mode": "read-projection",
            "to": TASK_SCHEMA_VERSION,
        }),
    );
    task
}

/// Old desktop records can contain a syntactically valid placeholder diff for
/// a plan that explicitly said not to modify files. Keep the stored artifact
/// untouched, but project it as non-applicable so it cannot appear as a live
/// approval after an upgrade.
fn project_legacy_execution_state(mut task: Value) -> Value {
    if task.get("status").and_then(Value::as_str) != Some("waiting approval")
        || task
            .pointer("/patchDraft/notApplicable")
            .and_then(Value::as_bool)
            == Some(true)
        || !legacy_plan_is_validation_only(&task)
    {
        return task;
    }
    let Some(object) = task.as_object_mut() else {
        return task;
    };
    object.insert("status".to_string(), Value::String("planned".to_string()));
    object.insert(
        "runtimeMigration".to_string(),
        serde_json::json!({
            "fromStatus": "waiting approval",
            "reason": "历史计划未声明实际工程改动，旧草稿不再可应用。",
            "version": "semantic-patch-gate-v1"
        }),
    );
    if let Some(draft) = object.get_mut("patchDraft").and_then(Value::as_object_mut) {
        draft.insert("notApplicable".to_string(), Value::Bool(true));
        draft.insert(
            "failureReason".to_string(),
            Value::String("历史计划明确不修改工程文件；该草稿仅保留为证据，不能应用。".to_string()),
        );
    }
    task
}

fn legacy_plan_is_validation_only(task: &Value) -> bool {
    let Some(changes) = task
        .pointer("/plan/candidateChanges")
        .or_else(|| task.pointer("/plan/candidate_changes"))
        .and_then(Value::as_array)
    else {
        return false;
    };
    !changes.is_empty()
        && changes.iter().filter_map(Value::as_str).all(|change| {
            [
                "先不写文件",
                "先不改文件",
                "不自动写文件",
                "不修改文件",
                "只形成",
            ]
            .iter()
            .any(|marker| change.contains(marker))
        })
}

/// Persists a desktop task and synchronizes its goal index as one Repository
/// transaction. Duplicate creation and repeated client requests return the
/// already-persisted task without creating a second state record.
pub fn save(
    root: &Path,
    project_path: &str,
    mut task: Value,
    timestamp: &str,
) -> Result<Value, String> {
    let task_dir = directory(root);
    fs::create_dir_all(&task_dir).map_err(|err| err.to_string())?;
    recover_storage(&task_dir)?;
    if let Some(object) = task.as_object_mut() { object.remove("verificationFreshness"); }
    let saved = Repository::new(root).transaction_with("save-desktop-task", |repository| {
        let id = task
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "任务缺少 id".to_string())?
            .to_string();
        let task_relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(&id));
        let existing = repository.read_json(&task_relative);
        if let Some(existing) = existing.as_ref() {
            if existing.pointer("/manualPatchApply/status").and_then(Value::as_str) == Some("applying") {
                return Err("手动改动正在执行或结果尚待核对，不能覆盖任务或重复应用。".to_string());
            }
            if let Some(operation) = existing.get("manualPatchApply") {
                if task.get("manualPatchApply") != Some(operation) {
                    return Err("手动改动执行记录已更新，请重新打开任务后再保存。".to_string());
                }
                task["manualPatchApply"] = operation.clone();
            } else if let Some(object) = task.as_object_mut() {
                object.remove("manualPatchApply");
            }
        } else if let Some(object) = task.as_object_mut() {
            object.remove("manualPatchApply");
        }
        let is_new = existing.is_none();
        if is_new {
            let title = normalized_title(&task);
            let goal_id = task.get("goalId").and_then(Value::as_str).unwrap_or("");
            if !title.is_empty() && is_open(&task) {
                for (_, existing) in list_repository_records(repository)? {
                    if is_open(&existing)
                        && existing.get("goalId").and_then(Value::as_str).unwrap_or("") == goal_id
                        && normalized_title(&existing) == title
                    {
                        let mut result = existing;
                        if let Some(object) = result.as_object_mut() {
                            object.insert("deduplicated".to_string(), Value::Bool(true));
                        }
                        return Ok((result, Vec::new()));
                    }
                }
            }
        }
        if let Some(request_id) = task
            .get("requestId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            for (_, existing) in list_repository_records(repository)? {
                if existing
                    .get("requestId")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    == Some(request_id)
                    && existing.get("id").and_then(Value::as_str) != Some(id.as_str())
                {
                    return Ok((existing, Vec::new()));
                }
            }
        }
        let object = task
            .as_object_mut()
            .ok_or_else(|| "任务记录必须是 JSON object".to_string())?;
        object.insert(
            "schemaVersion".to_string(),
            Value::String(TASK_SCHEMA_VERSION.to_string()),
        );
        object.remove("schemaMigration");
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        object.insert(
            "projectPath".to_string(),
            Value::String(project_path.to_string()),
        );
        mark_persisted(&mut task, &id, timestamp);
        let mut mutations = vec![JsonMutation::upsert(task_relative, task.clone())];
        let goal_id = task.get("goalId").and_then(Value::as_str).unwrap_or("");
        if let Some(mut goals) = repository.read_json(GOALS_PATH) {
            crate::runtime::goals::rebind_task(&mut goals, &id, goal_id, timestamp);
            mutations.push(JsonMutation::upsert(GOALS_PATH, goals));
        }
        Ok((task, mutations))
    })?;
    Ok(project_check_results(root, vec![saved]).remove(0))
}

/// Reserve exactly the persisted snapshot the user reviewed. The claim is
/// committed before touching source, so a crash never permits implicit replay.
fn claim_reviewed_patch(root: &Path, reviewed: &Value, timestamp: &str) -> Result<Value, String> {
    let id = reviewed.get("id").and_then(Value::as_str).filter(|id| !id.trim().is_empty())
        .ok_or_else(|| "缺少已审阅的任务编号。".to_string())?;
    let relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(id));
    let canonical_root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    Repository::new(root).transaction_with("claim-reviewed-manual-patch", |repository| {
        let mut task = repository.read_json(&relative).ok_or_else(|| "任务尚未保存，请重新打开并审阅草稿。".to_string())?;
        if task.get("id").and_then(Value::as_str) != Some(id) {
            return Err("任务编号与已保存记录不一致。".to_string());
        }
        for snapshot in [&task, reviewed] {
            let path = snapshot.get("projectPath").and_then(Value::as_str)
                .ok_or_else(|| "草稿缺少工程绑定，请重新保存并审阅。".to_string())?;
            if fs::canonicalize(path).ok().as_ref() != Some(&canonical_root) {
                return Err("工程已切换，不能应用另一工程的草稿。".to_string());
            }
        }
        if task.pointer("/manualPatchApply/status").and_then(Value::as_str) == Some("applying") {
            return Err("手动改动正在执行或上次结果尚待核对，不能重复应用。".to_string());
        }
        for field in ["patchDraft", "updatedAt", "status", "executionEvidence", "manualPatchApply"] {
            if task.get(field) != reviewed.get(field) {
                return Err("草稿或任务已更新，请重新查看改动后再确认。".to_string());
            }
        }
        if !matches!(task.get("status").and_then(Value::as_str), Some("waiting approval" | "waiting repair approval")) {
            return Err("当前任务不在手动改动待确认阶段。".to_string());
        }
        let draft = task.get("patchDraft").filter(|draft| draft.is_object())
            .ok_or_else(|| "任务没有已保存的改动草稿。".to_string())?;
        if task.get("executionEvidence").is_some_and(|evidence| !evidence.is_array()) {
            return Err("任务证据格式无效，请先核对记录。".to_string());
        }
        let fingerprint = format!("{:x}", Sha256::digest(serde_json::to_vec(draft).map_err(|error|error.to_string())?));
        if task.pointer("/manualPatchApply/status").and_then(Value::as_str) == Some("applied")
            && task.pointer("/manualPatchApply/fingerprint").and_then(Value::as_str) == Some(&fingerprint) {
            return Err("这份草稿已经应用，不能重复执行。".to_string());
        }
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        task["manualPatchApply"] = serde_json::json!({"status":"applying","fingerprint":fingerprint,
            "token":format!("manual-patch-{}-{nonce}", std::process::id()),"startedAt":timestamp,"processId":std::process::id()});
        task["status"] = Value::String("applying manual patch".to_string());
        task["updatedAt"] = Value::String(timestamp.to_string());
        Ok((task.clone(), vec![JsonMutation::upsert(relative.clone(), task)]))
    })
}

pub fn apply_reviewed_patch(root: &Path, reviewed: &Value, timestamp: &str) -> Result<Value, String> {
    let _lease = manual_patch_lease(root, reviewed)?;
    let claimed = claim_reviewed_patch(root, reviewed, timestamp)?;
    // Source execution and audit own their transactions; never nest them
    // inside the task Repository lock.
    let applied = crate::runtime::execution::apply_patch_draft(root, &claimed["patchDraft"], timestamp);
    let result = match &applied {
        Ok(result) => serde_json::to_value(result).map_err(|error|error.to_string())?,
        Err(error) => serde_json::json!({"success":false,"message":error}),
    };
    let id = claimed["id"].as_str().unwrap();
    let relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(id));
    let finalized = Repository::new(root).transaction_with("finish-reviewed-manual-patch", |repository| {
        let mut task = repository.read_json(&relative).ok_or_else(||"执行记录已丢失。".to_string())?;
        if task["manualPatchApply"] != claimed["manualPatchApply"] {
            return Err("执行记录已变化，禁止覆盖。".to_string());
        }
        task["manualPatchApply"]["status"] = Value::String(if applied.is_ok() {"applied"} else {"failed"}.to_string());
        task["manualPatchApply"]["finishedAt"] = Value::String(timestamp.to_string());
        task["applyResult"] = result.clone();
        task["applyResult"]["finishedAt"] = Value::String(timestamp.to_string());
        task["updatedAt"] = Value::String(timestamp.to_string());
        task["status"] = Value::String(if applied.is_ok() {"waiting verification"} else {"failed"}.to_string());
        task["verificationSummary"] = Value::String(if applied.is_ok() {"改动已应用，等待单独确认运行检查。"} else {"改动未能应用，请核对失败证据。"}.to_string());
        if task.get("executionEvidence").is_none() { task["executionEvidence"] = serde_json::json!([]); }
        task["executionEvidence"].as_array_mut().ok_or_else(||"任务证据格式无效。".to_string())?.push(serde_json::json!({
            "at":timestamp,"kind":"apply","status":if applied.is_ok(){"succeeded"}else{"failed"},
            "summary":if applied.is_ok(){"已应用审阅版本，等待独立检查。"}else{"已审阅改动未能应用。"},"details":result
        }));
        Ok((task.clone(),vec![JsonMutation::upsert(relative.clone(),task)]))
    });
    match finalized {
        Ok(task) => {
            let mut response = result;
            response["task"] = project_check_results(root,vec![task]).remove(0);
            Ok(response)
        }
        Err(error) => Ok(serde_json::json!({"success":applied.is_ok(),"recordPending":true,
            "message":format!("改动执行结果未能保存，请核对文件；禁止重复应用：{error}"),"output":""})),
    }
}

fn manual_patch_lease(root: &Path, task: &Value) -> Result<crate::runtime::repository::RepositoryLock, String> {
    let id = task["id"].as_str().filter(|id| !id.is_empty()).ok_or("缺少任务编号。")?;
    let name = format!("manual-patch-{:x}.lock", Sha256::digest(id.as_bytes()));
    crate::runtime::repository::RepositoryLock::acquire_named(root, &name)
        .map_err(|error| format!("改动仍在处理，暂不能核对或再次应用：{error}"))
}

fn unresolved_manual_task(root: &Path, repository: &Repository, reviewed: &Value) -> Result<(String, Value), String> {
    let id = reviewed["id"].as_str().filter(|id| !id.is_empty()).ok_or("缺少任务编号。")?;
    let relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(id));
    let task = repository.read_json(&relative).ok_or("找不到中断记录，请刷新任务。")?;
    let canonical = fs::canonicalize(root).map_err(|error|error.to_string())?;
    for snapshot in [&task, reviewed] {
        if snapshot["id"] != id || snapshot["projectPath"].as_str()
            .and_then(|path|fs::canonicalize(path).ok()).as_ref() != Some(&canonical) {
            return Err("工程已切换，请重新打开当前工程的任务。".to_string());
        }
    }
    for field in ["patchDraft", "updatedAt", "executionEvidence", "manualPatchApply"] {
        if task.get(field) != reviewed.get(field) {
            return Err("执行记录已更新，请重新核对文件。".to_string());
        }
    }
    if task.pointer("/manualPatchApply/status").and_then(Value::as_str) != Some("applying") {
        return Err("当前没有待核对的中断改动。".to_string());
    }
    let fingerprint = format!("{:x}", Sha256::digest(serde_json::to_vec(&task["patchDraft"]).map_err(|error|error.to_string())?));
    if task.pointer("/manualPatchApply/fingerprint").and_then(Value::as_str) != Some(&fingerprint)
        || task.pointer("/manualPatchApply/token").and_then(Value::as_str).is_none_or(str::is_empty)
        || task.get("executionEvidence").is_some_and(|items| !items.is_array()) {
        return Err("中断记录与草稿不一致，已保留记录，请人工检查文件。".to_string());
    }
    Ok((relative, task))
}

/// A persisted observation is reviewed separately from confirming recovery.
/// The source-operation lease excludes a still-running apply, even in another process.
pub fn inspect_interrupted_patch(root: &Path, reviewed: &Value, timestamp: &str) -> Result<Value, String> {
    let _lease = manual_patch_lease(root, reviewed)?;
    let repository = Repository::new(root);
    let (_, task) = unresolved_manual_task(root, &repository, reviewed)?;
    let binding = crate::runtime::validation_revision::capture(root)?;
    let inspection = crate::runtime::execution::inspect_patch_draft(root, &task["patchDraft"])?;
    if crate::runtime::validation_revision::capture(root)? != binding {
        return Err("核对期间文件发生变化，请重新核对。".to_string());
    }
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let observation = serde_json::json!({"reviewToken":format!("reconcile-{}-{nonce}",std::process::id()),
        "operationToken":task["manualPatchApply"]["token"],"inputBinding":binding,
        "state":inspection["state"],"forwardCheck":inspection["forwardCheck"],
        "reverseCheck":inspection["reverseCheck"],"checkedAt":timestamp});
    let saved = repository.transaction_with("inspect-interrupted-manual-patch", |repository| {
        let (relative, mut current) = unresolved_manual_task(root, repository, reviewed)?;
        if crate::runtime::validation_revision::capture(root)? != binding {
            return Err("文件已变化，请重新核对。".to_string());
        }
        current["manualPatchApply"]["reconciliation"] = observation.clone();
        Ok((current.clone(),vec![JsonMutation::upsert(relative,current)]))
    })?;
    Ok(serde_json::json!({"observation":observation,"task":project_check_results(root,vec![saved]).remove(0)}))
}

/// Only closes the persisted claim. Never reapplies a Patch or runs checks.
pub fn confirm_interrupted_patch(root: &Path, reviewed: &Value, observation: &Value, timestamp: &str) -> Result<Value, String> {
    let _lease = manual_patch_lease(root, reviewed)?;
    let repository = Repository::new(root);
    let (_, task) = unresolved_manual_task(root, &repository, reviewed)?;
    if task.pointer("/manualPatchApply/reconciliation") != Some(observation)
        || observation["operationToken"] != task["manualPatchApply"]["token"] {
        return Err("核对记录已更新，请重新核对后确认。".to_string());
    }
    let state = observation["state"].as_str().unwrap_or("");
    if !matches!(state,"applied"|"not-applied") {
        return Err("文件状态无法确定，已保留中断记录；请人工检查差异后再核对。".to_string());
    }
    if crate::runtime::validation_revision::capture(root)? != observation["inputBinding"] {
        return Err("核对后文件已变化，请重新核对。".to_string());
    }
    let inspection = crate::runtime::execution::inspect_patch_draft(root, &task["patchDraft"])?;
    let saved = repository.transaction_with("confirm-interrupted-manual-patch", |repository| {
        let (relative, mut current) = unresolved_manual_task(root,repository,reviewed)?;
        if inspection["state"] != state || inspection["forwardCheck"] != observation["forwardCheck"]
            || inspection["reverseCheck"] != observation["reverseCheck"]
            || crate::runtime::validation_revision::capture(root)? != observation["inputBinding"] {
            return Err("文件状态已变化，请重新核对。".to_string());
        }
        let applied = state == "applied";
        current["manualPatchApply"]["status"] = Value::String(state.to_string());
        current["manualPatchApply"]["finishedAt"] = Value::String(timestamp.to_string());
        current["manualPatchApply"]["reconciliation"]["confirmedAt"] = Value::String(timestamp.to_string());
        current["status"] = Value::String(if applied {"waiting verification"}else{"waiting approval"}.to_string());
        let message = if applied {"文件与草稿已应用状态一致；已记录人工确认，尚未检查。"}
            else {"文件与草稿未应用状态一致；已解除中断，重新应用仍需审阅确认。"};
        current["verificationSummary"] = Value::String(message.to_string());
        current["applyResult"] = serde_json::json!({"success":applied,"reconciled":true,"message":message,"finishedAt":timestamp});
        current["updatedAt"] = Value::String(timestamp.to_string());
        if current.get("executionEvidence").is_none() { current["executionEvidence"] = serde_json::json!([]); }
        current["executionEvidence"].as_array_mut().ok_or("任务证据格式无效。")?.push(serde_json::json!({
            "at":timestamp,"kind":if applied{"apply"}else{"recovery"},"status":"succeeded",
            "summary":message,"details":{"reconciled":true,"observation":observation,"sourceWritten":false,"checksRun":false}}));
        Ok((current.clone(),vec![JsonMutation::upsert(relative,current)]))
    })?;
    Ok(project_check_results(root,vec![saved]).remove(0))
}

fn safe_file_stem(id: &str) -> String {
    let stem = id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    if stem.is_empty() {
        "task".to_string()
    } else {
        stem
    }
}

fn normalized_title(task: &Value) -> String {
    task.get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split_whitespace()
        .collect::<String>()
        .to_lowercase()
}

fn is_open(task: &Value) -> bool {
    task.get("archivedAt").is_none_or(Value::is_null)
        && !matches!(
            task.get("status")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim(),
            "done" | "failed" | "cancelled"
        )
}

fn mark_persisted(task: &mut Value, task_id: &str, timestamp: &str) {
    let Some(trace) = task.get_mut("requestTrace").and_then(Value::as_object_mut) else {
        return;
    };
    trace.insert(
        "outcome".to_string(),
        Value::String("succeeded".to_string()),
    );
    trace.insert(
        "persistedAt".to_string(),
        Value::String(timestamp.to_string()),
    );
    trace.insert("runtime".to_string(), Value::String("tauri".to_string()));
    trace.insert("taskId".to_string(), Value::String(task_id.to_string()));
}

pub fn recover_storage(task_dir: &Path) -> Result<(), String> {
    if !task_dir.exists() {
        return Ok(());
    }
    let stale_before = SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(60 * 60))
        .unwrap_or(UNIX_EPOCH);
    let quarantine_dir = task_dir.join("quarantine");
    for entry in fs::read_dir(task_dir).map_err(|err| err.to_string())? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if name.ends_with(".tmp") {
            if fs::metadata(&path)
                .and_then(|metadata| metadata.modified())
                .unwrap_or(SystemTime::now())
                < stale_before
            {
                let _ = fs::remove_file(&path);
            }
            continue;
        }
        if !name.ends_with(".json") || name == "manifest.json" || read_json(&path).is_some() {
            continue;
        }
        fs::create_dir_all(&quarantine_dir).map_err(|err| err.to_string())?;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        fs::rename(
            &path,
            quarantine_dir.join(format!("{name}.{nonce}.corrupt")),
        )
        .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn read_json(path: &Path) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

/// Deletes one task and every state projection owned by it in one Repository
/// transaction: task, task conversation, goal index, and backlog item.
pub fn delete(root: &Path, id: &str, timestamp: &str) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("任务 id 不能为空".to_string());
    }
    Repository::new(root).transaction_with("delete-desktop-task", |repository| {
        let task_relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(id));
        let task = repository.read_json(&task_relative);
        if task.as_ref().and_then(|task|task.pointer("/manualPatchApply/status")).and_then(Value::as_str) == Some("applying") {
            return Err("手动改动正在执行或结果尚待核对，不能删除执行记录。".to_string());
        }
        let task_conversation_id = task.as_ref().and_then(|task| {
            task.get("conversationId")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
        let mut mutations = Vec::new();
        if task.is_some() {
            mutations.push(JsonMutation::delete(task_relative));
        }
        for (relative, conversation) in repository.list_json_records(CONVERSATION_DIRECTORY)? {
            let belongs_to_task = conversation.get("taskId").and_then(Value::as_str) == Some(id)
                || task_conversation_id.as_deref()
                    == conversation.get("id").and_then(Value::as_str);
            if belongs_to_task {
                mutations.push(JsonMutation::delete(relative));
            }
        }
        for (relative_path, collection_key) in [(GOALS_PATH, "goals"), (BACKLOG_PATH, "items")] {
            let Some(mut document) = repository.read_json(relative_path) else {
                continue;
            };
            if collection_key == "goals" {
                if let Some(goals) = document.get_mut("goals").and_then(Value::as_array_mut) {
                    for goal in goals {
                        for field in ["taskIds", "decompositionTaskIds"] {
                            if let Some(task_ids) =
                                goal.get_mut(field).and_then(Value::as_array_mut)
                            {
                                task_ids.retain(|task_id| task_id.as_str() != Some(id));
                            }
                        }
                    }
                }
            } else if let Some(items) = document.get_mut("items").and_then(Value::as_array_mut) {
                items.retain(|item| item.get("id").and_then(Value::as_str) != Some(id));
            }
            if let Some(object) = document.as_object_mut() {
                object.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
            }
            mutations.push(JsonMutation::upsert(relative_path, document));
        }
        Ok(((), mutations))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn manual_patch_fixture() -> (std::path::PathBuf, Value) {
        let root = std::env::temp_dir().join(format!("omnidesk-manual-reviewed-{}-{}",
            std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("example.js"), "before\n").unwrap();
        assert!(std::process::Command::new("git").args(["init","--quiet"]).current_dir(&root).status().unwrap().success());
        let task = save(&root,root.to_str().unwrap(),serde_json::json!({
            "id":"manual-reviewed","title":"manual reviewed","status":"waiting approval","executionEvidence":[],
            "patchDraft":{"allowedFiles":["example.js"],"diff":"diff --git a/example.js b/example.js\n--- a/example.js\n+++ b/example.js\n@@ -1 +1 @@\n-before\n+after\n"}
        }),"reviewed").unwrap();
        (root, task)
    }

    #[test]
    fn interrupted_manual_apply_reconciles_existing_changes_without_writing_or_checking() {
        let (root, reviewed) = manual_patch_fixture();
        let claimed = claim_reviewed_patch(&root,&reviewed,"claim").unwrap();
        fs::write(root.join("example.js"),"after\n").unwrap();
        let inspected = inspect_interrupted_patch(&root,&claimed,"inspect").unwrap();
        assert_eq!(inspected["observation"]["state"],"applied");
        assert_eq!(inspected["task"]["manualPatchApply"]["status"],"applying");
        assert_eq!(inspected["task"]["executionEvidence"],serde_json::json!([]));
        assert!(confirm_interrupted_patch(&root,&claimed,&inspected["observation"],"stale").is_err());
        let mut forged = inspected["observation"].clone(); forged["state"] = Value::String("not-applied".into());
        assert!(confirm_interrupted_patch(&root,&inspected["task"],&forged,"forged").is_err());
        let confirmed = confirm_interrupted_patch(&root,&inspected["task"],&inspected["observation"],"confirmed").unwrap();
        assert_eq!(confirmed["status"],"waiting verification");
        assert_eq!(confirmed["verificationFreshness"]["status"],"pending");
        assert_eq!(confirmed["executionEvidence"][0]["details"]["sourceWritten"],false);
        assert_eq!(confirmed["executionEvidence"][0]["details"]["checksRun"],false);
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"after\n");
        assert!(confirm_interrupted_patch(&root,&inspected["task"],&inspected["observation"],"duplicate").is_err());
        assert!(apply_reviewed_patch(&root,&confirmed,"replay").is_err());
        assert_eq!(list(&root).unwrap()[0]["manualPatchApply"]["status"],"applied");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_manual_apply_not_applied_requires_a_new_explicit_apply() {
        let (root, reviewed) = manual_patch_fixture();
        let claimed = claim_reviewed_patch(&root,&reviewed,"claim").unwrap();
        let inspected = inspect_interrupted_patch(&root,&claimed,"inspect").unwrap();
        assert_eq!(inspected["observation"]["state"],"not-applied");
        let confirmed = confirm_interrupted_patch(&root,&inspected["task"],&inspected["observation"],"confirmed").unwrap();
        assert_eq!(confirmed["status"],"waiting approval");
        assert_eq!(confirmed["manualPatchApply"]["status"],"not-applied");
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"before\n");
        assert_eq!(confirmed["executionEvidence"][0]["kind"],"recovery");
        let saved = save(&root,root.to_str().unwrap(),confirmed,"review-again").unwrap();
        let applied = apply_reviewed_patch(&root,&saved,"explicit-new-apply").unwrap();
        assert_eq!(applied["success"],true);
        assert_eq!(applied["task"]["executionEvidence"].as_array().unwrap().len(),2);
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"after\n");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_manual_apply_refuses_active_stale_ambiguous_and_foreign_recovery() {
        let (root, reviewed) = manual_patch_fixture();
        let claimed = claim_reviewed_patch(&root,&reviewed,"claim").unwrap();
        let before = fs::read(directory(&root).join("manual-reviewed.json")).unwrap();
        let lease = manual_patch_lease(&root,&claimed).unwrap();
        assert!(inspect_interrupted_patch(&root,&claimed,"active").unwrap_err().contains("仍在处理"));
        assert_eq!(fs::read(directory(&root).join("manual-reviewed.json")).unwrap(),before);
        drop(lease);
        let inspected = inspect_interrupted_patch(&root,&claimed,"inspect").unwrap();
        let mut foreign = inspected["task"].clone(); foreign["projectPath"] = serde_json::json!(root.join("other"));
        assert!(confirm_interrupted_patch(&root,&foreign,&inspected["observation"],"foreign").is_err());
        fs::write(root.join("example.js"),"other!\n").unwrap();
        assert!(confirm_interrupted_patch(&root,&inspected["task"],&inspected["observation"],"changed").unwrap_err().contains("文件已变化"));
        let ambiguous = inspect_interrupted_patch(&root,&inspected["task"],"ambiguous").unwrap();
        assert_eq!(ambiguous["observation"]["state"],"ambiguous");
        assert!(confirm_interrupted_patch(&root,&ambiguous["task"],&ambiguous["observation"],"unknown").unwrap_err().contains("无法确定"));
        fs::write(root.join("example.js"),"before\n").unwrap();
        assert!(confirm_interrupted_patch(&root,&inspected["task"],&inspected["observation"],"old-observation").is_err());
        assert_eq!(list(&root).unwrap()[0]["manualPatchApply"]["status"],"applying");
        assert_eq!(list(&root).unwrap()[0]["executionEvidence"],serde_json::json!([]));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn manual_apply_rejects_replaced_or_foreign_snapshots_without_writing() {
        let (root, reviewed) = manual_patch_fixture();
        let mut newer = reviewed.clone();
        newer["patchDraft"]["diff"] = Value::String(reviewed["patchDraft"]["diff"].as_str().unwrap().replace("+after", "+newer"));
        let newer = save(&root,root.to_str().unwrap(),newer,"reviewed").unwrap(); // Same timestamp must still reject.
        let before = fs::read(directory(&root).join("manual-reviewed.json")).unwrap();
        assert!(apply_reviewed_patch(&root,&reviewed,"apply").unwrap_err().contains("重新查看"));
        let mut foreign = newer.clone(); foreign["projectPath"] = Value::String(root.join("elsewhere").to_string_lossy().into_owned());
        assert!(apply_reviewed_patch(&root,&foreign,"apply").unwrap_err().contains("工程已切换"));
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"before\n");
        assert_eq!(fs::read(directory(&root).join("manual-reviewed.json")).unwrap(),before);
        let result = apply_reviewed_patch(&root,&newer,"apply").unwrap();
        assert_eq!(result["success"],true,"{result}");
        assert_eq!(result["task"]["status"],"waiting verification");
        assert_eq!(result["task"]["manualPatchApply"]["status"],"applied");
        assert_eq!(result["task"]["executionEvidence"].as_array().unwrap().len(),1);
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"newer\n");
        assert!(apply_reviewed_patch(&root,&newer,"replay").is_err());
        assert!(save(&root,root.to_str().unwrap(),newer,"stale-save").is_err());
        assert_eq!(list(&root).unwrap()[0]["manualPatchApply"]["status"],"applied");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn manual_apply_claim_is_exclusive_and_survives_reopening() {
        let (root,reviewed) = manual_patch_fixture();
        let first_root = root.clone(); let first_review = reviewed.clone();
        let first = std::thread::spawn(move ||claim_reviewed_patch(&first_root,&first_review,"claim"));
        let second_root = root.clone(); let second_review = reviewed.clone();
        let second = std::thread::spawn(move ||claim_reviewed_patch(&second_root,&second_review,"claim"));
        let results = [first.join().unwrap(),second.join().unwrap()];
        assert_eq!(results.iter().filter(|result|result.is_ok()).count(),1);
        let reopened = list(&root).unwrap().remove(0);
        assert_eq!(reopened["manualPatchApply"]["status"],"applying");
        assert!(apply_reviewed_patch(&root,&reopened,"restart").is_err());
        assert!(save(&root,root.to_str().unwrap(),reopened,"overwrite").is_err());
        assert!(delete(&root,"manual-reviewed","delete").is_err());
        Repository::new(&root).transaction_with("test-simulated-restart", |repository| {
            let relative = format!("{TASK_DIRECTORY}/manual-reviewed.json");
            let mut task = repository.read_json(&relative).unwrap();
            task["manualPatchApply"]["processId"] = serde_json::json!(0);
            Ok(((),vec![JsonMutation::upsert(relative,task)]))
        }).unwrap();
        let interrupted = list(&root).unwrap().remove(0);
        assert_eq!(interrupted["status"],"interrupted");
        assert!(interrupted["verificationSummary"].as_str().unwrap().contains("不能自动重放"));
        assert!(apply_reviewed_patch(&root,&interrupted,"restart-replay").is_err());
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"before\n");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn manual_apply_failure_is_durable_and_does_not_accept_client_operation_fields() {
        let (root,mut reviewed) = manual_patch_fixture();
        reviewed["patchDraft"]["diff"] = Value::String("invalid patch".to_string());
        reviewed["manualPatchApply"] = serde_json::json!({"status":"applied","token":"forged"});
        reviewed = save(&root,root.to_str().unwrap(),reviewed,"invalid").unwrap();
        assert!(reviewed.get("manualPatchApply").is_none());
        let result = apply_reviewed_patch(&root,&reviewed,"failed").unwrap();
        assert_eq!(result["success"],false);
        let reopened = list(&root).unwrap().remove(0);
        assert_eq!(reopened["status"],"failed");
        assert_eq!(reopened["manualPatchApply"]["status"],"failed");
        assert_eq!(reopened["executionEvidence"][0]["status"],"failed");
        assert_eq!(fs::read(root.join("example.js")).unwrap(),b"before\n");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn task_checks_are_revalidated_without_rewriting_historical_evidence() {
        let root = std::env::temp_dir().join(format!("omnidesk-task-freshness-{}-{}",
            std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("source.txt"), "before").unwrap();
        let binding = crate::runtime::validation_revision::capture(&root).unwrap();
        let run = serde_json::json!({"id":"runtime","success":true,"inputBinding":binding,"freshness":{"status":"fresh"}});
        let check = serde_json::json!({"kind":"check","status":"succeeded","details":{"runs":[run]}});
        let original = serde_json::json!({"id":"checked","title":"checked","status":"done",
            "executionEvidence":[check],"verificationFreshness":{"status":"forged"}});
        let saved = save(&root, root.to_str().unwrap(), original, "checked").unwrap();
        assert_eq!(saved["verificationFreshness"]["status"], "fresh");
        let path = root.join(TASK_DIRECTORY).join("checked.json");
        let original_bytes = fs::read(&path).unwrap();
        let stored: Value = serde_json::from_slice(&original_bytes).unwrap();
        assert!(stored.get("verificationFreshness").is_none());
        fs::write(root.join("source.txt"), "after!").unwrap();
        for _restart in 0..2 {
            let tasks = list(&root).unwrap();
            assert_eq!(tasks[0]["verificationFreshness"]["status"], "stale");
            assert_eq!(tasks[0]["executionEvidence"], stored["executionEvidence"]);
            assert_eq!(fs::read(&path).unwrap(), original_bytes);
        }
        fs::write(root.join("source.txt"), "before").unwrap();
        assert_eq!(list(&root).unwrap()[0]["verificationFreshness"]["status"], "fresh");
        // A mixed-version batch cannot be presented as verified even when the
        // final check happens to match the current source.
        let mut mixed = stored.clone();
        mixed["executionEvidence"][0]["details"]["runs"].as_array_mut().unwrap()
            .push(serde_json::json!({"success":true,"inputBinding":{"sourceDigest":"other"},"freshness":{"status":"fresh"}}));
        assert_eq!(project_check_results(&root,vec![mixed])[0]["verificationFreshness"]["status"],"stale");
        let legacy = serde_json::json!({"executionEvidence":[{"kind":"check","status":"succeeded"}]});
        assert_eq!(project_check_results(&root,vec![legacy])[0]["verificationFreshness"]["status"],"unbound");
        let mut failed = stored.clone();
        failed["executionEvidence"].as_array_mut().unwrap().push(serde_json::json!({"kind":"check","status":"failed"}));
        assert_eq!(project_check_results(&root,vec![failed])[0]["verificationFreshness"]["status"],"failed");
        let mut reapplied = stored.clone();
        reapplied["executionEvidence"].as_array_mut().unwrap().push(serde_json::json!({"kind":"apply","status":"succeeded"}));
        let projected = project_check_results(&root,vec![reapplied.clone()]).remove(0);
        assert_eq!(projected["verificationFreshness"]["status"],"pending");
        assert_eq!(projected["executionEvidence"],reapplied["executionEvidence"]);
        reapplied["executionEvidence"].as_array_mut().unwrap().push(stored["executionEvidence"][0].clone());
        assert_eq!(project_check_results(&root,vec![reapplied])[0]["verificationFreshness"]["status"],"fresh");
        #[cfg(unix)] {
            std::os::unix::fs::symlink("source.txt",root.join("source-link")).unwrap();
            assert_eq!(list(&root).unwrap()[0]["verificationFreshness"]["status"],"unavailable");
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn lists_newest_task_first_and_ignores_manifest() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-tasks-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("manifest.json"), r#"{"updatedAt":"999"}"#).unwrap();
        fs::write(
            directory.join("first.json"),
            r#"{"id":"first","updatedAt":"1"}"#,
        )
        .unwrap();
        fs::write(
            directory.join("latest.json"),
            r#"{"id":"latest","updatedAt":"2"}"#,
        )
        .unwrap();
        assert_eq!(list(&root).unwrap()[0]["id"], "latest");
    }

    #[test]
    fn projects_legacy_non_writing_drafts_out_of_approval() {
        let projected = project_legacy_execution_state(serde_json::json!({
            "id": "legacy-check",
            "status": "waiting approval",
            "patchDraft": { "diff": "--- a/HANDOFF.md\n+++ b/HANDOFF.md" },
            "plan": { "candidateChanges": ["先不写文件，只形成下一步建议。"] }
        }));
        assert_eq!(projected["status"], "planned");
        assert_eq!(projected["patchDraft"]["notApplicable"], true);
        assert_eq!(
            projected["runtimeMigration"]["version"],
            "semantic-patch-gate-v1"
        );
    }

    #[test]
    fn projects_legacy_task_schema_without_rewriting_history() {
        let projected = project_task_schema(serde_json::json!({
            "schemaVersion": "project-os.desktop-task.v0.1",
            "id": "legacy-task"
        }));
        assert_eq!(projected["schemaVersion"], TASK_SCHEMA_VERSION);
        assert_eq!(
            projected["schemaMigration"]["from"],
            LEGACY_TASK_SCHEMA_VERSION
        );
        assert_eq!(projected["schemaMigration"]["mode"], "read-projection");
    }

    #[test]
    fn projects_confirmation_word_titles_from_existing_plan_evidence() {
        let projected = project_confirmation_title(serde_json::json!({
            "id": "confirmation-title",
            "title": "可以",
            "plan": { "summary": "修复对话状态机" }
        }));
        assert_eq!(projected["title"], "修复对话状态机");
        assert_eq!(
            projected["runtimeMigration"]["version"],
            "confirmation-title-v1"
        );
    }

    #[test]
    fn delete_removes_all_task_owned_state_in_one_transaction() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-task-delete-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let task_dir = root.join(TASK_DIRECTORY);
        let conversation_dir = root.join(CONVERSATION_DIRECTORY);
        fs::create_dir_all(&task_dir).unwrap();
        fs::create_dir_all(&conversation_dir).unwrap();
        fs::write(task_dir.join("task-1.json"), r#"{"schemaVersion":"project-os.desktop-task.v0.1","id":"task-1","conversationId":"conversation-1"}"#).unwrap();
        fs::write(conversation_dir.join("conversation-1.json"), r#"{"schemaVersion":"project-os.desktop-conversation.v0.1","id":"conversation-1","taskId":"task-1"}"#).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"goals":[{"id":"goal-1","decompositionTaskIds":["task-1"],"taskIds":["task-1"]}]}"#,
        )
        .unwrap();
        fs::write(root.join(BACKLOG_PATH), r#"{"items":[{"id":"task-1"}]}"#).unwrap();
        delete(&root, "task-1", "now").unwrap();
        assert!(!task_dir.join("task-1.json").exists());
        assert!(!conversation_dir.join("conversation-1.json").exists());
        assert_eq!(
            read_json(&root.join(GOALS_PATH)).unwrap()["goals"][0]["taskIds"],
            serde_json::json!([])
        );
        assert_eq!(
            read_json(&root.join(GOALS_PATH)).unwrap()["goals"][0]["decompositionTaskIds"],
            serde_json::json!([])
        );
    }

    #[test]
    fn save_is_idempotent_deduplicates_and_rebinds_goal() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-task-save-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"goals":[{"id":"goal-a","taskIds":["task-old"]},{"id":"goal-b","taskIds":[]}]}"#,
        )
        .unwrap();
        let saved = save(&root, "/project", serde_json::json!({"id":"task-new","requestId":"request-1","goalId":"goal-b","title":"Refactor runtime","requestTrace":{"requestId":"request-1"}}), "now").unwrap();
        assert_eq!(saved["schemaVersion"], TASK_SCHEMA_VERSION);
        assert!(saved.get("schemaMigration").is_none());
        assert_eq!(saved["requestTrace"]["taskId"], "task-new");
        assert_eq!(saved["requestTrace"]["runtime"], "tauri");
        let goals = read_json(&root.join(GOALS_PATH)).unwrap();
        assert_eq!(
            goals["goals"][1]["taskIds"],
            serde_json::json!(["task-new"])
        );
        let repeated = save(&root, "/project", serde_json::json!({"id":"another-id","requestId":"request-1","goalId":"goal-b","title":"Different title"}), "later").unwrap();
        assert_eq!(repeated["id"], "task-new");
        let duplicate = save(&root, "/project", serde_json::json!({"id":"duplicate-id","goalId":"goal-b","title":" Refactor  runtime "}), "later").unwrap();
        assert_eq!(duplicate["id"], "task-new");
        assert_eq!(duplicate["deduplicated"], true);
    }

    #[test]
    fn recovery_preserves_recent_temp_and_quarantines_corrupt_json() {
        let directory = std::env::temp_dir().join(format!(
            "omnidesk-task-recovery-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("recent.tmp"), "partial").unwrap();
        fs::write(directory.join("broken.json"), "{").unwrap();
        recover_storage(&directory).unwrap();
        assert!(directory.join("recent.tmp").exists());
        assert!(!directory.join("broken.json").exists());
        assert_eq!(
            fs::read_dir(directory.join("quarantine")).unwrap().count(),
            1
        );
    }

    #[test]
    fn project_roots_keep_task_conversation_and_agent_run_state_isolated() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let first = std::env::temp_dir().join(format!("omnidesk-isolation-first-{nonce}"));
        let second = std::env::temp_dir().join(format!("omnidesk-isolation-second-{nonce}"));
        save(
            &first,
            "/first",
            serde_json::json!({"id":"task-same","title":"First task"}),
            "first",
        )
        .unwrap();
        save(
            &second,
            "/second",
            serde_json::json!({"id":"task-same","title":"Second task"}),
            "second",
        )
        .unwrap();
        crate::runtime::conversations::save(
            &first,
            "/first",
            serde_json::json!({"id":"conversation-same","turns":[]}),
            "first",
        )
        .unwrap();
        crate::runtime::conversations::save(
            &second,
            "/second",
            serde_json::json!({"id":"conversation-same","turns":[]}),
            "second",
        )
        .unwrap();
        let run = crate::runtime::agent_runs::new_hermes_run(
            "run-same".to_string(),
            String::new(),
            "first".to_string(),
            "first".to_string(),
            1,
            String::new(),
            "first",
        );
        crate::runtime::agent_runs::persist(&first, &run).unwrap();

        assert_eq!(list(&first).unwrap()[0]["projectPath"], "/first");
        assert_eq!(list(&second).unwrap()[0]["projectPath"], "/second");
        assert_eq!(
            crate::runtime::conversations::list(&first).unwrap()[0]["projectPath"],
            "/first"
        );
        assert_eq!(
            crate::runtime::conversations::list(&second).unwrap()[0]["projectPath"],
            "/second"
        );
        assert_eq!(crate::runtime::agent_runs::list(&first).unwrap().len(), 1);
        assert!(crate::runtime::agent_runs::list(&second)
            .unwrap()
            .is_empty());
    }
}

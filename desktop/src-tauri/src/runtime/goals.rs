use crate::runtime::repository::{JsonMutation, Repository};
use serde_json::{json, Value};
use std::path::Path;

const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const PROJECT_GOALS_PATH: &str = ".omnidesk/data/project-goals.json";
const GOAL_VALIDATION_PATH: &str = ".omnidesk/data/goal-validation.json";
const GOAL_VALIDATION_REPORT_PATH: &str = ".omnidesk/evidence/goal-validation-report.json";
const GOAL_SIGNOFF_HISTORY_PATH: &str = ".omnidesk/evidence/goal-signoff-history.json";
const GOALS_SCHEMA_VERSION: &str = "omnidesk.goals.v0.1";
const LEGACY_GOALS_SCHEMA_VERSION: &str = "project-os.goals.v0.1";
const GOAL_SIGNOFF_HISTORY_SCHEMA_VERSION: &str = "omnidesk.goal-signoff-history.v0.1";

fn load_or_seed(repository: &Repository, project_name: &str) -> Value {
    let mut goals = project_goals_schema(repository.read_json(GOALS_PATH).unwrap_or_else(|| {
        json!({
            "schemaVersion": GOALS_SCHEMA_VERSION,
            "activeGoalId": "current-goal",
            "goals": [{
                "id": "current-goal",
                "title": "当前目标",
                "projectName": project_name,
                "status": "active",
                "summary": "当前推进中的目标。",
                "taskIds": []
            }]
        })
    }));
    if let Some(object) = goals.as_object_mut() {
        object.remove("schemaMigration");
    }
    goals
}

fn project_goals_schema(mut goals: Value) -> Value {
    if goals.get("schemaVersion").and_then(Value::as_str) != Some(LEGACY_GOALS_SCHEMA_VERSION) {
        return goals;
    }
    let Some(object) = goals.as_object_mut() else { return goals; };
    object.insert("schemaVersion".to_string(), Value::String(GOALS_SCHEMA_VERSION.to_string()));
    object.insert("schemaMigration".to_string(), json!({
        "from": LEGACY_GOALS_SCHEMA_VERSION,
        "mode": "read-projection",
        "to": GOALS_SCHEMA_VERSION,
    }));
    goals
}

fn compact_title(title: &str) -> String {
    let normalized = title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace(" / ", "/")
        .replace('/', " / ");
    let trimmed = normalized.trim();
    if trimmed.chars().count() <= 18 {
        return trimmed.to_string();
    }
    if let Some(part) = trimmed
        .split('/')
        .map(str::trim)
        .find(|part| !part.is_empty() && part.chars().count() <= 18)
    {
        return part.to_string();
    }
    format!("{}...", trimmed.chars().take(16).collect::<String>())
}

fn add_to_project_goal(project_goals: &mut Value, parent_id: &str, goal_id: &str, timestamp: &str) {
    if let Some(items) = project_goals
        .get_mut("projectGoals")
        .and_then(Value::as_array_mut)
    {
        for project_goal in items {
            if project_goal.get("id").and_then(Value::as_str) != Some(parent_id) {
                continue;
            }
            let Some(goal) = project_goal.as_object_mut() else {
                continue;
            };
            let mut ids = goal
                .get("stageGoalIds")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            if !ids.iter().any(|id| id == goal_id) {
                ids.push(goal_id.to_string());
            }
            goal.insert(
                "stageGoalIds".to_string(),
                Value::Array(ids.into_iter().map(Value::String).collect()),
            );
            goal.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
    }
    if let Some(object) = project_goals.as_object_mut() {
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
    }
}

/// Creates a stage goal and indexes it under the active project goal atomically.
pub fn create(
    root: &Path,
    project_name: &str,
    id: String,
    title: &str,
    summary: &str,
    timestamp: &str,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("目标名称不能为空。".to_string());
    }
    Repository::new(root).transaction_with("create-goal", |repository| {
        let mut project_goals = repository.read_json(PROJECT_GOALS_PATH).ok_or_else(|| "请先确认当前项目目标。".to_string())?;
        let parent_id = project_goals.get("activeProjectGoalId").and_then(Value::as_str).filter(|id| !id.is_empty()).ok_or_else(|| "请先确认当前项目目标。".to_string())?.to_string();
        let mut goals = load_or_seed(repository, project_name);
        let object = goals.as_object_mut().ok_or_else(|| "目标数据格式错误。".to_string())?;
        object.insert("activeGoalId".to_string(), Value::String(id.clone()));
        object.insert("updatedAt".to_string(), Value::String(timestamp.to_string()));
        let items = object.entry("goals".to_string()).or_insert_with(|| Value::Array(Vec::new())).as_array_mut().ok_or_else(|| "目标数据格式错误。".to_string())?;
        if items.iter().any(|goal| goal.get("id").and_then(Value::as_str) == Some(id.as_str())) { return Err("目标 id 已存在。".to_string()); }
        items.insert(0, json!({"id": id, "parentProjectGoalId": parent_id, "title": title, "shortTitle": compact_title(title), "projectName": project_name, "status": "draft", "createdAt": timestamp, "summary": if summary.trim().is_empty() { "目标草案，等待确认。" } else { summary.trim() }, "taskIds": []}));
        add_to_project_goal(&mut project_goals, &parent_id, items[0]["id"].as_str().unwrap_or(""), timestamp);
        Ok(((), vec![JsonMutation::upsert(GOALS_PATH, goals), JsonMutation::upsert(PROJECT_GOALS_PATH, project_goals)]))
    })
}

pub fn update(
    root: &Path,
    project_name: &str,
    id: &str,
    title: &str,
    summary: &str,
    timestamp: &str,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("目标名称不能为空。".to_string());
    }
    Repository::new(root).transaction_with("update-goal", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let goal = goals
            .get_mut("goals")
            .and_then(Value::as_array_mut)
            .and_then(|items| {
                items
                    .iter_mut()
                    .find(|goal| goal.get("id").and_then(Value::as_str) == Some(id))
            })
            .ok_or_else(|| "没有找到这个目标。".to_string())?;
        let object = goal
            .as_object_mut()
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        object.insert("title".to_string(), Value::String(title.to_string()));
        object.insert(
            "shortTitle".to_string(),
            Value::String(compact_title(title)),
        );
        object.insert(
            "summary".to_string(),
            Value::String(summary.trim().to_string()),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        if let Some(object) = goals.as_object_mut() {
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
        Ok(((), vec![JsonMutation::upsert(GOALS_PATH, goals)]))
    })
}

pub fn switch_active(
    root: &Path,
    project_name: &str,
    id: &str,
    timestamp: &str,
) -> Result<(), String> {
    Repository::new(root).transaction_with("switch-active-goal", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let exists = goals
            .get("goals")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items
                    .iter()
                    .any(|goal| goal.get("id").and_then(Value::as_str) == Some(id))
            });
        if !exists {
            return Err("没有找到这个目标。".to_string());
        }
        if let Some(object) = goals.as_object_mut() {
            object.insert("activeGoalId".to_string(), Value::String(id.to_string()));
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
        Ok(((), vec![JsonMutation::upsert(GOALS_PATH, goals)]))
    })
}

pub fn confirm(root: &Path, project_name: &str, id: &str, timestamp: &str) -> Result<(), String> {
    Repository::new(root).transaction_with("confirm-goal", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let goal = goals
            .get_mut("goals")
            .and_then(Value::as_array_mut)
            .and_then(|items| {
                items
                    .iter_mut()
                    .find(|goal| goal.get("id").and_then(Value::as_str) == Some(id))
            })
            .ok_or_else(|| "没有找到这个目标。".to_string())?;
        let object = goal
            .as_object_mut()
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        object.insert("status".to_string(), Value::String("planned".to_string()));
        object.insert(
            "confirmedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        if let Some(object) = goals.as_object_mut() {
            object.insert("activeGoalId".to_string(), Value::String(id.to_string()));
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
        Ok(((), vec![JsonMutation::upsert(GOALS_PATH, goals)]))
    })
}

pub fn confirm_decomposition(
    root: &Path,
    project_name: &str,
    id: &str,
    task_ids: &[String],
    timestamp: &str,
) -> Result<(), String> {
    let task_ids = task_ids
        .iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect::<Vec<_>>();
    if task_ids.is_empty() {
        return Err("目标拆解至少需要一个任务。".to_string());
    }
    Repository::new(root).transaction_with("confirm-goal-decomposition", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let goal = goals
            .get_mut("goals")
            .and_then(Value::as_array_mut)
            .and_then(|items| {
                items
                    .iter_mut()
                    .find(|goal| goal.get("id").and_then(Value::as_str) == Some(id))
            })
            .ok_or_else(|| "没有找到这个目标。".to_string())?;
        let object = goal
            .as_object_mut()
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        let mut merged = object
            .get("taskIds")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        for task_id in &task_ids {
            if !merged.contains(task_id) {
                merged.push(task_id.clone());
            }
        }
        object.insert("status".to_string(), Value::String("queued".to_string()));
        object.insert(
            "taskIds".to_string(),
            Value::Array(merged.into_iter().map(Value::String).collect()),
        );
        object.insert(
            "decomposedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        if let Some(object) = goals.as_object_mut() {
            object.insert("activeGoalId".to_string(), Value::String(id.to_string()));
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
        Ok(((), vec![JsonMutation::upsert(GOALS_PATH, goals)]))
    })
}

pub fn archive(root: &Path, project_name: &str, id: &str, timestamp: &str) -> Result<(), String> {
    Repository::new(root).transaction_with("archive-goal", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let was_active = goals.get("activeGoalId").and_then(Value::as_str) == Some(id);
        let items = goals
            .get_mut("goals")
            .and_then(Value::as_array_mut)
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        let goal = items
            .iter_mut()
            .find(|goal| goal.get("id").and_then(Value::as_str) == Some(id))
            .ok_or_else(|| "没有找到这个目标。".to_string())?;
        if goal
            .get("taskIds")
            .and_then(Value::as_array)
            .is_some_and(|ids| !ids.is_empty())
        {
            return Err("目标仍有关联任务，请先迁移或合并任务。".to_string());
        }
        let object = goal
            .as_object_mut()
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        let previous = object
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("draft")
            .to_string();
        object.insert("statusBeforeArchive".to_string(), Value::String(previous));
        object.insert("status".to_string(), Value::String("archived".to_string()));
        object.insert(
            "archivedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        let next_active = if was_active {
            items
                .iter()
                .find(|goal| {
                    !["archived", "merged", "done"]
                        .contains(&goal.get("status").and_then(Value::as_str).unwrap_or(""))
                })
                .and_then(|goal| goal.get("id").and_then(Value::as_str))
                .unwrap_or("")
                .to_string()
        } else {
            String::new()
        };
        if let Some(object) = goals.as_object_mut() {
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
            if was_active {
                object.insert("activeGoalId".to_string(), Value::String(next_active));
            }
        }
        let mut mutations = vec![JsonMutation::upsert(GOALS_PATH, goals)];
        if let Some(mut project_goals) = repository.read_json(PROJECT_GOALS_PATH) {
            if let Some(items) = project_goals
                .get_mut("projectGoals")
                .and_then(Value::as_array_mut)
            {
                for project_goal in items {
                    if let Some(ids) = project_goal
                        .get_mut("stageGoalIds")
                        .and_then(Value::as_array_mut)
                    {
                        ids.retain(|stage_id| stage_id.as_str() != Some(id));
                    }
                }
            }
            if let Some(object) = project_goals.as_object_mut() {
                object.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
            }
            mutations.push(JsonMutation::upsert(PROJECT_GOALS_PATH, project_goals));
        }
        Ok(((), mutations))
    })
}

pub fn restore(root: &Path, project_name: &str, id: &str, timestamp: &str) -> Result<(), String> {
    Repository::new(root).transaction_with("restore-goal", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let goal = goals
            .get_mut("goals")
            .and_then(Value::as_array_mut)
            .and_then(|items| {
                items
                    .iter_mut()
                    .find(|goal| goal.get("id").and_then(Value::as_str) == Some(id))
            })
            .ok_or_else(|| "没有找到这个目标。".to_string())?;
        let object = goal
            .as_object_mut()
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        let parent_id = object
            .get("parentProjectGoalId")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let restored = object
            .get("statusBeforeArchive")
            .and_then(Value::as_str)
            .filter(|status| *status != "archived")
            .unwrap_or("draft")
            .to_string();
        object.insert("status".to_string(), Value::String(restored));
        object.remove("archivedAt");
        object.remove("statusBeforeArchive");
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        if let Some(object) = goals.as_object_mut() {
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
        let mut mutations = vec![JsonMutation::upsert(GOALS_PATH, goals)];
        if !parent_id.is_empty() {
            if let Some(mut project_goals) = repository.read_json(PROJECT_GOALS_PATH) {
                add_to_project_goal(&mut project_goals, &parent_id, id, timestamp);
                mutations.push(JsonMutation::upsert(PROJECT_GOALS_PATH, project_goals));
            }
        }
        Ok(((), mutations))
    })
}

pub fn merge(
    root: &Path,
    project_name: &str,
    source_id: &str,
    target_id: &str,
    timestamp: &str,
) -> Result<(), String> {
    if source_id == target_id {
        return Err("不能把目标合并到自身。".to_string());
    }
    Repository::new(root).transaction_with("merge-goal", |repository| {
        let mut goals = load_or_seed(repository, project_name);
        let items = goals
            .get("goals")
            .and_then(Value::as_array)
            .ok_or_else(|| "目标数据格式错误。".to_string())?;
        let source = items
            .iter()
            .find(|goal| goal.get("id").and_then(Value::as_str) == Some(source_id))
            .ok_or_else(|| "没有找到待合并目标。".to_string())?;
        let target = items
            .iter()
            .find(|goal| goal.get("id").and_then(Value::as_str) == Some(target_id))
            .ok_or_else(|| "没有找到接收目标。".to_string())?;
        if ["archived", "merged", "done"]
            .contains(&target.get("status").and_then(Value::as_str).unwrap_or(""))
        {
            return Err("请选择仍在推进的接收目标。".to_string());
        }
        let target_title = target
            .get("shortTitle")
            .or_else(|| target.get("title"))
            .and_then(Value::as_str)
            .unwrap_or("目标")
            .to_string();
        let mut task_ids: Vec<String> = source
            .get("taskIds")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        let mut mutations = Vec::new();
        for (relative, mut task) in crate::runtime::tasks::list_repository_records(repository)? {
            if task.get("goalId").and_then(Value::as_str) != Some(source_id) {
                continue;
            }
            if let Some(id) = task.get("id").and_then(Value::as_str) {
                if !task_ids.iter().any(|known| known == id) {
                    task_ids.push(id.to_string());
                }
            }
            if let Some(object) = task.as_object_mut() {
                object.insert("goalId".to_string(), Value::String(target_id.to_string()));
                object.insert("goalTitle".to_string(), Value::String(target_title.clone()));
                object.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
            }
            mutations.push(JsonMutation::upsert(relative, task));
        }
        if let Some(items) = goals.get_mut("goals").and_then(Value::as_array_mut) {
            for goal in items {
                let Some(object) = goal.as_object_mut() else {
                    continue;
                };
                if object.get("id").and_then(Value::as_str) == Some(target_id) {
                    let mut ids = object
                        .get("taskIds")
                        .and_then(Value::as_array)
                        .map(|items| {
                            items
                                .iter()
                                .filter_map(Value::as_str)
                                .map(str::to_string)
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    for id in &task_ids {
                        if !ids.contains(id) {
                            ids.push(id.clone());
                        }
                    }
                    object.insert(
                        "taskIds".to_string(),
                        Value::Array(ids.into_iter().map(Value::String).collect()),
                    );
                    object.insert(
                        "updatedAt".to_string(),
                        Value::String(timestamp.to_string()),
                    );
                } else if object.get("id").and_then(Value::as_str) == Some(source_id) {
                    object.insert("status".to_string(), Value::String("merged".to_string()));
                    object.insert(
                        "mergedIntoGoalId".to_string(),
                        Value::String(target_id.to_string()),
                    );
                    object.insert("taskIds".to_string(), Value::Array(Vec::new()));
                    object.insert(
                        "updatedAt".to_string(),
                        Value::String(timestamp.to_string()),
                    );
                }
            }
        }
        if let Some(object) = goals.as_object_mut() {
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
            if object.get("activeGoalId").and_then(Value::as_str) == Some(source_id) {
                object.insert(
                    "activeGoalId".to_string(),
                    Value::String(target_id.to_string()),
                );
            }
        }
        mutations.push(JsonMutation::upsert(GOALS_PATH, goals));
        if let Some(mut project_goals) = repository.read_json(PROJECT_GOALS_PATH) {
            if let Some(items) = project_goals
                .get_mut("projectGoals")
                .and_then(Value::as_array_mut)
            {
                for goal in items {
                    if let Some(ids) = goal.get_mut("stageGoalIds").and_then(Value::as_array_mut) {
                        ids.retain(|id| id.as_str() != Some(source_id));
                    }
                }
            }
            mutations.push(JsonMutation::upsert(PROJECT_GOALS_PATH, project_goals));
        }
        Ok(((), mutations))
    })
}

/// Signs off a passed validation report. Report, validation document, history,
/// and goal completion always advance as one Repository transaction.
pub fn sign_off_validation(root: &Path, goal_id: &str, timestamp: &str) -> Result<(), String> {
    if goal_id.trim().is_empty() {
        return Err("签收必须绑定当前目标。".to_string());
    }
    Repository::new(root).transaction_with("sign-off-goal-validation", |repository| {
        let mut validation = repository.read_json(GOAL_VALIDATION_PATH)
            .ok_or_else(|| "未找到目标验收标准文件".to_string())?;
        let report = repository.read_json(GOAL_VALIDATION_REPORT_PATH).unwrap_or_else(|| json!({}));
        let report_status = report.get("status").and_then(Value::as_str).unwrap_or("missing");
        if report_status != "passed" { return Err("目标还没有通过验收，不能签收。".to_string()); }
        if report.get("goalId").and_then(Value::as_str) != Some(goal_id) {
            return Err("验收报告与当前目标不一致，请先为当前目标重新运行验收。".to_string());
        }
        if validation.pointer("/goal/id").and_then(Value::as_str) != Some(goal_id) {
            return Err("验收标准与当前目标不一致，请先为当前目标重新运行验收。".to_string());
        }
        let mut goals = repository.read_json(GOALS_PATH).ok_or_else(|| "未找到目标列表".to_string())?;
        let goal_title = goals.get("goals").and_then(Value::as_array).and_then(|items| items.iter().find(|item| item.get("id").and_then(Value::as_str) == Some(goal_id)))
            .and_then(|goal| goal.get("title").or_else(|| goal.get("shortTitle")).and_then(Value::as_str))
            .ok_or_else(|| "当前目标不存在，无法签收。".to_string())?.to_string();
        if let Some(object) = validation.as_object_mut() {
            object.insert("updatedAt".to_string(), Value::String(timestamp.to_string()));
            if let Some(goal) = object.get_mut("goal").and_then(Value::as_object_mut) {
                goal.insert("status".to_string(), Value::String("signed-off".to_string()));
            }
        }
        let mut history = repository.read_json(GOAL_SIGNOFF_HISTORY_PATH).unwrap_or_else(|| json!({ "schemaVersion": GOAL_SIGNOFF_HISTORY_SCHEMA_VERSION, "entries": [] }));
        if let Some(object) = history.as_object_mut() {
            object.insert("schemaVersion".to_string(), Value::String(GOAL_SIGNOFF_HISTORY_SCHEMA_VERSION.to_string()));
            object.insert("updatedAt".to_string(), Value::String(timestamp.to_string()));
            let entries = object.entry("entries".to_string()).or_insert_with(|| Value::Array(Vec::new()));
            if let Some(entries) = entries.as_array_mut() {
                entries.insert(0, json!({ "goalId": goal_id, "goalTitle": goal_title, "signedOffAt": timestamp, "reportStatus": report_status, "source": "OmniDesk" }));
            }
        }
        update_status(&mut goals, goal_id, "done", report_status, timestamp);
        Ok(((), vec![
            JsonMutation::upsert(GOAL_VALIDATION_PATH, validation),
            JsonMutation::upsert(GOAL_SIGNOFF_HISTORY_PATH, history),
            JsonMutation::upsert(GOALS_PATH, goals),
        ]))
    })
}

/// Persists a completed validation run after the controlled check executor has
/// produced its evidence. The executor never owns goal-state mutation.
pub fn record_validation(
    root: &Path,
    goal_id: &str,
    goal_title: &str,
    passed: bool,
    report: Value,
    timestamp: &str,
) -> Result<(), String> {
    Repository::new(root).transaction_with("run-goal-validation", |repository| {
        let mut goals = repository
            .read_json(GOALS_PATH)
            .ok_or_else(|| "未找到目标列表".to_string())?;
        let exists = goals
            .get("goals")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items
                    .iter()
                    .any(|goal| goal.get("id").and_then(Value::as_str) == Some(goal_id))
            });
        if !exists {
            return Err("当前目标不存在，无法运行验收。".to_string());
        }
        let mut mutations = vec![JsonMutation::upsert(GOAL_VALIDATION_REPORT_PATH, report)];
        if let Some(mut validation) = repository.read_json(GOAL_VALIDATION_PATH) {
            if let Some(object) = validation.as_object_mut() {
                object.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
                if let Some(goal) = object.get_mut("goal").and_then(Value::as_object_mut) {
                    goal.insert("id".to_string(), Value::String(goal_id.to_string()));
                    goal.insert("title".to_string(), Value::String(goal_title.to_string()));
                    goal.insert(
                        "status".to_string(),
                        Value::String(
                            if passed {
                                "verified"
                            } else {
                                "validation-failed"
                            }
                            .to_string(),
                        ),
                    );
                }
            }
            mutations.push(JsonMutation::upsert(GOAL_VALIDATION_PATH, validation));
        }
        update_status(
            &mut goals,
            goal_id,
            if passed { "pending-confirm" } else { "failed" },
            if passed { "passed" } else { "failed" },
            timestamp,
        );
        mutations.push(JsonMutation::upsert(GOALS_PATH, goals));
        Ok(((), mutations))
    })
}

pub fn update_status(
    goals: &mut Value,
    goal_id: &str,
    status: &str,
    validation_status: &str,
    timestamp: &str,
) {
    if let Some(object) = goals.as_object_mut() {
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        if let Some(items) = object.get_mut("goals").and_then(Value::as_array_mut) {
            for item in items {
                if item.get("id").and_then(Value::as_str) != Some(goal_id) {
                    continue;
                }
                let Some(goal) = item.as_object_mut() else {
                    continue;
                };
                goal.insert("status".to_string(), Value::String(status.to_string()));
                goal.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
                goal.insert(
                    "validationStatus".to_string(),
                    Value::String(validation_status.to_string()),
                );
                if status == "done" {
                    goal.insert(
                        "completedAt".to_string(),
                        Value::String(timestamp.to_string()),
                    );
                }
            }
        }
    }
}

pub fn rebind_task(goals: &mut Value, task_id: &str, goal_id: &str, timestamp: &str) {
    if let Some(object) = goals.as_object_mut() {
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        if let Some(items) = object.get_mut("goals").and_then(Value::as_array_mut) {
            for goal in items {
                let Some(goal_object) = goal.as_object_mut() else {
                    continue;
                };
                let mut ids = goal_object
                    .get("taskIds")
                    .and_then(Value::as_array)
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(Value::as_str)
                            .filter(|id| *id != task_id)
                            .map(str::to_string)
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                if goal_object.get("id").and_then(Value::as_str) == Some(goal_id)
                    && !goal_id.is_empty()
                {
                    ids.push(task_id.to_string());
                }
                ids.sort();
                ids.dedup();
                goal_object.insert(
                    "taskIds".to_string(),
                    Value::Array(ids.into_iter().map(Value::String).collect()),
                );
                goal_object.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn rebinds_a_task_without_leaving_stale_goal_indexes() {
        let mut goals = json!({ "goals": [{ "id": "a", "taskIds": ["task-1"] }, { "id": "b", "taskIds": [] }] });
        rebind_task(&mut goals, "task-1", "b", "now");
        assert_eq!(goals["goals"][0]["taskIds"], json!([]));
        assert_eq!(goals["goals"][1]["taskIds"], json!(["task-1"]));
    }

    #[test]
    fn create_indexes_stage_goal_in_the_same_repository_transaction() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-goal-create-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::create_dir_all(root.join(".omnidesk/evidence")).unwrap();
        fs::write(
            root.join(PROJECT_GOALS_PATH),
            r#"{"activeProjectGoalId":"project-goal-1","projectGoals":[{"id":"project-goal-1","stageGoalIds":[]}]}"#,
        )
        .unwrap();

        create(
            &root,
            "Demo",
            "stage-1".to_string(),
            "Stabilize runtime",
            "",
            "now",
        )
        .unwrap();

        let repository = Repository::new(&root);
        let goals = repository.read_json(GOALS_PATH).unwrap();
        let project_goals = repository.read_json(PROJECT_GOALS_PATH).unwrap();
        assert_eq!(goals["activeGoalId"], "stage-1");
        assert_eq!(goals["goals"][0]["parentProjectGoalId"], "project-goal-1");
        assert_eq!(
            project_goals["projectGoals"][0]["stageGoalIds"],
            json!(["stage-1"])
        );
        let events = fs::read_dir(root.join(".omnidesk/runtime/events"))
            .unwrap()
            .count();
        assert_eq!(events, 1);
    }

    #[test]
    fn confirmation_and_decomposition_share_a_goal_transaction_boundary() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-goal-confirm-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"activeGoalId":"goal-1","goals":[{"id":"goal-1","status":"draft","taskIds":["task-a"]}]}"#,
        )
        .unwrap();

        confirm(&root, "Demo", "goal-1", "confirmed").unwrap();
        confirm_decomposition(
            &root,
            "Demo",
            "goal-1",
            &["task-a".to_string(), "task-b".to_string()],
            "decomposed",
        )
        .unwrap();

        let goals = Repository::new(&root).read_json(GOALS_PATH).unwrap();
        assert_eq!(goals["goals"][0]["status"], "queued");
        assert_eq!(goals["goals"][0]["taskIds"], json!(["task-a", "task-b"]));
        assert_eq!(goals["activeGoalId"], "goal-1");
    }

    #[test]
    fn archive_and_restore_keep_project_goal_index_in_sync() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-goal-archive-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(root.join(GOALS_PATH), r#"{"activeGoalId":"goal-1","goals":[{"id":"goal-1","parentProjectGoalId":"parent-1","status":"planned","taskIds":[]}]}"#).unwrap();
        fs::write(
            root.join(PROJECT_GOALS_PATH),
            r#"{"projectGoals":[{"id":"parent-1","stageGoalIds":["goal-1"]}]}"#,
        )
        .unwrap();

        archive(&root, "Demo", "goal-1", "archived").unwrap();
        let repository = Repository::new(&root);
        assert_eq!(
            repository.read_json(PROJECT_GOALS_PATH).unwrap()["projectGoals"][0]["stageGoalIds"],
            json!([])
        );
        restore(&root, "Demo", "goal-1", "restored").unwrap();
        let goals = repository.read_json(GOALS_PATH).unwrap();
        let project_goals = repository.read_json(PROJECT_GOALS_PATH).unwrap();
        assert_eq!(goals["goals"][0]["status"], "planned");
        assert_eq!(
            project_goals["projectGoals"][0]["stageGoalIds"],
            json!(["goal-1"])
        );
    }

    #[test]
    fn merge_migrates_task_and_all_goal_indexes_in_one_operation() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-goal-merge-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let task_dir = crate::runtime::tasks::directory(&root);
        fs::create_dir_all(&task_dir).unwrap();
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(root.join(GOALS_PATH), r#"{"activeGoalId":"source","goals":[{"id":"source","status":"planned","taskIds":["task-1"]},{"id":"target","title":"Target","status":"planned","taskIds":[]}]}"#).unwrap();
        fs::write(
            root.join(PROJECT_GOALS_PATH),
            r#"{"projectGoals":[{"id":"parent","stageGoalIds":["source","target"]}]}"#,
        )
        .unwrap();
        fs::write(
            task_dir.join("task-1.json"),
            r#"{"schemaVersion":"project-os.desktop-task.v0.1","id":"task-1","goalId":"source"}"#,
        )
        .unwrap();
        merge(&root, "Demo", "source", "target", "now").unwrap();
        let repository = Repository::new(&root);
        let goals = repository.read_json(GOALS_PATH).unwrap();
        assert_eq!(goals["activeGoalId"], "target");
        assert_eq!(goals["goals"][0]["status"], "merged");
        assert_eq!(goals["goals"][1]["taskIds"], json!(["task-1"]));
        let task: Value =
            serde_json::from_str(&fs::read_to_string(task_dir.join("task-1.json")).unwrap())
                .unwrap();
        assert_eq!(task["goalId"], "target");
        assert_eq!(
            repository.read_json(PROJECT_GOALS_PATH).unwrap()["projectGoals"][0]["stageGoalIds"],
            json!(["target"])
        );
    }

    #[test]
    fn sign_off_commits_goal_validation_history_and_goal_state_together() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-goal-signoff-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::create_dir_all(root.join(".omnidesk/evidence")).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"goals":[{"id":"goal-1","title":"Runtime","status":"pending-confirm"}]}"#,
        )
        .unwrap();
        fs::write(
            root.join(GOAL_VALIDATION_PATH),
            r#"{"goal":{"id":"goal-1","status":"verified"}}"#,
        )
        .unwrap();
        fs::write(
            root.join(GOAL_VALIDATION_REPORT_PATH),
            r#"{"goalId":"goal-1","status":"passed"}"#,
        )
        .unwrap();
        sign_off_validation(&root, "goal-1", "now").unwrap();
        let repository = Repository::new(&root);
        assert_eq!(
            repository.read_json(GOALS_PATH).unwrap()["goals"][0]["status"],
            "done"
        );
        assert_eq!(
            repository.read_json(GOAL_VALIDATION_PATH).unwrap()["goal"]["status"],
            "signed-off"
        );
        assert_eq!(
            repository.read_json(GOAL_SIGNOFF_HISTORY_PATH).unwrap()["entries"][0]["goalId"],
            "goal-1"
        );
        assert_eq!(
            fs::read_dir(root.join(".omnidesk/runtime/events"))
                .unwrap()
                .count(),
            1
        );
    }

    #[test]
    fn validation_result_updates_report_criteria_and_goal_in_one_event() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-goal-validation-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"goals":[{"id":"goal-1","status":"planned"}]}"#,
        )
        .unwrap();
        fs::write(root.join(GOAL_VALIDATION_PATH), r#"{"goal":{}}"#).unwrap();
        let report = json!({ "goalId": "goal-1", "status": "passed", "checks": [] });
        record_validation(&root, "goal-1", "Runtime", true, report, "now").unwrap();
        let repository = Repository::new(&root);
        assert_eq!(
            repository.read_json(GOAL_VALIDATION_REPORT_PATH).unwrap()["status"],
            "passed"
        );
        assert_eq!(
            repository.read_json(GOAL_VALIDATION_PATH).unwrap()["goal"]["status"],
            "verified"
        );
        assert_eq!(
            repository.read_json(GOALS_PATH).unwrap()["goals"][0]["status"],
            "pending-confirm"
        );
        assert_eq!(
            fs::read_dir(root.join(".omnidesk/runtime/events"))
                .unwrap()
                .count(),
            1
        );
    }

    #[test]
    fn projects_legacy_goal_schema_without_rewriting_history() {
        let projected = project_goals_schema(json!({
            "schemaVersion": "project-os.goals.v0.1",
            "goals": []
        }));
        assert_eq!(projected["schemaVersion"], GOALS_SCHEMA_VERSION);
        assert_eq!(projected["schemaMigration"]["from"], LEGACY_GOALS_SCHEMA_VERSION);
        assert_eq!(projected["schemaMigration"]["mode"], "read-projection");
    }
}

use crate::runtime::repository::{JsonMutation, Repository};
use serde_json::Value;
use std::path::Path;

const CONVERSATION_DIRECTORY: &str = ".omnidesk/data/conversations";
const CONVERSATION_SCHEMA_VERSION: &str = "omnidesk.conversation.v0.3";
const RECENT_TURN_LIMIT: usize = 120;
const LEGACY_CONVERSATION_SCHEMA_VERSIONS: [&str; 3] = [
    "project-os.desktop-conversation.v0.1",
    "project-os.conversation.v0.3",
    "omnidesk.desktop-conversation.v0.1",
];

fn safe_file_stem(id: &str) -> String {
    id.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn relative_path(id: &str) -> String {
    format!(".omnidesk/data/conversations/{}.json", safe_file_stem(id))
}

pub fn list(root: &Path) -> Result<Vec<Value>, String> {
    let mut conversations = Repository::new(root)
        .list_json_records(CONVERSATION_DIRECTORY)?
        .into_iter()
        .map(|(_, conversation)| recent_window(project_conversation_schema(conversation)))
        .collect::<Vec<_>>();
    conversations.sort_by(|a, b| {
        b.get("updatedAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(a.get("updatedAt").and_then(Value::as_str).unwrap_or(""))
    });
    conversations.truncate(50);
    Ok(conversations)
}

fn recent_window(mut conversation: Value) -> Value {
    let turns = conversation["turns"].as_array().cloned().unwrap_or_default();
    let start = turns.len().saturating_sub(RECENT_TURN_LIMIT);
    conversation["history"] = serde_json::json!({
        "totalTurnCount": turns.len(), "hasMore": start > 0,
        "oldestLoadedTurnId": turns.get(start).and_then(|turn| turn.get("id")),
    });
    conversation["turns"] = Value::Array(turns[start..].to_vec());
    conversation
}

fn require_identity(conversation: &Value, id: &str) -> Result<(), String> {
    if conversation["id"].as_str() != Some(id) {
        return Err("对话编号与存档不匹配，已拒绝覆盖或读取".to_string());
    }
    Ok(())
}

pub fn history(root: &Path, id: &str, before_turn_id: Option<&str>, limit: usize) -> Result<Value, String> {
    if id.trim().is_empty() { return Err("对话 id 不能为空".to_string()); }
    let conversation = Repository::new(root).read_json(&relative_path(id))
        .ok_or_else(|| "对话存档不存在".to_string())?;
    require_identity(&conversation, id)?;
    let turns = conversation["turns"].as_array().cloned().unwrap_or_default();
    let end = match before_turn_id {
        Some(cursor) => turns.iter().position(|turn| turn["id"].as_str() == Some(cursor))
            .ok_or_else(|| "历史消息位置已变化，请重新打开对话".to_string())?,
        None => turns.len(),
    };
    let start = end.saturating_sub(limit.clamp(1, RECENT_TURN_LIMIT));
    Ok(serde_json::json!({
        "conversationId": id, "turns": turns[start..end], "hasMore": start > 0,
        "totalTurnCount": turns.len(),
        "oldestLoadedTurnId": turns.get(start).and_then(|turn| turn.get("id")),
    }))
}

fn project_conversation_schema(mut conversation: Value) -> Value {
    let source_version = conversation
        .get("schemaVersion")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if !LEGACY_CONVERSATION_SCHEMA_VERSIONS.contains(&source_version.as_str()) {
        return conversation;
    }
    let Some(object) = conversation.as_object_mut() else {
        return conversation;
    };
    object.insert(
        "schemaVersion".to_string(),
        Value::String(CONVERSATION_SCHEMA_VERSION.to_string()),
    );
    object.insert(
        "schemaMigration".to_string(),
        serde_json::json!({
            "from": source_version,
            "mode": "read-projection",
            "to": CONVERSATION_SCHEMA_VERSION,
        }),
    );
    conversation
}

pub fn save(
    root: &Path,
    project_path: &str,
    mut conversation: Value,
    timestamp: &str,
) -> Result<Value, String> {
    let id = conversation
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "对话缺少 id".to_string())?
        .to_string();
    let object = conversation
        .as_object_mut()
        .ok_or_else(|| "对话记录必须是 JSON object".to_string())?;
    object.insert("id".to_string(), Value::String(id.clone()));
    object.insert(
        "schemaVersion".to_string(),
        Value::String(CONVERSATION_SCHEMA_VERSION.to_string()),
    );
    object.remove("schemaMigration");
    object.remove("history");
    let updated_at = object
        .get("updatedAt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(timestamp)
        .to_string();
    object.insert("updatedAt".to_string(), Value::String(updated_at));
    object.insert(
        "projectPath".to_string(),
        Value::String(project_path.to_string()),
    );
    Repository::new(root).transaction_with("save-desktop-conversation", |repository| {
        let path = relative_path(&id);
        let mut saved = match repository.read_json(&path) {
            Some(previous) => {
                require_identity(&previous, &id)?;
                previous
            }
            None if root.join(&path).exists() => return Err("对话存档无法读取，已保留原文件".to_string()),
            None => serde_json::json!({}),
        };
        let title = saved.get("title").cloned();
        let mut turns = saved["turns"].as_array().cloned().unwrap_or_default();
        for incoming in conversation["turns"].as_array().into_iter().flatten() {
            let existing = incoming["id"].as_str().and_then(|id| {
                turns.iter().position(|turn| turn["id"].as_str() == Some(id))
            });
            if let Some(index) = existing {
                if let (Some(old), Some(new)) = (turns[index].as_object_mut(), incoming.as_object()) {
                    old.extend(new.clone());
                }
            } else if incoming["id"].is_string() || !turns.contains(incoming) {
                turns.push(incoming.clone());
            }
        }
        saved.as_object_mut().ok_or("对话存档格式无效")?
            .extend(conversation.as_object().unwrap().clone());
        saved["turns"] = Value::Array(turns);
        // A recent window's first user message is not a rename request.
        if let Some(title) = title { saved["title"] = title; }
        saved.as_object_mut().unwrap().remove("history");
        saved.as_object_mut().unwrap().remove("schemaMigration");
        Ok((recent_window(saved.clone()), vec![JsonMutation::upsert(path, saved)]))
    })
}

pub fn delete(root: &Path, id: &str) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("对话 id 不能为空".to_string());
    }
    Repository::new(root).transaction(
        "delete-desktop-conversation",
        &[JsonMutation::delete(relative_path(id))],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn recent_saves_preserve_full_archive_and_pages_are_exclusive() {
        let root = std::env::temp_dir().join(format!("omnidesk-history-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        let turns: Vec<Value> = (0..200).map(|index| json!({ "id": format!("turn-{index}"), "text": format!("original-{index}"), "attachments": [{"name":"retained.png"}], "extra": true })).collect();
        let saved = save(&root, "/project", json!({"id":"history", "title":"original title", "turns":turns}), "first").unwrap();
        assert_eq!(saved["turns"].as_array().unwrap().len(), 120);
        assert_eq!(saved["history"]["totalTurnCount"], 200);
        save(&root, "/project", json!({"id":"history", "title":"window title", "archived":true, "history":{}, "turns":[{"id":"turn-199","text":"updated"},{"id":"turn-200","outcome":"failed","text":"partial"}]}), "second").unwrap();
        let raw = Repository::new(&root).read_json(&relative_path("history")).unwrap();
        assert_eq!(raw["turns"].as_array().unwrap().len(), 201);
        assert_eq!(raw["turns"][0]["text"], "original-0");
        assert_eq!(raw["turns"][199]["attachments"][0]["name"], "retained.png");
        assert_eq!(raw["turns"][199]["extra"], true);
        assert_eq!(raw["title"], "original title");
        assert!(raw.get("history").is_none());
        let page = history(&root, "history", Some("turn-81"), 60).unwrap();
        assert_eq!(page["turns"][0]["id"], "turn-21");
        assert_eq!(page["turns"][59]["id"], "turn-80");
        let first = history(&root, "history", Some("turn-21"), 120).unwrap();
        assert_eq!(first["turns"].as_array().unwrap().len(), 21);
        assert_eq!(first["hasMore"], false);
        assert!(history(&root, "history", Some("missing"), 60).is_err());
        assert_eq!(list(&root).unwrap()[0]["turns"].as_array().unwrap().len(), 120);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_colliding_ids_and_preserves_idless_legacy_turns() {
        let root = std::env::temp_dir().join(format!("omnidesk-history-collision-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        let legacy = json!({"role":"assistant","text":"legacy"});
        save(&root, "/project", json!({"id":"a/b","turns":[legacy.clone()]}), "first").unwrap();
        save(&root, "/project", json!({"id":"a/b","turns":[legacy,{"id":"new","text":"new"}]}), "second").unwrap();
        assert_eq!(history(&root, "a/b", None, 120).unwrap()["turns"].as_array().unwrap().len(), 2);
        assert!(history(&root, "a_b", None, 120).is_err());
        assert!(save(&root, "/project", json!({"id":"a_b","turns":[]}), "third").is_err());
        assert_eq!(history(&root, "a/b", None, 120).unwrap()["turns"][0]["text"], "legacy");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn conversation_service_persists_and_deletes_through_repository() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-conversation-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        save(
            &root,
            "/project",
            json!({ "id": "conversation/1", "turns": [] }),
            "now",
        )
        .unwrap();
        assert_eq!(list(&root).unwrap()[0]["projectPath"], "/project");
        delete(&root, "conversation/1").unwrap();
        assert!(list(&root).unwrap().is_empty());
    }

    #[test]
    fn projects_all_legacy_conversation_versions_without_changing_activity_time() {
        for version in LEGACY_CONVERSATION_SCHEMA_VERSIONS {
            let projected = project_conversation_schema(serde_json::json!({
                "id": "conversation-1",
                "schemaVersion": version,
                "updatedAt": "original",
            }));
            assert_eq!(projected["schemaVersion"], CONVERSATION_SCHEMA_VERSION);
            assert_eq!(projected["schemaMigration"]["from"], version);
            assert_eq!(projected["updatedAt"], "original");
        }
    }

    #[test]
    fn save_uses_the_callers_content_activity_time() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-conversation-time-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let saved = save(
            &root,
            "/project",
            serde_json::json!({
                "id": "conversation-1",
                "updatedAt": "content-time",
                "turns": [],
            }),
            "write-time",
        )
        .unwrap();
        assert_eq!(saved["updatedAt"], "content-time");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn projects_legacy_conversation_schema_without_rewriting_history() {
        let projected = project_conversation_schema(json!({
            "id": "legacy-conversation",
            "schemaVersion": "project-os.desktop-conversation.v0.1"
        }));
        assert_eq!(projected["schemaVersion"], CONVERSATION_SCHEMA_VERSION);
        assert_eq!(
            projected["schemaMigration"]["from"],
            LEGACY_CONVERSATION_SCHEMA_VERSIONS[0]
        );
        assert_eq!(projected["schemaMigration"]["mode"], "read-projection");
    }

    #[test]
    fn saving_a_projected_conversation_persists_only_the_current_schema() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-conversation-migration-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let projected = project_conversation_schema(json!({
            "id": "legacy-conversation",
            "schemaVersion": LEGACY_CONVERSATION_SCHEMA_VERSIONS[0],
        }));
        save(&root, "/project", projected, "now").unwrap();
        let saved = Repository::new(&root)
            .read_json(&relative_path("legacy-conversation"))
            .unwrap();
        assert_eq!(saved["schemaVersion"], CONVERSATION_SCHEMA_VERSION);
        assert!(saved.get("schemaMigration").is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
}

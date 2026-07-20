use crate::runtime::repository::{JsonMutation, Repository};
use serde_json::Value;
use std::path::Path;

const CONVERSATION_DIRECTORY: &str = ".project-os/runs/desktop-conversations";

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
    format!(
        ".project-os/runs/desktop-conversations/{}.json",
        safe_file_stem(id)
    )
}

pub fn list(root: &Path) -> Result<Vec<Value>, String> {
    let mut conversations = Repository::new(root)
        .list_json_records(CONVERSATION_DIRECTORY)?
        .into_iter()
        .map(|(_, conversation)| conversation)
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
    object.insert(
        "schemaVersion".to_string(),
        Value::String("project-os.desktop-conversation.v0.1".to_string()),
    );
    object.insert(
        "updatedAt".to_string(),
        Value::String(timestamp.to_string()),
    );
    object.insert(
        "projectPath".to_string(),
        Value::String(project_path.to_string()),
    );
    Repository::new(root).transaction(
        "save-desktop-conversation",
        &[JsonMutation::upsert(
            relative_path(&id),
            conversation.clone(),
        )],
    )?;
    Ok(conversation)
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
}

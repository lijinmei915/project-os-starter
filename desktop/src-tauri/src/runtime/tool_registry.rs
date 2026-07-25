use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;

pub const TOOL_REGISTRY_SCHEMA: &str = "omnidesk.tool-registry.v0.1";
pub const TOOL_DESCRIPTOR_SCHEMA: &str = "omnidesk.tool-descriptor.v0.1";

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolSource {
    Builtin,
    Mcp,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolRisk {
    ReadOnly,
    Write,
    Execute,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDescriptor {
    pub schema_version: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: ToolSource,
    pub risk: ToolRisk,
    pub requires_approval: bool,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRegistrySnapshot {
    pub schema_version: String,
    pub tools: Vec<ToolDescriptor>,
}

pub fn builtin_registry() -> ToolRegistrySnapshot {
    let path = || {
        json!({
            "type": "object",
            "additionalProperties": false,
            "properties": { "path": { "type": "string" } }
        })
    };
    ToolRegistrySnapshot {
        schema_version: TOOL_REGISTRY_SCHEMA.to_string(),
        tools: vec![
            descriptor("list_files", "List bounded project files.", path()),
            descriptor(
                "read_file",
                "Read bounded UTF-8 project file content.",
                json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": { "path": { "type": "string", "minLength": 1 } },
                    "required": ["path"]
                }),
            ),
            descriptor(
                "search_project",
                "Search bounded text content inside the project.",
                json!({
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "path": { "type": "string" },
                        "query": { "type": "string", "minLength": 1 }
                    },
                    "required": ["query"]
                }),
            ),
            descriptor(
                "git_status",
                "Read the bounded Git working tree summary.",
                json!({ "type": "object", "additionalProperties": false }),
            ),
        ],
    }
}

pub fn find_builtin(name: &str) -> Option<ToolDescriptor> {
    builtin_registry()
        .tools
        .into_iter()
        .find(|tool| tool.name == name.trim())
}

pub fn validate_arguments(tool: &ToolDescriptor, arguments: &Value) -> Result<(), String> {
    validate_descriptor(tool)?;
    let values = arguments
        .as_object()
        .ok_or_else(|| format!("工具 {} 的参数必须是对象", tool.name))?;
    let properties = tool
        .input_schema
        .get("properties")
        .and_then(Value::as_object);
    let required = tool
        .input_schema
        .get("required")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect::<HashSet<_>>();

    for key in &required {
        if !values.contains_key(*key) {
            return Err(format!("工具 {} 缺少必填参数：{key}", tool.name));
        }
    }
    for (key, value) in values {
        let property = properties
            .and_then(|items| items.get(key))
            .ok_or_else(|| format!("工具 {} 不接受参数：{key}", tool.name))?;
        match property.get("type").and_then(Value::as_str) {
            Some("string") => {
                let text = value
                    .as_str()
                    .ok_or_else(|| format!("工具 {} 的参数 {key} 必须是字符串", tool.name))?;
                let minimum = property
                    .get("minLength")
                    .and_then(Value::as_u64)
                    .unwrap_or(0) as usize;
                if text.chars().count() < minimum {
                    return Err(format!("工具 {} 的参数 {key} 长度不足", tool.name));
                }
            }
            Some(other) => {
                return Err(format!(
                    "工具 {} 使用了不受支持的参数类型：{other}",
                    tool.name
                ));
            }
            None => return Err(format!("工具 {} 的参数 {key} 缺少类型声明", tool.name)),
        }
    }
    Ok(())
}

pub fn validate_registry(registry: &ToolRegistrySnapshot) -> Result<(), String> {
    if registry.schema_version != TOOL_REGISTRY_SCHEMA {
        return Err("工具注册表版本不受支持".to_string());
    }
    let mut names = HashSet::new();
    for tool in &registry.tools {
        validate_descriptor(tool)?;
        if !names.insert(tool.name.as_str()) {
            return Err(format!("工具名称重复：{}", tool.name));
        }
    }
    Ok(())
}

pub fn validate_descriptor(tool: &ToolDescriptor) -> Result<(), String> {
    if tool.schema_version != TOOL_DESCRIPTOR_SCHEMA {
        return Err(format!("工具 {} 的描述符版本不受支持", tool.name));
    }
    if !valid_tool_name(&tool.name) || tool.version.trim().is_empty() {
        return Err("工具名称或版本无效".to_string());
    }
    if tool.input_schema.get("type").and_then(Value::as_str) != Some("object")
        || tool
            .input_schema
            .get("additionalProperties")
            .and_then(Value::as_bool)
            != Some(false)
    {
        return Err(format!("工具 {} 必须使用封闭对象参数 schema", tool.name));
    }
    if tool.source == ToolSource::Mcp && !tool.requires_approval {
        return Err(format!("MCP 工具 {} 必须声明审批边界", tool.name));
    }
    if tool.risk != ToolRisk::ReadOnly && !tool.requires_approval {
        return Err(format!("写入或执行工具 {} 必须要求审批", tool.name));
    }
    Ok(())
}

fn descriptor(name: &str, description: &str, input_schema: Value) -> ToolDescriptor {
    ToolDescriptor {
        schema_version: TOOL_DESCRIPTOR_SCHEMA.to_string(),
        name: name.to_string(),
        version: "1.0.0".to_string(),
        description: description.to_string(),
        source: ToolSource::Builtin,
        risk: ToolRisk::ReadOnly,
        requires_approval: false,
        input_schema,
    }
}

fn valid_tool_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_registry_is_versioned_unique_and_schema_bounded() {
        let registry = builtin_registry();
        validate_registry(&registry).unwrap();
        assert_eq!(registry.tools.len(), 4);
        assert!(registry
            .tools
            .iter()
            .all(|tool| tool.source == ToolSource::Builtin
                && tool.risk == ToolRisk::ReadOnly
                && !tool.requires_approval));
    }

    #[test]
    fn external_or_mutating_tools_cannot_omit_approval() {
        let mut tool = descriptor(
            "external_read",
            "External read.",
            json!({ "type": "object", "additionalProperties": false }),
        );
        tool.source = ToolSource::Mcp;
        assert!(validate_descriptor(&tool).is_err());
        tool.requires_approval = true;
        assert!(validate_descriptor(&tool).is_ok());
        tool.source = ToolSource::Builtin;
        tool.risk = ToolRisk::Write;
        tool.requires_approval = false;
        assert!(validate_descriptor(&tool).is_err());
    }

    #[test]
    fn rejects_open_argument_schemas_and_duplicate_names() {
        let mut registry = builtin_registry();
        registry.tools[0].input_schema = json!({ "type": "object" });
        assert!(validate_registry(&registry).is_err());

        let mut registry = builtin_registry();
        registry.tools.push(registry.tools[0].clone());
        assert!(validate_registry(&registry).is_err());
    }

    #[test]
    fn validates_arguments_against_the_registered_closed_schema() {
        let read = find_builtin("read_file").unwrap();
        assert!(validate_arguments(&read, &json!({ "path": "README.md" })).is_ok());
        assert!(validate_arguments(&read, &json!({})).is_err());
        assert!(validate_arguments(&read, &json!({ "path": "README.md", "extra": true })).is_err());
        assert!(validate_arguments(&read, &json!({ "path": 42 })).is_err());

        let search = find_builtin("search_project").unwrap();
        assert!(validate_arguments(&search, &json!({ "query": "agent" })).is_ok());
        assert!(validate_arguments(&search, &json!({ "query": "" })).is_err());

        let status = find_builtin("git_status").unwrap();
        assert!(validate_arguments(&status, &json!({})).is_ok());
        assert!(validate_arguments(&status, &json!({ "path": "." })).is_err());
    }
}

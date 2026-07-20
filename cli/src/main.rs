use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use std::time::{SystemTime, UNIX_EPOCH};

#[path = "../../desktop/src-tauri/src/runtime/governance.rs"]
mod governance;
#[allow(dead_code)]
#[path = "../../desktop/src-tauri/src/runtime/repository.rs"]
pub(crate) mod repository;
#[allow(dead_code)]
#[path = "../../desktop/src-tauri/src/runtime/state_namespace.rs"]
pub(crate) mod state_namespace;

// Shared Runtime modules resolve through this shape in the Desktop crate.
// Keep the frozen CLI bridge source-compatible until the CLI is retired.
mod runtime {
    pub(crate) use crate::{repository, state_namespace};
}

#[derive(Debug, Clone, Copy)]
enum ProjectCommand {
    Context,
    Scan,
    Check,
    Report,
    Recommend,
    Run,
}

impl ProjectCommand {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "context" => Some(Self::Context),
            "scan" => Some(Self::Scan),
            "check" => Some(Self::Check),
            "report" => Some(Self::Report),
            "recommend" => Some(Self::Recommend),
            "run" => Some(Self::Run),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Context => "context",
            Self::Scan => "scan",
            Self::Check => "check",
            Self::Report => "report",
            Self::Recommend => "recommend",
            Self::Run => "run",
        }
    }

    fn intent(self) -> &'static str {
        match self {
            Self::Context => "scan",
            Self::Scan => "scan",
            Self::Check => "check",
            Self::Report => "report",
            Self::Recommend => "recommend",
            Self::Run => "validate",
        }
    }
}

#[derive(Debug)]
struct CliArgs {
    command: ProjectCommand,
    target: PathBuf,
    runtime_root: PathBuf,
    trigger_source: String,
    output: OutputMode,
    persist: PersistMode,
    passthrough: Vec<String>,
    config: ProjectOsConfig,
    stale_lock_seconds_override: Option<u64>,
    output_source: String,
    persist_source: String,
    stale_lock_seconds_source: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OutputMode {
    File,
    Json,
    Both,
    Report,
}

impl OutputMode {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "file" => Some(Self::File),
            "json" => Some(Self::Json),
            "both" => Some(Self::Both),
            "report" => Some(Self::Report),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Json => "json",
            Self::Both => "both",
            Self::Report => "report",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PersistMode {
    Auto,
    None,
    Full,
}

impl PersistMode {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "auto" => Some(Self::Auto),
            "none" => Some(Self::None),
            "full" => Some(Self::Full),
            "always" => Some(Self::Full),
            "never" => Some(Self::None),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::None => "none",
            Self::Full => "full",
        }
    }
}

#[derive(Debug, Clone)]
struct ProjectOsConfig {
    default_persist: PersistMode,
    default_output: OutputMode,
    lock_writes: bool,
    stale_lock_seconds: u64,
    default_persist_source: String,
    default_output_source: String,
    lock_writes_source: String,
    stale_lock_seconds_source: String,
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => ExitCode::from(code),
        Err(err) => {
            eprintln!("project-os: {err}");
            ExitCode::from(2)
        }
    }
}

fn run() -> Result<u8, String> {
    if let Some(code) = try_run_config_command()? {
        return Ok(code);
    }
    if let Some(code) = try_run_state_command()? {
        return Ok(code);
    }

    let args = parse_args()?;
    let target = canonical_dir(&args.target)?;
    let _lock = if should_lock(&args) {
        Some(ProjectLock::acquire(
            &target,
            args.stale_lock_seconds_override
                .unwrap_or(args.config.stale_lock_seconds),
        )?)
    } else {
        None
    };
    let context = build_entry_context(args.command, &target, &args.trigger_source)?;
    validate_entry_context(&context)?;
    let persist_context = should_persist_context(&args);
    let context_path = if persist_context {
        Some(write_entry_context(&context, &target)?)
    } else {
        None
    };

    if matches!(args.command, ProjectCommand::Context) {
        emit_result(&args, &target, context_path.as_deref(), 0, None);
        return Ok(0);
    }

    let status = run_governance_action(&args, &target)?;
    emit_result(
        &args,
        &target,
        context_path.as_deref(),
        status,
        Some(legacy_output_paths(args.command)),
    );
    Ok(status)
}

fn parse_args() -> Result<CliArgs, String> {
    let mut raw: Vec<String> = env::args().skip(1).collect();
    if raw.is_empty() || raw[0] == "-h" || raw[0] == "--help" {
        print_usage();
        std::process::exit(0);
    }

    let command = ProjectCommand::parse(&raw.remove(0))
        .ok_or_else(|| "unknown command. Run `project-os --help`.".to_string())?;

    let mut target = PathBuf::from(".");
    let mut runtime_root = env::var_os("PROJECT_OS_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let mut trigger_source =
        env::var("PROJECT_OS_TRIGGER_SOURCE").unwrap_or_else(|_| "manual-cli".to_string());
    let mut output: Option<OutputMode> = None;
    let mut persist: Option<PersistMode> = None;
    let mut stale_lock_seconds_override: Option<u64> = None;
    let mut passthrough = Vec::new();
    let mut target_set = false;
    let mut index = 0;

    while index < raw.len() {
        match raw[index].as_str() {
            "--runtime-root" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--runtime-root requires a value".to_string())?;
                runtime_root = PathBuf::from(value);
                index += 2;
            }
            "--trigger-source" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--trigger-source requires a value".to_string())?;
                trigger_source = value.clone();
                index += 2;
            }
            "--output" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--output requires file, json, both, or report".to_string())?;
                output =
                    Some(OutputMode::parse(value).ok_or_else(|| {
                        "--output requires file, json, both, or report".to_string()
                    })?);
                index += 2;
            }
            "--persist" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--persist requires auto, none, or full".to_string())?;
                persist = Some(
                    PersistMode::parse(value)
                        .ok_or_else(|| "--persist requires auto, none, or full".to_string())?,
                );
                index += 2;
            }
            "--stale-lock-seconds" => {
                let value = raw.get(index + 1).ok_or_else(|| {
                    "--stale-lock-seconds requires a non-negative integer".to_string()
                })?;
                stale_lock_seconds_override = Some(value.parse::<u64>().map_err(|_| {
                    "--stale-lock-seconds requires a non-negative integer".to_string()
                })?);
                index += 2;
            }
            "--" => {
                passthrough.extend(raw[(index + 1)..].iter().cloned());
                break;
            }
            value if value.starts_with('-') => {
                passthrough.push(raw[index].clone());
                index += 1;
            }
            value if !target_set => {
                target = PathBuf::from(value);
                target_set = true;
                index += 1;
            }
            _ => {
                passthrough.push(raw[index].clone());
                index += 1;
            }
        }
    }

    let config = load_config(&target)?;
    let output_source = if output.is_some() {
        "command-line".to_string()
    } else {
        config.default_output_source.clone()
    };
    let persist_source = if persist.is_some() {
        "command-line".to_string()
    } else {
        config.default_persist_source.clone()
    };
    let stale_lock_seconds_source = if stale_lock_seconds_override.is_some() {
        "command-line".to_string()
    } else {
        config.stale_lock_seconds_source.clone()
    };

    Ok(CliArgs {
        command,
        target,
        runtime_root,
        trigger_source,
        output: output.unwrap_or(config.default_output),
        persist: persist.unwrap_or(config.default_persist),
        passthrough,
        config,
        stale_lock_seconds_override,
        output_source,
        persist_source,
        stale_lock_seconds_source,
    })
}

fn print_usage() {
    println!(
        "Usage:\n  project-os <command> [target] [--runtime-root path] [--trigger-source source] [--persist auto|none|full] [--output file|json|both|report] [--stale-lock-seconds n] [-- extra legacy args]\n  project-os config init [--global] [--path path]\n  project-os state sync [target] [--set key=value] [--output json]\n\nCommands:\n  config     Manage Project OS config\n  state      Validate and synchronize .project-os/state.json\n  context    Write Entry Context only\n  scan       Run check + recommend + runtime probe\n  check      Print AI project score\n  report     Write AI project reports\n  recommend  Write next-step recommendations\n  run        Run validation runner\n\nExamples:\n  project-os config init --global\n  project-os state sync . --set phase=stabilizing\n  project-os context . --output json --persist none\n  project-os report . --runtime-root /path/to/project-os --output report\n  project-os scan . --runtime-root /path/to/project-os --trigger-source desktop"
    );
}

fn canonical_dir(path: &Path) -> Result<PathBuf, String> {
    if !path.is_dir() {
        return Err(format!("target directory not found: {}", path.display()));
    }
    fs::canonicalize(path).map_err(|err| format!("cannot resolve {}: {err}", path.display()))
}

fn try_run_config_command() -> Result<Option<u8>, String> {
    let raw: Vec<String> = env::args().skip(1).collect();
    if raw.first().map(|value| value.as_str()) != Some("config") {
        return Ok(None);
    }
    if raw.get(1).map(|value| value.as_str()) != Some("init") {
        return Err(
            "unknown config command. Use `project-os config init [--global] [--path path]`."
                .to_string(),
        );
    }

    let mut global = false;
    let mut path: Option<PathBuf> = None;
    let mut index = 2;
    while index < raw.len() {
        match raw[index].as_str() {
            "--global" => {
                global = true;
                index += 1;
            }
            "--path" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--path requires a value".to_string())?;
                path = Some(PathBuf::from(value));
                index += 2;
            }
            "-h" | "--help" => {
                println!("Usage:\n  project-os config init [--global] [--path path]");
                return Ok(Some(0));
            }
            value => return Err(format!("unknown config init option: {value}")),
        }
    }

    let config_path = match path {
        Some(path) => path,
        None if global => default_global_config_path()?,
        None => PathBuf::from(".project-os").join("config.json"),
    };
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("cannot create {}: {err}", parent.display()))?;
    }
    if config_path.exists() {
        validate_config_file(&config_path)?;
        println!(
            "Project OS config already exists: {}",
            config_path.display()
        );
        return Ok(Some(0));
    }
    repository::write_atomic(&config_path, default_config_json().as_bytes())
        .map_err(|err| format!("cannot write {}: {err}", config_path.display()))?;
    validate_config_file(&config_path)?;
    println!("Project OS config created: {}", config_path.display());
    Ok(Some(0))
}

fn try_run_state_command() -> Result<Option<u8>, String> {
    let raw: Vec<String> = env::args().skip(1).collect();
    if raw.first().map(|value| value.as_str()) != Some("state") {
        return Ok(None);
    }
    if raw.get(1).map(|value| value.as_str()) != Some("sync") {
        return Err("unknown state command. Use `project-os state sync [target] [--set key=value] [--output json]`.".to_string());
    }

    let mut target = PathBuf::from(".");
    let mut output = OutputMode::File;
    let mut sets: Vec<(String, String)> = Vec::new();
    let mut target_set = false;
    let mut index = 2;
    while index < raw.len() {
        match raw[index].as_str() {
            "--set" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--set requires key=value".to_string())?;
                let Some((key, val)) = value.split_once('=') else {
                    return Err("--set requires key=value".to_string());
                };
                sets.push((key.to_string(), val.to_string()));
                index += 2;
            }
            "--output" => {
                let value = raw
                    .get(index + 1)
                    .ok_or_else(|| "--output requires file or json".to_string())?;
                output = OutputMode::parse(value)
                    .ok_or_else(|| "--output requires file or json".to_string())?;
                index += 2;
            }
            "-h" | "--help" => {
                println!(
                    "Usage:\n  project-os state sync [target] [--set key=value] [--output json]"
                );
                return Ok(Some(0));
            }
            value if value.starts_with('-') => {
                return Err(format!("unknown state sync option: {value}"))
            }
            value if !target_set => {
                target = PathBuf::from(value);
                target_set = true;
                index += 1;
            }
            value => return Err(format!("unexpected state sync argument: {value}")),
        }
    }

    let target = canonical_dir(&target)?;
    let config = load_config(&target)?;
    let _lock = if config.lock_writes {
        Some(ProjectLock::acquire(&target, config.stale_lock_seconds)?)
    } else {
        None
    };
    let state_path = target.join(".project-os").join("state.json");
    let mut state = read_state_json(&target)?;
    for (key, value) in sets {
        apply_state_set(&mut state, &key, &value)?;
    }
    validate_state_value(&state_path, &state)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("system clock error: {err}"))?;
    let bundle_id = format!("{}-{}-state", now.as_secs(), std::process::id());
    let bundle_relative = format!(".project-os/state-bundles/{bundle_id}.json");
    let bundle = state_bundle_value(&bundle_id, now.as_secs(), &state)?;
    repository::Repository::new(&target).transaction(
        "sync-cli-state",
        &[
            repository::JsonMutation::upsert(".project-os/state.json", state),
            repository::JsonMutation::upsert(&bundle_relative, bundle),
        ],
    )?;
    let bundle_path = target.join(&bundle_relative);

    if output == OutputMode::Json {
        println!(
            "{{\n  \"schemaVersion\": \"project-os.state-sync-result.v0.1\",\n  \"status\": \"passed\",\n  \"state\": \"{}\",\n  \"bundle\": \"{}\"\n}}",
            json_escape(&state_path.display().to_string()),
            json_escape(&bundle_path.display().to_string())
        );
    } else {
        println!("Project OS state synced: {}", state_path.display());
        println!("Project OS state bundle: {}", bundle_path.display());
    }
    Ok(Some(0))
}

fn read_state_json(target: &Path) -> Result<serde_json::Value, String> {
    let path = target.join(".project-os").join("state.json");
    let value = repository::Repository::new(target)
        .read_json(".project-os/state.json")
        .ok_or_else(|| format!("cannot read Project OS state {}", path.display()))?;
    validate_state_value(&path, &value)?;
    Ok(value)
}

fn validate_state_value(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let object = value.as_object().ok_or_else(|| {
        format!(
            "invalid Project OS state {}: root must be object",
            path.display()
        )
    })?;
    let phase = object
        .get("phase")
        .and_then(|value| value.as_str())
        .ok_or_else(|| format!("invalid Project OS state {}: missing phase", path.display()))?;
    if !matches!(
        phase,
        "init" | "stabilizing" | "shipping" | "maintenance" | "archived"
    ) {
        return Err(format!(
            "invalid Project OS state {}: phase must be init, stabilizing, shipping, maintenance, or archived",
            path.display()
        ));
    }
    for key in ["name", "description", "stage"] {
        if object.get(key).is_some_and(|value| !value.is_string()) {
            return Err(format!(
                "invalid Project OS state {}: {key} must be string",
                path.display()
            ));
        }
    }
    for key in ["done", "doing", "blocked", "next"] {
        if let Some(items) = object.get("status").and_then(|status| status.get(key)) {
            let Some(items) = items.as_array() else {
                return Err(format!(
                    "invalid Project OS state {}: status.{key} must be array",
                    path.display()
                ));
            };
            if items.iter().any(|item| !item.is_string()) {
                return Err(format!(
                    "invalid Project OS state {}: status.{key} must contain strings",
                    path.display()
                ));
            }
        }
    }
    Ok(())
}

fn apply_state_set(state: &mut serde_json::Value, key: &str, value: &str) -> Result<(), String> {
    let Some(object) = state.as_object_mut() else {
        return Err("state root must be object".to_string());
    };
    match key {
        "name" | "description" | "stage" => {
            object.insert(
                key.to_string(),
                serde_json::Value::String(value.to_string()),
            );
        }
        "phase" => {
            if !matches!(
                value,
                "init" | "stabilizing" | "shipping" | "maintenance" | "archived"
            ) {
                return Err(
                    "phase must be init, stabilizing, shipping, maintenance, or archived"
                        .to_string(),
                );
            }
            object.insert(
                key.to_string(),
                serde_json::Value::String(value.to_string()),
            );
        }
        _ => return Err(format!("unsupported state field for --set: {key}")),
    }
    Ok(())
}

fn state_bundle_value(
    bundle_id: &str,
    timestamp_seconds: u64,
    state: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "schemaVersion": "project-os.state-bundle.v0.1",
        "bundleId": bundle_id,
        "createdAt": iso_like_utc(timestamp_seconds),
        "state": state,
    }))
}

fn default_global_config_path() -> Result<PathBuf, String> {
    env::var_os("PROJECT_OS_GLOBAL_CONFIG")
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("HOME")
                .map(PathBuf::from)
                .map(|home| home.join(".project-os").join("config.json"))
        })
        .ok_or_else(|| {
            "cannot resolve global config path: set HOME or PROJECT_OS_GLOBAL_CONFIG".to_string()
        })
}

fn default_config_json() -> &'static str {
    "{\n  \"schemaVersion\": \"project-os.config.v0.1\",\n  \"cli\": {\n    \"defaultPersist\": \"auto\",\n    \"defaultOutput\": \"file\",\n    \"lockWrites\": true,\n    \"staleLockSeconds\": 900\n  },\n  \"retention\": {\n    \"entryContexts\": 50,\n    \"runs\": 20\n  }\n}\n"
}

fn load_config(target: &Path) -> Result<ProjectOsConfig, String> {
    let mut config = ProjectOsConfig {
        default_persist: env::var("PROJECT_OS_PERSIST")
            .ok()
            .and_then(|value| PersistMode::parse(&value))
            .unwrap_or(PersistMode::Auto),
        default_output: env::var("PROJECT_OS_OUTPUT")
            .ok()
            .and_then(|value| OutputMode::parse(&value))
            .unwrap_or(OutputMode::File),
        lock_writes: env::var("PROJECT_OS_LOCK_WRITES")
            .ok()
            .map(|value| value != "0" && value != "false")
            .unwrap_or(true),
        stale_lock_seconds: env::var("PROJECT_OS_STALE_LOCK_SECONDS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(900),
        default_persist_source: if env::var_os("PROJECT_OS_PERSIST").is_some() {
            "environment".to_string()
        } else {
            "default".to_string()
        },
        default_output_source: if env::var_os("PROJECT_OS_OUTPUT").is_some() {
            "environment".to_string()
        } else {
            "default".to_string()
        },
        lock_writes_source: if env::var_os("PROJECT_OS_LOCK_WRITES").is_some() {
            "environment".to_string()
        } else {
            "default".to_string()
        },
        stale_lock_seconds_source: if env::var_os("PROJECT_OS_STALE_LOCK_SECONDS").is_some() {
            "environment".to_string()
        } else {
            "default".to_string()
        },
    };

    if let Some(path) = global_config_path() {
        apply_config_file(&mut config, &path, "global-config")?;
    }
    apply_config_file(
        &mut config,
        &target.join(".project-os").join("config.json"),
        "project-config",
    )?;

    Ok(config)
}

fn global_config_path() -> Option<PathBuf> {
    if let Some(path) = env::var_os("PROJECT_OS_GLOBAL_CONFIG").map(PathBuf::from) {
        return Some(path);
    }
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join(".project-os").join("config.json"))
}

fn apply_config_file(
    config: &mut ProjectOsConfig,
    path: &Path,
    source: &str,
) -> Result<(), String> {
    let Ok(text) = fs::read_to_string(path) else {
        return Ok(());
    };
    let value = serde_json::from_str::<serde_json::Value>(&text)
        .map_err(|err| format!("invalid Project OS config JSON {}: {err}", path.display()))?;
    validate_config_value(path, &value)?;

    if let Some(cli) = value.get("cli") {
        if let Some(default_persist) = cli.get("defaultPersist").and_then(|value| value.as_str()) {
            if let Some(mode) = PersistMode::parse(default_persist) {
                config.default_persist = mode;
                config.default_persist_source = source.to_string();
            }
        }
        if let Some(default_output) = cli.get("defaultOutput").and_then(|value| value.as_str()) {
            if let Some(mode) = OutputMode::parse(default_output) {
                config.default_output = mode;
                config.default_output_source = source.to_string();
            }
        }
        if let Some(lock_writes) = cli.get("lockWrites").and_then(|value| value.as_bool()) {
            config.lock_writes = lock_writes;
            config.lock_writes_source = source.to_string();
        }
        if let Some(stale_lock_seconds) =
            cli.get("staleLockSeconds").and_then(|value| value.as_u64())
        {
            config.stale_lock_seconds = stale_lock_seconds;
            config.stale_lock_seconds_source = source.to_string();
        }
    }
    Ok(())
}

fn validate_config_file(path: &Path) -> Result<(), String> {
    let text = fs::read_to_string(path)
        .map_err(|err| format!("cannot read Project OS config {}: {err}", path.display()))?;
    let value = serde_json::from_str::<serde_json::Value>(&text)
        .map_err(|err| format!("invalid Project OS config JSON {}: {err}", path.display()))?;
    validate_config_value(path, &value)
}

fn validate_config_value(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let object = value.as_object().ok_or_else(|| {
        format!(
            "invalid Project OS config {}: root must be object",
            path.display()
        )
    })?;
    if object.get("schemaVersion").and_then(|value| value.as_str())
        != Some("project-os.config.v0.1")
    {
        return Err(format!(
            "invalid Project OS config {}: schemaVersion must be project-os.config.v0.1",
            path.display()
        ));
    }
    if let Some(cli) = object.get("cli") {
        let cli = cli.as_object().ok_or_else(|| {
            format!(
                "invalid Project OS config {}: cli must be object",
                path.display()
            )
        })?;
        if let Some(value) = cli.get("defaultPersist").and_then(|value| value.as_str()) {
            if PersistMode::parse(value).is_none() {
                return Err(format!(
                    "invalid Project OS config {}: cli.defaultPersist must be auto, none, or full",
                    path.display()
                ));
            }
        }
        if let Some(value) = cli.get("defaultOutput").and_then(|value| value.as_str()) {
            if OutputMode::parse(value).is_none() {
                return Err(format!("invalid Project OS config {}: cli.defaultOutput must be file, json, both, or report", path.display()));
            }
        }
        if cli
            .get("lockWrites")
            .is_some_and(|value| !value.is_boolean())
        {
            return Err(format!(
                "invalid Project OS config {}: cli.lockWrites must be boolean",
                path.display()
            ));
        }
        if cli
            .get("staleLockSeconds")
            .is_some_and(|value| !value.is_u64())
        {
            return Err(format!(
                "invalid Project OS config {}: cli.staleLockSeconds must be a non-negative integer",
                path.display()
            ));
        }
    }
    Ok(())
}

#[derive(Debug)]
struct EntryContext {
    request_id: String,
    created_at: String,
    intent: &'static str,
    project_path: String,
    trigger_source: String,
    content: String,
}

fn build_entry_context(
    command: ProjectCommand,
    target: &Path,
    trigger_source: &str,
) -> Result<EntryContext, String> {
    if !matches!(
        trigger_source,
        "desktop" | "manual-cli" | "ci" | "gateway" | "api" | "ide" | "automation"
    ) {
        return Err(format!("unsupported trigger source: {trigger_source}"));
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("system clock error: {err}"))?;
    let request_id = format!(
        "{}-{}-{}",
        now.as_secs(),
        std::process::id(),
        command.as_str()
    );
    let created_at = iso_like_utc(now.as_secs());
    let user = env::var("USER")
        .or_else(|_| env::var("USERNAME"))
        .unwrap_or_else(|_| "local".to_string());
    let branch = git_output(target, &["rev-parse", "--abbrev-ref", "HEAD"]);
    let commit = git_output(target, &["rev-parse", "HEAD"]);

    let project_path = target.display().to_string();
    let mut project_fields = format!("    \"path\": \"{}\"", json_escape(&project_path));
    if let Some(branch) = branch {
        project_fields.push_str(&format!(",\n    \"branch\": \"{}\"", json_escape(&branch)));
    }
    if let Some(commit) = commit {
        project_fields.push_str(&format!(",\n    \"commit\": \"{}\"", json_escape(&commit)));
    }

    let intent = command.intent();
    let content = format!(
        "{{\n  \"schemaVersion\": \"project-os.entry-context.v0.1\",\n  \"entry\": \"cli\",\n  \"mode\": \"readonly\",\n  \"intent\": \"{}\",\n  \"actor\": {{\n    \"type\": \"user\",\n    \"name\": \"{}\"\n  }},\n  \"project\": {{\n{}\n  }},\n  \"request\": {{\n    \"id\": \"{}\",\n    \"createdAt\": \"{}\",\n    \"source\": \"project-os\"\n  }},\n  \"trigger\": {{\n    \"source\": \"{}\"\n  }},\n  \"permissions\": {{\n    \"allowRead\": true,\n    \"allowWrite\": false,\n    \"allowNetwork\": false,\n    \"allowShell\": false,\n    \"policy\": \"readonly-local\"\n  }},\n  \"trace\": {{\n    \"gatewayRequestId\": \"{}\"\n  }}\n}}\n",
        intent,
        json_escape(&user),
        project_fields,
        json_escape(&request_id),
        json_escape(&created_at),
        json_escape(trigger_source),
        json_escape(&request_id)
    );

    Ok(EntryContext {
        request_id,
        created_at,
        intent,
        project_path,
        trigger_source: trigger_source.to_string(),
        content,
    })
}

fn write_entry_context(context: &EntryContext, target: &Path) -> Result<PathBuf, String> {
    let context_dir = target.join(".project-os").join("entry-contexts");
    let context_path = context_dir.join(format!("{}.json", context.request_id));
    repository::write_atomic(&context_path, context.content.as_bytes())
        .map_err(|err| format!("cannot write {}: {err}", context_path.display()))?;
    Ok(context_path)
}

fn should_persist_context(args: &CliArgs) -> bool {
    match args.persist {
        PersistMode::Full => true,
        PersistMode::None => false,
        PersistMode::Auto => !matches!(
            args.trigger_source.as_str(),
            "ci" | "gateway" | "api" | "automation"
        ),
    }
}

fn should_lock(args: &CliArgs) -> bool {
    args.config.lock_writes
        && (should_persist_context(args) || !matches!(args.command, ProjectCommand::Context))
}

struct ProjectLock {
    path: PathBuf,
}

impl ProjectLock {
    fn acquire(target: &Path, stale_lock_seconds: u64) -> Result<Self, String> {
        let lock_dir = target.join(".project-os").join("locks");
        fs::create_dir_all(&lock_dir)
            .map_err(|err| format!("cannot create {}: {err}", lock_dir.display()))?;
        let lock_path = lock_dir.join("project-os.lock");
        clear_stale_lock(&lock_path, stale_lock_seconds)?;
        let content = format!("pid={}\n", std::process::id());
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
        {
            Ok(mut file) => {
                use std::io::Write;
                file.write_all(content.as_bytes())
                    .map_err(|err| format!("cannot write {}: {err}", lock_path.display()))?;
                Ok(Self { path: lock_path })
            }
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => Err(format!(
                "project is locked by another Project OS process: {}",
                lock_path.display()
            )),
            Err(err) => Err(format!("cannot create lock {}: {err}", lock_path.display())),
        }
    }
}

fn clear_stale_lock(lock_path: &Path, stale_lock_seconds: u64) -> Result<(), String> {
    if stale_lock_seconds == 0 || !lock_path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(lock_path)
        .map_err(|err| format!("cannot inspect lock {}: {err}", lock_path.display()))?;
    let modified = metadata
        .modified()
        .map_err(|err| format!("cannot read lock mtime {}: {err}", lock_path.display()))?;
    let age = SystemTime::now()
        .duration_since(modified)
        .unwrap_or_default()
        .as_secs();

    if age >= stale_lock_seconds {
        fs::remove_file(lock_path)
            .map_err(|err| format!("cannot remove stale lock {}: {err}", lock_path.display()))?;
    }

    Ok(())
}

impl Drop for ProjectLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn validate_entry_context(context: &EntryContext) -> Result<(), String> {
    if context.request_id.is_empty() {
        return Err("Entry Context validation failed: request.id is empty".to_string());
    }
    if !context.created_at.contains('T') || !context.created_at.ends_with('Z') {
        return Err(
            "Entry Context validation failed: request.createdAt is not UTC date-time".to_string(),
        );
    }
    if context.project_path.is_empty() {
        return Err("Entry Context validation failed: project.path is empty".to_string());
    }
    if !matches!(
        context.intent,
        "scan" | "check" | "recommend" | "report" | "plan" | "draft" | "apply" | "validate"
    ) {
        return Err(format!(
            "Entry Context validation failed: invalid intent {}",
            context.intent
        ));
    }
    if !matches!(
        context.trigger_source.as_str(),
        "desktop" | "manual-cli" | "ci" | "gateway" | "api" | "ide" | "automation"
    ) {
        return Err(format!(
            "Entry Context validation failed: invalid trigger source {}",
            context.trigger_source
        ));
    }
    Ok(())
}

fn emit_result(
    args: &CliArgs,
    target: &Path,
    context_path: Option<&Path>,
    status: u8,
    outputs: Option<Vec<(&'static str, &'static str)>>,
) {
    if args.output == OutputMode::File {
        if let Some(path) = context_path {
            println!("Entry context: {}", path.display());
        }
        return;
    }

    let output_paths = outputs.unwrap_or_default();
    let outputs_json = output_paths
        .iter()
        .into_iter()
        .map(|(key, value)| format!("    \"{}\": \"{}\"", json_escape(key), json_escape(value)))
        .collect::<Vec<_>>()
        .join(",\n");
    let outputs_block = if outputs_json.is_empty() {
        "{}".to_string()
    } else {
        format!("{{\n{}\n  }}", outputs_json)
    };
    let entry_context_json = context_path
        .map(|path| format!("\"{}\"", json_escape(&path.display().to_string())))
        .unwrap_or_else(|| "null".to_string());
    let embedded = if args.output == OutputMode::Report {
        format!(
            ",\n  \"embedded\": {}",
            embedded_outputs(target, &output_paths)
        )
    } else {
        String::new()
    };
    let lock_seconds = args
        .stale_lock_seconds_override
        .unwrap_or(args.config.stale_lock_seconds);
    print!(
        "{{\n  \"schemaVersion\": \"project-os.cli-result.v0.1\",\n  \"status\": \"{}\",\n  \"exitCode\": {},\n  \"entryContext\": {},\n  \"command\": \"{}\",\n  \"triggerSource\": \"{}\",\n  \"persist\": \"{}\",\n  \"outputMode\": \"{}\",\n  \"config\": {{\n    \"values\": {{\n      \"persist\": \"{}\",\n      \"outputMode\": \"{}\",\n      \"lockWrites\": {},\n      \"staleLockSeconds\": {}\n    }},\n    \"sources\": {{\n      \"persist\": \"{}\",\n      \"outputMode\": \"{}\",\n      \"lockWrites\": \"{}\",\n      \"staleLockSeconds\": \"{}\"\n    }}\n  }},\n  \"outputs\": {}{}\n}}\n",
        if status == 0 { "passed" } else { "failed" },
        status,
        entry_context_json,
        json_escape(args.command.as_str()),
        json_escape(&args.trigger_source),
        args.persist.as_str(),
        args.output.as_str(),
        args.persist.as_str(),
        args.output.as_str(),
        if args.config.lock_writes { "true" } else { "false" },
        lock_seconds,
        json_escape(&args.persist_source),
        json_escape(&args.output_source),
        json_escape(&args.config.lock_writes_source),
        json_escape(&args.stale_lock_seconds_source),
        outputs_block,
        embedded
    );
}

fn embedded_outputs(target: &Path, outputs: &[(&'static str, &'static str)]) -> String {
    let items = outputs
        .iter()
        .filter_map(|(key, relative)| {
            let path = target.join(relative);
            if !path.is_file() {
                return None;
            }
            let text = fs::read_to_string(&path).ok()?;
            let value = if relative.ends_with(".json") {
                serde_json::from_str::<serde_json::Value>(&text)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|_| format!("\"{}\"", json_escape(&text)))
            } else {
                format!("\"{}\"", json_escape(&text))
            };
            Some(format!("    \"{}\": {}", json_escape(key), value))
        })
        .collect::<Vec<_>>()
        .join(",\n");

    if items.is_empty() {
        "{}".to_string()
    } else {
        format!("{{\n{}\n  }}", items)
    }
}

fn legacy_output_paths(command: ProjectCommand) -> Vec<(&'static str, &'static str)> {
    match command {
        ProjectCommand::Scan | ProjectCommand::Run => vec![
            ("reports", ".project-os/reports/"),
            (
                "recommendations",
                ".project-os/recommendations/recommend-next.json",
            ),
            ("runs", ".project-os/runs/"),
        ],
        ProjectCommand::Report | ProjectCommand::Check => vec![
            ("reportJson", ".project-os/reports/ai-project-report.json"),
            ("reportMarkdown", ".project-os/reports/ai-project-report.md"),
        ],
        ProjectCommand::Recommend => vec![(
            "recommendationsJson",
            ".project-os/recommendations/recommend-next.json",
        )],
        ProjectCommand::Context => vec![],
    }
}

fn run_governance_action(args: &CliArgs, target: &Path) -> Result<u8, String> {
    let runtime_root = canonical_dir(&args.runtime_root)?;
    let action_id = match args.command {
        ProjectCommand::Scan => "scan",
        ProjectCommand::Run => "run",
        ProjectCommand::Check => "check",
        ProjectCommand::Report => "report",
        ProjectCommand::Recommend => "recommend",
        ProjectCommand::Context => return Ok(0),
    };
    let result = governance::execute(target, &runtime_root, action_id, &args.passthrough)?;
    if args.output == OutputMode::File && !result.output.is_empty() {
        println!("{}", result.output);
    }
    Ok(result.code.unwrap_or(1) as u8)
}

fn git_output(target: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(target)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn iso_like_utc(epoch_seconds: u64) -> String {
    let days = (epoch_seconds / 86_400) as i64;
    let seconds_of_day = epoch_seconds % 86_400;
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_from_days(days_since_epoch: i64) -> (i64, u64, u64) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    (year, m as u64, d as u64)
}

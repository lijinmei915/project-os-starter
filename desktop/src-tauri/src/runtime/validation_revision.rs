//! Local source identity for goal checks; never stores source or credentials.
use crate::runtime::repository::Repository;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::Path;

const MAX_FILES: usize = 20_000;
const MAX_BYTES: usize = 256 * 1024 * 1024;
const MAX_DEPTH: usize = 64;
const MAX_ENTRIES: usize = 40_000;

fn excluded(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".omnidesk"
            | ".project-os"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | "coverage"
            | ".next"
            | ".nuxt"
            | ".vite"
            | ".turbo"
            | ".cache"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".DS_Store"
    ) || name.starts_with(".env")
        || matches!(
            name,
            "id_rsa" | "id_ed25519" | "credentials.json" | "auth.json"
        )
        || [".pem", ".key", ".p12", ".pfx"]
            .iter()
            .any(|suffix| name.ends_with(suffix))
}

fn framed(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_be_bytes());
    hash.update(bytes);
}

fn walk(
    root: &Path,
    directory: &Path,
    hash: &mut Sha256,
    files: &mut usize,
    bytes: &mut usize,
    entries_seen: &mut usize,
    depth: usize,
) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Err("源码目录层级超过版本核对上限".into());
    }
    let mut entries = fs::read_dir(directory)
        .map_err(|_| "无法读取源码目录，不能核对验收版本")?
        .take(MAX_ENTRIES + 1)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "源码目录读取不完整，不能核对验收版本")?;
    *entries_seen += entries.len();
    if *entries_seen > MAX_ENTRIES {
        return Err("源码目录项超过版本核对上限".into());
    }
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let name = entry.file_name();
        let name = name
            .to_str()
            .ok_or("源码文件名无法识别，不能核对验收版本")?;
        if excluded(name) {
            continue;
        }
        let path = entry.path();
        let metadata =
            fs::symlink_metadata(&path).map_err(|_| "源码在读取时发生变化，请重新验收")?;
        let relative = path
            .strip_prefix(root)
            .map_err(|_| "源码路径超出当前项目")?
            .to_str()
            .ok_or("源码路径无法识别")?
            .replace('\\', "/");
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "源码含符号链接 {relative}，当前不能可靠绑定验收版本"
            ));
        }
        framed(hash, relative.as_bytes());
        if metadata.is_dir() {
            hash.update(b"directory");
            walk(root, &path, hash, files, bytes, entries_seen, depth + 1)?;
        } else if metadata.is_file() {
            *files += 1;
            if *files > MAX_FILES {
                return Err("源码文件超过版本核对上限，不能将报告标为有效".into());
            }
            if metadata.len() > (MAX_BYTES - *bytes) as u64 {
                return Err("源码总量超过版本核对上限，不能将报告标为有效".into());
            }
            hash.update(b"file");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                hash.update((metadata.permissions().mode() & 0o111).to_be_bytes());
            }
            let mut options = fs::OpenOptions::new();
            options.read(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.custom_flags(libc::O_NOFOLLOW);
            }
            let mut file = options
                .open(&path)
                .map_err(|_| "无法读取源码，不能核对验收版本")?;
            let mut content = Sha256::new();
            let mut buffer = vec![0u8; 32 * 1024];
            loop {
                let count = file
                    .read(&mut buffer)
                    .map_err(|_| "源码读取不完整，不能核对验收版本")?;
                if count == 0 {
                    break;
                }
                *bytes += count;
                if *bytes > MAX_BYTES {
                    return Err("源码总量超过版本核对上限，不能将报告标为有效".into());
                }
                content.update(&buffer[..count]);
            }
            framed(hash, &content.finalize());
        } else {
            return Err("源码包含无法核对的特殊文件".into());
        }
    }
    Ok(())
}

pub fn capture(root: &Path) -> Result<Value, String> {
    let root = root
        .canonicalize()
        .map_err(|_| "项目目录不存在，不能核对验收版本")?;
    let mut digest = Sha256::new();
    let mut file_count = 0;
    let mut bytes = 0;
    walk(
        &root,
        &root,
        &mut digest,
        &mut file_count,
        &mut bytes,
        &mut 0,
        0,
    )?;
    let criteria_path = ".omnidesk/data/goal-validation.json";
    let validation = Repository::new(&root).read_json(criteria_path);
    if validation.is_none() && fs::symlink_metadata(root.join(criteria_path)).is_ok() {
        return Err("验收标准无法读取，不能核对验收版本".into());
    }
    let criteria = validation
        .and_then(|value| value.get("criteria").cloned())
        .unwrap_or(Value::Null);
    let criteria_bytes = serde_json::to_vec(&criteria).map_err(|error| error.to_string())?;
    Ok(json!({
        "scope": "project-source-v1", "algorithm": "sha256", "fileCount": file_count,
        "rootDigest": format!("{:x}", Sha256::digest(root.to_string_lossy().as_bytes())),
        "sourceDigest": format!("{:x}", digest.finalize()),
        "criteriaDigest": format!("{:x}", Sha256::digest(criteria_bytes)),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "omnidesk-revision-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
            fs::write(root.join("main.rs"), "before").unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn content_paths_configuration_and_project_identity_are_bound() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let original = capture(root).unwrap();
        assert_eq!(capture(root).unwrap(), original);
        fs::write(root.join("main.rs"), "after!").unwrap(); // Same length; timestamps are not evidence.
        assert_ne!(capture(root).unwrap(), original);
        fs::write(root.join("main.rs"), "before").unwrap();
        assert_eq!(capture(root).unwrap(), original);
        fs::rename(root.join("main.rs"), root.join("renamed.rs")).unwrap();
        assert_ne!(capture(root).unwrap(), original);
        fs::rename(root.join("renamed.rs"), root.join("main.rs")).unwrap();
        fs::write(root.join("Cargo.lock"), "dependency-version").unwrap();
        assert_ne!(capture(root).unwrap(), original);
        fs::remove_file(root.join("Cargo.lock")).unwrap();
        assert_eq!(capture(root).unwrap(), original);
        let copy = Fixture::new();
        assert_eq!(
            capture(&copy.0).unwrap()["sourceDigest"],
            original["sourceDigest"]
        );
        assert_ne!(
            capture(&copy.0).unwrap()["rootDigest"],
            original["rootDigest"]
        );
    }

    #[test]
    fn criteria_are_bound_but_state_outputs_and_secrets_are_excluded() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let original = capture(root).unwrap();
        for directory in ["target", "node_modules", ".omnidesk/evidence"] {
            fs::create_dir_all(root.join(directory)).unwrap();
            fs::write(root.join(directory).join("output"), "unrelated").unwrap();
        }
        fs::write(root.join(".env.local"), "secret").unwrap();
        fs::write(root.join("private.key"), "secret").unwrap();
        fs::write(
            root.join(".omnidesk/data/goal-validation.json"),
            r#"{"goal":{"status":"verified"}}"#,
        )
        .unwrap();
        assert_eq!(capture(root).unwrap(), original);
        fs::write(
            root.join(".omnidesk/data/goal-validation.json"),
            r#"{"criteria":[{"id":"new","required":true}]}"#,
        )
        .unwrap();
        assert_ne!(
            capture(root).unwrap()["criteriaDigest"],
            original["criteriaDigest"]
        );
        assert_eq!(
            capture(root).unwrap()["sourceDigest"],
            original["sourceDigest"]
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_fail_closed_and_executable_modes_are_bound() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let fixture = Fixture::new();
        let root = &fixture.0;
        let original = capture(root).unwrap();
        fs::set_permissions(root.join("main.rs"), fs::Permissions::from_mode(0o755)).unwrap();
        assert_ne!(capture(root).unwrap(), original);
        symlink(root.join("main.rs"), root.join("linked.rs")).unwrap();
        assert!(capture(root).unwrap_err().contains("符号链接"));
    }

    #[test]
    fn deeply_nested_empty_directories_cannot_bypass_scan_budget() {
        let fixture = Fixture::new();
        let mut nested = fixture.0.clone();
        for _ in 0..=MAX_DEPTH {
            nested = nested.join("d");
        }
        fs::create_dir_all(nested).unwrap();
        assert!(capture(&fixture.0).unwrap_err().contains("层级"));
    }

    #[test]
    fn oversized_source_and_malformed_criteria_cannot_be_certified() {
        let fixture = Fixture::new();
        let large = fs::File::create(fixture.0.join("large.bin")).unwrap();
        large.set_len((MAX_BYTES + 1) as u64).unwrap();
        assert!(capture(&fixture.0).unwrap_err().contains("总量"));
        fs::remove_file(fixture.0.join("large.bin")).unwrap();
        fs::write(
            fixture.0.join(".omnidesk/data/goal-validation.json"),
            "invalid",
        )
        .unwrap();
        assert!(capture(&fixture.0).unwrap_err().contains("验收标准"));
    }
}

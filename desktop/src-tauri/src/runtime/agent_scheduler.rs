use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const SCHEDULER_PATH: &str = ".omnidesk/runtime/agent-scheduler.json";
const SCHEDULER_SCHEMA_VERSION: &str = "omnidesk.agent-scheduler.v0.1";
const MAX_CONCURRENT_RUNS: usize = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledAgentRun {
    pub run_id: String,
    pub project_id: String,
    pub status: String,
    pub sequence: u64,
    pub enqueued_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledAgentRunView {
    pub run_id: String,
    pub project_id: String,
    pub status: String,
    pub sequence: u64,
    pub queue_position: Option<usize>,
    pub enqueued_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSchedulerSnapshot {
    pub schema_version: String,
    pub max_concurrent_runs: usize,
    pub active_count: usize,
    pub entries: Vec<ScheduledAgentRunView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentSchedulerState {
    schema_version: String,
    next_sequence: u64,
    #[serde(default)]
    entries: Vec<ScheduledAgentRun>,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ClaimOutcome {
    Claimed,
    Waiting,
}

#[derive(Debug)]
pub struct AgentSchedulerLease {
    root: PathBuf,
    run_id: String,
    settled: bool,
}

impl AgentSchedulerLease {
    pub fn settle(mut self, status: &str, timestamp: &str) -> Result<(), String> {
        settle(&self.root, &self.run_id, status, timestamp)?;
        self.settled = true;
        Ok(())
    }
}

impl Drop for AgentSchedulerLease {
    fn drop(&mut self) {
        if !self.settled {
            let _ = settle(
                &self.root,
                &self.run_id,
                "interrupted",
                &crate::runtime::provider::current_unix_timestamp(),
            );
        }
    }
}

pub fn enqueue(
    root: &Path,
    run_id: &str,
    project_id: &str,
    timestamp: &str,
) -> Result<ScheduledAgentRun, String> {
    validate_identity(run_id, "run id")?;
    validate_identity(project_id, "project id")?;
    Repository::new(root).transaction_with("enqueue-agent-run", |repository| {
        let mut state = load_from_repository(repository)?;
        if let Some(entry) = state
            .entries
            .iter_mut()
            .find(|entry| entry.run_id == run_id)
        {
            if entry.project_id != project_id {
                return Err("调度记录属于其他项目。".to_string());
            }
            if matches!(
                entry.status.as_str(),
                "waiting-approval"
                    | "waiting-user"
                    | "waiting-continuation"
                    | "failed"
                    | "interrupted"
            ) {
                entry.status = "queued".to_string();
                entry.updated_at = timestamp.to_string();
            }
            let result = entry.clone();
            return Ok((result, vec![mutation(&state)?]));
        }
        let entry = ScheduledAgentRun {
            run_id: run_id.to_string(),
            project_id: project_id.to_string(),
            status: "queued".to_string(),
            sequence: state.next_sequence,
            enqueued_at: timestamp.to_string(),
            updated_at: timestamp.to_string(),
        };
        state.next_sequence += 1;
        state.entries.push(entry.clone());
        trim_terminal_entries(&mut state.entries);
        Ok((entry, vec![mutation(&state)?]))
    })
}

pub fn snapshot(root: &Path) -> Result<AgentSchedulerSnapshot, String> {
    let state = load_from_repository(&Repository::new(root))?;
    let mut queued = state
        .entries
        .iter()
        .filter(|entry| entry.status == "queued")
        .collect::<Vec<_>>();
    queued.sort_by_key(|entry| entry.sequence);
    let positions = queued
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.run_id.as_str(), index + 1))
        .collect::<std::collections::HashMap<_, _>>();
    let entries = state
        .entries
        .iter()
        .filter(|entry| !is_terminal(&entry.status))
        .map(|entry| ScheduledAgentRunView {
            run_id: entry.run_id.clone(),
            project_id: entry.project_id.clone(),
            status: entry.status.clone(),
            sequence: entry.sequence,
            queue_position: positions.get(entry.run_id.as_str()).copied(),
            enqueued_at: entry.enqueued_at.clone(),
            updated_at: entry.updated_at.clone(),
        })
        .collect();
    Ok(AgentSchedulerSnapshot {
        schema_version: SCHEDULER_SCHEMA_VERSION.to_string(),
        max_concurrent_runs: MAX_CONCURRENT_RUNS,
        active_count: state
            .entries
            .iter()
            .filter(|entry| is_project_reservation(&entry.status))
            .count(),
        entries,
    })
}

pub fn try_claim(
    root: &Path,
    run_id: &str,
    timestamp: &str,
) -> Result<(ClaimOutcome, Option<AgentSchedulerLease>), String> {
    let outcome = Repository::new(root).transaction_with("claim-agent-run", |repository| {
        let mut state = load_from_repository(repository)?;
        let index = state
            .entries
            .iter()
            .position(|entry| entry.run_id == run_id)
            .ok_or_else(|| "Agent Run 尚未进入调度队列。".to_string())?;
        if state.entries[index].status == "running" {
            return Err("该 Agent Run 已被其他执行请求领取。".to_string());
        }
        if state.entries[index].status != "queued" {
            return Err(format!(
                "调度状态为 {}，不能领取。",
                state.entries[index].status
            ));
        }
        let active = state
            .entries
            .iter()
            .filter(|entry| is_project_reservation(&entry.status))
            .collect::<Vec<_>>();
        if active.len() >= MAX_CONCURRENT_RUNS
            || active
                .iter()
                .any(|entry| entry.project_id == state.entries[index].project_id)
        {
            return Ok((ClaimOutcome::Waiting, Vec::new()));
        }
        let reserved_projects = active
            .iter()
            .map(|entry| entry.project_id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let next_eligible = state
            .entries
            .iter()
            .filter(|entry| {
                entry.status == "queued" && !reserved_projects.contains(entry.project_id.as_str())
            })
            .min_by_key(|entry| entry.sequence)
            .map(|entry| entry.run_id.as_str());
        if next_eligible != Some(run_id) {
            return Ok((ClaimOutcome::Waiting, Vec::new()));
        }
        state.entries[index].status = "running".to_string();
        state.entries[index].updated_at = timestamp.to_string();
        Ok((ClaimOutcome::Claimed, vec![mutation(&state)?]))
    })?;
    let lease = (outcome == ClaimOutcome::Claimed).then(|| AgentSchedulerLease {
        root: root.to_path_buf(),
        run_id: run_id.to_string(),
        settled: false,
    });
    Ok((outcome, lease))
}

pub fn settle(root: &Path, run_id: &str, status: &str, timestamp: &str) -> Result<(), String> {
    settle_inner(root, run_id, status, timestamp, true).map(|_| ())
}

pub fn settle_if_present(
    root: &Path,
    run_id: &str,
    status: &str,
    timestamp: &str,
) -> Result<bool, String> {
    settle_inner(root, run_id, status, timestamp, false)
}

fn settle_inner(
    root: &Path,
    run_id: &str,
    status: &str,
    timestamp: &str,
    required: bool,
) -> Result<bool, String> {
    if !matches!(
        status,
        "waiting-approval"
            | "waiting-user"
            | "waiting-continuation"
            | "completed"
            | "failed"
            | "cancelled"
            | "interrupted"
    ) {
        return Err("调度终态不受支持。".to_string());
    }
    Repository::new(root).transaction_with("settle-agent-scheduler", |repository| {
        let mut state = load_from_repository(repository)?;
        let Some(entry) = state
            .entries
            .iter_mut()
            .find(|entry| entry.run_id == run_id)
        else {
            if required {
                return Err("没有找到 Agent Run 调度记录。".to_string());
            }
            return Ok((false, Vec::new()));
        };
        if is_terminal(&entry.status) && !(entry.status == "interrupted" && status == "cancelled") {
            if entry.status == status {
                return Ok((false, Vec::new()));
            }
            return Err(format!(
                "调度记录已进入终态 {}，拒绝覆盖为 {}。",
                entry.status, status
            ));
        }
        entry.status = status.to_string();
        entry.updated_at = timestamp.to_string();
        trim_terminal_entries(&mut state.entries);
        Ok((true, vec![mutation(&state)?]))
    })
}

pub fn recover_stale(root: &Path, timestamp: &str) -> Result<(), String> {
    Repository::new(root).transaction_with("recover-agent-scheduler", |repository| {
        let mut state = load_from_repository(repository)?;
        let mut changed = false;
        for entry in &mut state.entries {
            if is_project_reservation(&entry.status) {
                entry.status = "interrupted".to_string();
                entry.updated_at = timestamp.to_string();
                changed = true;
            }
        }
        Ok((
            (),
            changed
                .then(|| mutation(&state))
                .transpose()?
                .into_iter()
                .collect(),
        ))
    })
}

#[cfg(feature = "webdriver")]
pub fn debug_entries(root: &Path) -> Result<Vec<ScheduledAgentRun>, String> {
    Ok(load_from_repository(&Repository::new(root))?.entries)
}

fn is_project_reservation(status: &str) -> bool {
    matches!(
        status,
        "running" | "waiting-approval" | "waiting-user" | "waiting-continuation"
    )
}

fn is_terminal(status: &str) -> bool {
    matches!(status, "completed" | "failed" | "cancelled" | "interrupted")
}

fn trim_terminal_entries(entries: &mut Vec<ScheduledAgentRun>) {
    let mut terminal = entries
        .iter()
        .filter(|entry| is_terminal(&entry.status))
        .map(|entry| entry.sequence)
        .collect::<Vec<_>>();
    if terminal.len() <= 100 {
        return;
    }
    terminal.sort_unstable();
    let cutoff = terminal[terminal.len() - 100];
    entries.retain(|entry| !is_terminal(&entry.status) || entry.sequence >= cutoff);
}

fn validate_identity(value: &str, label: &str) -> Result<(), String> {
    if value.trim().is_empty()
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(format!("{label} 非法。"));
    }
    Ok(())
}

fn empty_state() -> AgentSchedulerState {
    AgentSchedulerState {
        schema_version: SCHEDULER_SCHEMA_VERSION.to_string(),
        next_sequence: 1,
        entries: Vec::new(),
    }
}

fn load_from_repository(repository: &Repository) -> Result<AgentSchedulerState, String> {
    repository
        .read_json(SCHEDULER_PATH)
        .map(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
        .transpose()
        .map(|state| state.unwrap_or_else(empty_state))
}

fn mutation(state: &AgentSchedulerState) -> Result<JsonMutation, String> {
    Ok(JsonMutation::upsert(
        SCHEDULER_PATH,
        serde_json::to_value(state).map_err(|error| error.to_string())?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn root(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("omnidesk-scheduler-{name}-{suffix}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn serializes_runs_for_one_project_and_claims_the_next_after_release() {
        let root = root("project-lock");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        enqueue(&root, "run-b", "project-a", "2").unwrap();
        let (_, first) = try_claim(&root, "run-a", "3").unwrap();
        assert!(first.is_some());
        assert_eq!(
            try_claim(&root, "run-b", "4").unwrap().0,
            ClaimOutcome::Waiting
        );
        first.unwrap().settle("completed", "5").unwrap();
        assert_eq!(
            try_claim(&root, "run-b", "6").unwrap().0,
            ClaimOutcome::Claimed
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn allows_bounded_cross_project_concurrency_and_preserves_fifo() {
        let root = root("concurrency");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        enqueue(&root, "run-b", "project-b", "2").unwrap();
        enqueue(&root, "run-c", "project-c", "3").unwrap();
        let (_, first) = try_claim(&root, "run-a", "4").unwrap();
        let (_, second) = try_claim(&root, "run-b", "5").unwrap();
        assert!(first.is_some() && second.is_some());
        assert_eq!(
            try_claim(&root, "run-c", "6").unwrap().0,
            ClaimOutcome::Waiting
        );
        first.unwrap().settle("completed", "7").unwrap();
        assert_eq!(
            try_claim(&root, "run-c", "8").unwrap().0,
            ClaimOutcome::Claimed
        );
        second.unwrap().settle("completed", "9").unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restart_interrupts_reservations_without_replaying_queued_work() {
        let root = root("recovery");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        enqueue(&root, "run-b", "project-b", "2").unwrap();
        let (_, lease) = try_claim(&root, "run-a", "3").unwrap();
        std::mem::forget(lease);
        recover_stale(&root, "4").unwrap();
        let state = load_from_repository(&Repository::new(&root)).unwrap();
        assert_eq!(state.entries[0].status, "interrupted");
        assert_eq!(state.entries[1].status, "queued");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_a_duplicate_claim_for_the_same_running_run() {
        let root = root("duplicate-claim");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        let (_, lease) = try_claim(&root, "run-a", "2").unwrap();
        let error = try_claim(&root, "run-a", "3").unwrap_err();
        assert!(error.contains("已被其他执行请求领取"));
        lease.unwrap().settle("completed", "4").unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn approval_wait_keeps_the_project_reserved_until_the_same_run_requeues() {
        let root = root("approval-reservation");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        enqueue(&root, "run-b", "project-a", "2").unwrap();
        let (_, lease) = try_claim(&root, "run-a", "3").unwrap();
        lease.unwrap().settle("waiting-approval", "4").unwrap();
        assert_eq!(
            try_claim(&root, "run-b", "5").unwrap().0,
            ClaimOutcome::Waiting
        );
        enqueue(&root, "run-a", "project-a", "6").unwrap();
        assert_eq!(
            try_claim(&root, "run-a", "7").unwrap().0,
            ClaimOutcome::Claimed
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn snapshot_exposes_only_active_work_and_stable_queue_positions() {
        let root = root("snapshot");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        enqueue(&root, "run-b", "project-b", "2").unwrap();
        enqueue(&root, "run-c", "project-c", "3").unwrap();
        let (_, lease) = try_claim(&root, "run-a", "4").unwrap();
        let view = snapshot(&root).unwrap();
        assert_eq!(view.active_count, 1);
        assert_eq!(view.max_concurrent_runs, 2);
        assert_eq!(view.entries[1].queue_position, Some(1));
        assert_eq!(view.entries[2].queue_position, Some(2));
        lease.unwrap().settle("completed", "5").unwrap();
        assert!(snapshot(&root)
            .unwrap()
            .entries
            .iter()
            .all(|entry| entry.run_id != "run-a"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cancellation_cannot_be_overwritten_by_a_late_lease_settlement() {
        let root = root("cancel-race");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        let (_, lease) = try_claim(&root, "run-a", "2").unwrap();
        settle(&root, "run-a", "cancelled", "3").unwrap();
        let error = lease.unwrap().settle("completed", "4").unwrap_err();
        assert!(error.contains("已进入终态 cancelled"));
        assert_eq!(
            load_from_repository(&Repository::new(&root))
                .unwrap()
                .entries[0]
                .status,
            "cancelled"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cancelling_an_approval_wait_releases_the_project() {
        let root = root("cancel-releases-project");
        enqueue(&root, "run-a", "project-a", "1").unwrap();
        enqueue(&root, "run-b", "project-a", "2").unwrap();
        let (_, lease) = try_claim(&root, "run-a", "3").unwrap();
        lease.unwrap().settle("waiting-approval", "4").unwrap();
        assert_eq!(
            try_claim(&root, "run-b", "5").unwrap().0,
            ClaimOutcome::Waiting
        );
        settle(&root, "run-a", "cancelled", "6").unwrap();
        assert_eq!(
            try_claim(&root, "run-b", "7").unwrap().0,
            ClaimOutcome::Claimed
        );
        fs::remove_dir_all(root).unwrap();
    }
}

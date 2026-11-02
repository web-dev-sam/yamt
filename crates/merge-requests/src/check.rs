use std::collections::{HashMap, HashSet};
use std::fmt;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use yamt_gitio::{FETCH_TIMEOUT, MergeOutcome, MergeTreeRun, Oid, Repo};

use crate::open::require_branch_name;
use crate::page::count;
use crate::readiness::GitLabMerge;
use crate::remote::remote_for;
use crate::{CheckedRow, GitLabRepository, MergeRequestIid};

/// 18× the 1.1 s measured on gitlab.com (`docs/slices/briefs/local-conflicts-design.md` §2.2 "Numbers").
const REMOTE_REFS_TIMEOUT: Duration = Duration::from_secs(20);
const MERGE_TIMEOUT: Duration = Duration::from_secs(10);
const MERGES_AT_ONCE: usize = 2;
const MERGE_PHASE_LIMIT: Duration = Duration::from_secs(60);
const HEAD_REFS: &str = "refs/merge-requests/*/head";

/// One row of a load as the check needs it.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct RowToCheck {
    pub iid: MergeRequestIid,
    pub target_branch: String,
    /// GitLab's `diffHeadSha`; `None` when GitLab sent none, or no commit id.
    pub head: Option<Oid>,
    pub gitlab: GitLabMerge,
}

/// The rows one load sent, as the check needs them (project path; per row its iid, target branch, `diffHeadSha`
/// and GitLab's merge status); made only by `list_merge_requests`.
pub struct ConflictCheck {
    pub(crate) full_path: String,
    pub(crate) rows: Vec<RowToCheck>,
}

/// The merges this app's run has done: (target commit, source commit) → outcome. Held by the shell for the run and
/// lent to each check (architecture §3.9 as amended, plan #149); never cleared.
#[derive(Debug, Default)]
pub struct MergedPairs {
    outcomes: HashMap<Pair, MergeOutcome>,
}

/// The two commits merged for a row: its target branch's tip and GitLab's head of the merge request.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct Pair {
    target: Oid,
    source: Oid,
}

/// A row whose two commits the remote advertises as GitLab names them.
type PairedRow<'a> = (&'a RowToCheck, Pair);

/// What one load's check did: its one log line and what the tests read. Every row is counted once in
/// `remembered`, `moving`, `kept`, or (the rest) decided by a merge run now.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct CheckSummary {
    /// Rows in the check.
    pub rows: u32,
    /// `merge-tree` runs started.
    pub merges: u32,
    /// Refspecs in the one fetch; 0 without a fetch.
    pub fetched_refs: u32,
    /// Rows decided from `MergedPairs`.
    pub remembered: u32,
    /// Rows whose `refs/merge-requests/<iid>/head` is not GitLab's `diffHeadSha` (request rule 5).
    pub moving: u32,
    /// Other rows keeping GitLab's answer: no head, a ref not advertised, a failed, timed-out or unstarted merge, a
    /// stopped check.
    pub kept: u32,
    /// The first thing that went wrong (git too old, no remote, ls-remote, fetch, a merge).
    pub problem: Option<String>,
}

impl fmt::Display for CheckSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} rows: {} merges, {} refs fetched, {} remembered, {} moving, {} kept",
            self.rows, self.merges, self.fetched_refs, self.remembered, self.moving, self.kept
        )?;
        match &self.problem {
            Some(problem) => write!(formatter, "; {problem}"),
            None => Ok(()),
        }
    }
}

/// Request rules 4–8 for one load: GitLab's commits only, one `ls-remote`, at most one fetch, merges two at a
/// time; each row whose readiness changes goes to `on_checked` as soon as its pair is decided (on the calling
/// thread). Writes no ref, no `FETCH_HEAD`, no index, no working tree; logs one line.
pub fn check_conflicts(
    repository: &GitLabRepository,
    check: &ConflictCheck,
    memory: &mut MergedPairs,
    on_checked: &dyn Fn(CheckedRow),
) -> CheckSummary {
    let mut summary = CheckSummary {
        rows: count(check.rows.len()),
        ..CheckSummary::default()
    };
    let decided = match decided_rows(repository, check, memory, on_checked, &mut summary) {
        Ok(decided) => decided,
        Err(problem) => {
            summary.problem = Some(problem);
            0
        }
    };
    summary.kept = summary.rows - summary.remembered - summary.moving - decided;
    if summary.problem.is_some() {
        tracing::warn!(%summary, "local conflict check");
    } else {
        tracing::info!(%summary, "local conflict check");
    }
    summary
}

/// Design §2.2 steps 1–8: how many rows a merge run now decided; `Err` is what stopped the check.
fn decided_rows(
    repository: &GitLabRepository,
    check: &ConflictCheck,
    memory: &mut MergedPairs,
    on_checked: &dyn Fn(CheckedRow),
    summary: &mut CheckSummary,
) -> Result<u32, String> {
    if check.rows.iter().all(|row| row.head.is_none()) {
        return Ok(0);
    }
    let repo = repository.repo();
    let run_kind = merge_tree_run(repo)?;
    let remote = remote_for(repository.gitlab_remotes(), &check.full_path).ok_or_else(|| {
        format!(
            "no remote of the repository names the project {}",
            check.full_path
        )
    })?;
    let patterns = remote_ref_patterns(&check.rows);
    let patterns: Vec<&str> = patterns.iter().map(String::as_str).collect();
    let advertised = repo
        .remote_refs(&remote.name, &patterns, REMOTE_REFS_TIMEOUT)
        .map_err(|message| format!("ls-remote: {message}"))?;
    let advertised: HashMap<Vec<u8>, Oid> = advertised
        .into_iter()
        .map(|found| (found.name, found.id))
        .collect();
    let paired = paired_rows(&check.rows, &advertised, summary);
    let not_remembered = send_remembered(paired, memory, on_checked, summary);
    let to_merge = fetched_unless_local(repo, &remote.name, not_remembered, summary)?;
    Ok(merge_and_send(
        repo, run_kind, &to_merge, memory, on_checked, summary,
    ))
}

fn merge_tree_run(repo: &Repo) -> Result<MergeTreeRun, String> {
    let version = repo.version().map_err(|error| error.to_string())?;
    MergeTreeRun::for_version(version).ok_or_else(|| {
        format!(
            "git {}.{} cannot merge without a checkout (needs 2.38)",
            version.major, version.minor
        )
    })
}

/// `refs/heads/<t>` once for each target of a row with a head, a target holding `:` left out, then every merge
/// request's head ref.
fn remote_ref_patterns(rows: &[RowToCheck]) -> Vec<String> {
    let mut patterns = Vec::new();
    for row in rows.iter().filter(|row| row.head.is_some()) {
        let pattern = branch_ref(&row.target_branch);
        if require_branch_name(&row.target_branch).is_ok() && !patterns.contains(&pattern) {
            patterns.push(pattern);
        }
    }
    patterns.push(HEAD_REFS.to_owned());
    patterns
}

fn branch_ref(branch: &str) -> String {
    format!("refs/heads/{branch}")
}

fn head_ref(iid: MergeRequestIid) -> String {
    format!("refs/merge-requests/{}/head", iid.0)
}

/// Each row with a head whose target tip and head ref the remote advertises, and whose head ref is GitLab's head;
/// a row whose head ref is another commit is counted `moving` (request rule 5).
fn paired_rows<'a>(
    rows: &'a [RowToCheck],
    advertised: &HashMap<Vec<u8>, Oid>,
    summary: &mut CheckSummary,
) -> Vec<PairedRow<'a>> {
    let mut paired = Vec::new();
    for row in rows {
        let Some(head) = &row.head else { continue };
        let target = advertised.get(branch_ref(&row.target_branch).as_bytes());
        let head_ref = advertised.get(head_ref(row.iid).as_bytes());
        let (Some(target), Some(head_ref)) = (target, head_ref) else {
            continue;
        };
        if head_ref != head {
            summary.moving += 1;
            continue;
        }
        let pair = Pair {
            target: target.clone(),
            source: head.clone(),
        };
        paired.push((row, pair));
    }
    paired
}

/// Sends each row whose pair `memory` holds, when its readiness changes; the others come back.
fn send_remembered<'a>(
    paired: Vec<PairedRow<'a>>,
    memory: &MergedPairs,
    on_checked: &dyn Fn(CheckedRow),
    summary: &mut CheckSummary,
) -> Vec<PairedRow<'a>> {
    let mut not_remembered = Vec::new();
    for (row, pair) in paired {
        match memory.outcomes.get(&pair) {
            Some(&outcome) => {
                summary.remembered += 1;
                send_if_changed(row, outcome, on_checked);
            }
            None => not_remembered.push((row, pair)),
        }
    }
    not_remembered
}

/// The rows whose commits are all local after at most one fetch of the missing ones; a failed fetch drops only
/// the rows that needed it. `Err` when git cannot tell which commits are local.
fn fetched_unless_local<'a>(
    repo: &Repo,
    remote: &str,
    rows: Vec<PairedRow<'a>>,
    summary: &mut CheckSummary,
) -> Result<Vec<PairedRow<'a>>, String> {
    if rows.is_empty() {
        return Ok(rows);
    }
    let mut ids = Vec::new();
    for (_, pair) in &rows {
        ids.extend([pair.target.clone(), pair.source.clone()]);
    }
    let missing = repo
        .missing_commits(&ids)
        .map_err(|error| error.to_string())?;
    let missing: HashSet<Oid> = missing.into_iter().collect();
    if missing.is_empty() {
        return Ok(rows);
    }
    let refspecs = refspecs_for(&rows, &missing);
    summary.fetched_refs = count(refspecs.len());
    let refspecs: Vec<&str> = refspecs.iter().map(String::as_str).collect();
    let Err(message) = repo.fetch_without_refs(remote, &refspecs, FETCH_TIMEOUT) else {
        return Ok(rows);
    };
    summary.problem = Some(format!("fetch: {message}"));
    Ok(with_local_commits(rows, &missing))
}

/// The rows neither of whose commits is `missing`.
fn with_local_commits<'a>(rows: Vec<PairedRow<'a>>, missing: &HashSet<Oid>) -> Vec<PairedRow<'a>> {
    let is_local =
        |(_, pair): &PairedRow| !missing.contains(&pair.target) && !missing.contains(&pair.source);
    rows.into_iter().filter(is_local).collect()
}

/// `refs/heads/<t>` for each missing target tip and `refs/merge-requests/<iid>/head` for each missing head, once.
fn refspecs_for(rows: &[PairedRow], missing: &HashSet<Oid>) -> Vec<String> {
    let mut refspecs = Vec::new();
    for (row, pair) in rows {
        let needed = [
            (&pair.target, branch_ref(&row.target_branch)),
            (&pair.source, head_ref(row.iid)),
        ];
        for (id, refspec) in needed {
            if missing.contains(id) && !refspecs.contains(&refspec) {
                refspecs.push(refspec);
            }
        }
    }
    refspecs
}

/// Merges each distinct pair, remembers its outcome and sends its rows whose readiness changes; how many rows the
/// merges decided.
fn merge_and_send(
    repo: &Repo,
    run_kind: MergeTreeRun,
    rows: &[PairedRow],
    memory: &mut MergedPairs,
    on_checked: &dyn Fn(CheckedRow),
    summary: &mut CheckSummary,
) -> u32 {
    let mut pairs: Vec<Pair> = Vec::new();
    for (_, pair) in rows {
        if !pairs.contains(pair) {
            pairs.push(pair.clone());
        }
    }
    let merge = |pair: &Pair| {
        repo.merge_tree(&pair.target, &pair.source, run_kind, MERGE_TIMEOUT)
            .map_err(|error| error.to_string())
    };
    let mut decided = 0;
    let mut on_merged = |pair: &Pair, merged: Result<MergeOutcome, String>| match merged {
        Ok(outcome) => {
            memory.outcomes.insert(pair.clone(), outcome);
            for (row, _) in rows.iter().filter(|(_, paired)| paired == pair) {
                decided += 1;
                send_if_changed(row, outcome, on_checked);
            }
        }
        Err(problem) => {
            summary.problem.get_or_insert(problem);
        }
    };
    let started = merged_in_finishing_order(&pairs, MERGE_PHASE_LIMIT, &merge, &mut on_merged);
    summary.merges = started;
    decided
}

fn send_if_changed(row: &RowToCheck, merged: MergeOutcome, on_checked: &dyn Fn(CheckedRow)) {
    let readiness = row.gitlab.readiness_after(merged);
    if readiness != row.gitlab.readiness() {
        on_checked(CheckedRow {
            iid: row.iid,
            readiness,
        });
    }
}

/// Runs `merge` on the pairs in order, `MERGES_AT_ONCE` at a time in scoped threads, none started once `limit` has
/// passed; each result goes to `on_merged` on the calling thread as it finishes. How many merges started.
fn merged_in_finishing_order(
    pairs: &[Pair],
    limit: Duration,
    merge: &(dyn Fn(&Pair) -> Result<MergeOutcome, String> + Sync),
    on_merged: &mut dyn FnMut(&Pair, Result<MergeOutcome, String>),
) -> u32 {
    let phase_start = Instant::now();
    let (sender, finished) = mpsc::channel();
    let mut waiting = pairs.iter();
    let mut started = 0;
    let mut running = 0;
    thread::scope(|scope| {
        loop {
            while running < MERGES_AT_ONCE && phase_start.elapsed() < limit {
                let Some(pair) = waiting.next() else { break };
                let sender = sender.clone();
                scope.spawn(move || sender.send((pair, merge(pair))));
                started += 1;
                running += 1;
            }
            if running == 0 {
                break;
            }
            let Ok((pair, merged)) = finished.recv() else {
                break;
            };
            running -= 1;
            on_merged(pair, merged);
        }
    });
    started
}

#[cfg(test)]
mod tests;

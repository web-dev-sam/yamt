use std::path::Path;

use yamt_gitio::{FETCH_TIMEOUT, Oid, Repo, first_line};

use crate::record::{
    self, FORMAT, MergeRecord, RECORD_FILE, RecordedBranch, RecordedReturn, START_LOCK_FILE, hold,
    is_live,
};
use crate::restore::restore;
use crate::{MergeRequestBranches, Refusal, Started, git_message};

const MERGE_FAILED: &str = "git merge stopped without a merge in progress";
const BRANCH_NOT_UTF8: &str = "the name of the checked-out branch is not UTF-8";

/// Merges the merge request's target branch into its branch, checked out in the checkout at `root`, without
/// committing (design §4.2). Every refusal before the checkout changes nothing; a failure after it puts back what
/// it can and lists the rest.
pub fn start(root: &Path, branches: &MergeRequestBranches) -> Result<Started, Refusal> {
    let repo = Repo::discover(root).map_err(|error| refused(&error))?;
    let lock_path = repo
        .git_path(START_LOCK_FILE)
        .map_err(|error| refused(&error))?;
    let held = hold(&lock_path).map_err(|error| Refusal::GitRefused {
        message: format!("cannot lock {}: {error}", lock_path.display()),
        left: Vec::new(),
    })?;
    let Some(_lock) = held else {
        return Err(Refusal::AlreadyMerging { iid: None });
    };
    let path = repo
        .git_path(RECORD_FILE)
        .map_err(|error| refused(&error))?;
    drop_stale_record(&repo, &path)?;
    let (record, source) = checked_record(&repo, branches)?;
    change_checkout(&repo, &path, &record, &source)
}

/// Step 3: a live record refuses, an unreadable one refuses and stays, a stale one is removed.
fn drop_stale_record(repo: &Repo, path: &Path) -> Result<(), Refusal> {
    let record = match record::read(path) {
        Ok(None) => return Ok(()),
        Ok(Some(record)) => record,
        Err(message) => {
            let path = path.display().to_string();
            return Err(Refusal::RecordUnreadable { path, message });
        }
    };
    let stop = repo.stop().map_err(|error| refused(&error))?;
    let current_branch = repo.current_branch().map_err(|error| refused(&error))?;
    if is_live(&record, &stop, current_branch.as_deref()) {
        return Err(Refusal::AlreadyMerging {
            iid: Some(record.iid),
        });
    }
    tracing::info!(path = %path.display(), "dropping the record of a merge that is no longer in progress");
    record::remove(path);
    Ok(())
}

/// Steps 4–10: the record to write, and the commit of GitLab's branch to check out.
fn checked_record(
    repo: &Repo,
    branches: &MergeRequestBranches,
) -> Result<(MergeRecord, Oid), Refusal> {
    let MergeRequestBranches {
        iid,
        remote,
        branch,
        target,
    } = branches;
    require_quiet_checkout(repo)?;
    repo.fetch_branches(remote, &[branch, target], FETCH_TIMEOUT)
        .map_err(|message| Refusal::FetchFailed { message })?;
    let source = remote_tip(repo, remote, branch)?;
    let goal = remote_tip(repo, remote, target)?;
    let branch_before = branch_before(repo, branch, &source)?;
    if repo
        .is_ancestor(&goal, &source)
        .map_err(|error| refused(&error))?
    {
        let (branch, target) = (branch.clone(), target.clone());
        return Err(Refusal::AlreadyContains { branch, target });
    }
    let record = MergeRecord {
        format: FORMAT,
        iid: *iid,
        remote: remote.clone(),
        branch: branch.clone(),
        target: target.clone(),
        return_to: return_to(repo)?,
        branch_before,
        head: source.as_str().to_owned(),
        merging: goal.as_str().to_owned(),
    };
    Ok((record, source))
}

/// Steps 4 and 5: no git operation in progress, no change to a tracked file.
fn require_quiet_checkout(repo: &Repo) -> Result<(), Refusal> {
    let stop = repo.stop().map_err(|error| refused(&error))?;
    if stop.operation.is_some() {
        return Err(Refusal::Busy);
    }
    if repo
        .has_tracked_changes()
        .map_err(|error| refused(&error))?
    {
        return Err(Refusal::UncommittedChanges);
    }
    Ok(())
}

fn remote_tip(repo: &Repo, remote: &str, branch: &str) -> Result<Oid, Refusal> {
    let name = format!("refs/remotes/{remote}/{branch}");
    match repo.commit_named(&name) {
        Ok(Some(tip)) => Ok(tip),
        Ok(None) => Err(Refusal::GitRefused {
            message: format!("{name} names no commit after the fetch"),
            left: Vec::new(),
        }),
        Err(error) => Err(refused(&error)),
    }
}

/// Step 8: what checking out GitLab's `source` does to the local branch; a local commit GitLab's lacks refuses.
fn branch_before(repo: &Repo, branch: &str, source: &Oid) -> Result<RecordedBranch, Refusal> {
    let local = repo.commit_named(&format!("refs/heads/{branch}"));
    let Some(local) = local.map_err(|error| refused(&error))? else {
        return Ok(RecordedBranch::Created);
    };
    if local == *source {
        return Ok(RecordedBranch::Unchanged);
    }
    if repo
        .is_ancestor(&local, source)
        .map_err(|error| refused(&error))?
    {
        let commit = local.as_str().to_owned();
        return Ok(RecordedBranch::MovedFrom { commit });
    }
    Err(Refusal::LocalAhead {
        branch: branch.to_owned(),
    })
}

fn return_to(repo: &Repo) -> Result<RecordedReturn, Refusal> {
    let Some(name) = repo.current_branch().map_err(|error| refused(&error))? else {
        let head = repo.head_commit().map_err(|error| refused(&error))?;
        let commit = head.as_str().to_owned();
        return Ok(RecordedReturn::Detached { commit });
    };
    let name = String::from_utf8(name).map_err(|_| Refusal::GitRefused {
        message: BRANCH_NOT_UTF8.to_owned(),
        left: Vec::new(),
    })?;
    Ok(RecordedReturn::Branch { name })
}

/// Steps 11–13: the record written, the branch checked out at `source`, the merge started; a failure after the
/// checkout restores.
fn change_checkout(
    repo: &Repo,
    path: &Path,
    record: &MergeRecord,
    source: &Oid,
) -> Result<Started, Refusal> {
    record::write(path, record).map_err(|error| Refusal::GitRefused {
        message: format!("cannot write {}: {error}", path.display()),
        left: Vec::new(),
    })?;
    if let Err(error) = repo.checkout_branch_at(&record.branch, source) {
        record::remove(path);
        return Err(refused(&error));
    }
    merged(repo, record).map_err(|message| Refusal::GitRefused {
        message,
        left: restore(repo, path, record),
    })
}

/// Steps 12 and 13; `Err` holds git's words.
fn merged(repo: &Repo, record: &MergeRecord) -> Result<Started, String> {
    if record.branch_before == RecordedBranch::Created {
        repo.set_upstream(&record.branch, &record.remote)
            .map_err(|error| git_message(&error))?;
    }
    let run = repo
        .merge_no_commit(&merge_name(repo, record))
        .map_err(|error| git_message(&error))?;
    let stop = repo.stop().map_err(|error| git_message(&error))?;
    let current_branch = repo.current_branch().map_err(|error| git_message(&error))?;
    if !is_live(record, &stop, current_branch.as_deref()) {
        if let Some(operation) = &stop.operation {
            repo.abort(operation).map_err(|error| git_message(&error))?;
        }
        return Err(first_line(&run.output).unwrap_or_else(|| MERGE_FAILED.to_owned()));
    }
    let unmerged = repo.unmerged().map_err(|error| git_message(&error))?;
    Ok(Started {
        branch: record.branch.clone(),
        target: record.target.clone(),
        conflicts: !unmerged.is_empty(),
    })
}

/// `<remote>/<target>`, so git's default message reads "Merge remote-tracking branch 'origin/main' into …" (git
/// names the merged ref as it was given); the full `refs/remotes/…` when another ref of that short name would win.
fn merge_name(repo: &Repo, record: &MergeRecord) -> String {
    let short = format!("{}/{}", record.remote, record.target);
    let full = format!("refs/remotes/{short}");
    match repo.symbolic_full_name(&short) {
        Ok(Some(name)) if name == full.as_bytes() => short,
        Ok(_) | Err(_) => full,
    }
}

fn refused(error: &yamt_gitio::Error) -> Refusal {
    Refusal::GitRefused {
        message: git_message(error),
        left: Vec::new(),
    }
}

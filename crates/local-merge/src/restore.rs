use std::path::Path;

use yamt_gitio::{Oid, Repo};

use crate::record::{self, MergeRecord, RecordedBranch, RecordedReturn};
use crate::{Leftover, git_message};

/// Puts back what the start changed, as far as it still matches the record (design §4.3 "Abort" steps 1–3): HEAD
/// returned while it is still the branch at the recorded head, then the branch deleted or moved back while it is
/// still at that head. Removes the record. Runs after git's merge abort, or after a start that failed.
pub(crate) fn restore(repo: &Repo, path: &Path, record: &MergeRecord) -> Vec<Leftover> {
    let mut left = Vec::new();
    if let Some(leftover) = return_head(repo, record) {
        left.push(leftover);
    }
    if let Some(leftover) = put_branch_back(repo, record) {
        left.push(leftover);
    }
    record::remove(path);
    left
}

fn return_head(repo: &Repo, record: &MergeRecord) -> Option<Leftover> {
    if record.returns_to_itself() {
        return None;
    }
    let to = record.return_to.shown();
    match is_on_branch_at_head(repo, record) {
        Ok(true) => {}
        Ok(false) => return Some(Leftover::NotReturned { to }),
        Err(error) => {
            let message = git_message(&error);
            return Some(Leftover::ReturnRefused { to, message });
        }
    }
    let returned = match &record.return_to {
        RecordedReturn::Branch { name } => repo.checkout_branch(name),
        RecordedReturn::Detached { commit } => {
            Oid::parse(commit).and_then(|commit| repo.checkout_detached(&commit))
        }
    };
    let message = git_message(&returned.err()?);
    Some(Leftover::ReturnRefused { to, message })
}

fn is_on_branch_at_head(repo: &Repo, record: &MergeRecord) -> yamt_gitio::Result<bool> {
    Ok(is_checked_out(repo, record)? && repo.head_commit()?.as_str() == record.head)
}

fn is_checked_out(repo: &Repo, record: &MergeRecord) -> yamt_gitio::Result<bool> {
    Ok(repo.current_branch()?.as_deref() == Some(record.branch.as_bytes()))
}

fn put_branch_back(repo: &Repo, record: &MergeRecord) -> Option<Leftover> {
    let put_back = match &record.branch_before {
        RecordedBranch::Unchanged => return None,
        RecordedBranch::Created => delete_created(repo, record),
        RecordedBranch::MovedFrom { commit } => move_back(repo, record, commit),
    };
    put_back.unwrap_or_else(|error| {
        let branch = record.branch.clone();
        let message = git_message(&error);
        Some(Leftover::BranchRefused { branch, message })
    })
}

/// Deletes the branch the start created while it is still at the recorded head and not checked out; what stays
/// is listed.
fn delete_created(repo: &Repo, record: &MergeRecord) -> yamt_gitio::Result<Option<Leftover>> {
    let Some(tip) = repo.commit_named(&branch_ref(record))? else {
        return Ok(None);
    };
    let branch = record.branch.clone();
    if tip.as_str() != record.head {
        return Ok(Some(Leftover::BranchKept { branch }));
    }
    if is_checked_out(repo, record)? {
        return Ok(Some(Leftover::BranchCheckedOut { branch }));
    }
    repo.delete_branch(&record.branch)?;
    Ok(None)
}

/// Moves the branch the start fast-forwarded back to `from` while it is still at the recorded head; a branch that
/// moved is listed.
fn move_back(
    repo: &Repo,
    record: &MergeRecord,
    from: &str,
) -> yamt_gitio::Result<Option<Leftover>> {
    let tip = repo.commit_named(&branch_ref(record))?;
    if tip.as_ref().map(Oid::as_str) != Some(record.head.as_str()) {
        let branch = record.branch.clone();
        return Ok(Some(Leftover::BranchKept { branch }));
    }
    let from = Oid::parse(from)?;
    if is_checked_out(repo, record)? {
        repo.reset_keep(&from)?;
    } else {
        repo.move_branch(&record.branch, &from)?;
    }
    Ok(None)
}

fn branch_ref(record: &MergeRecord) -> String {
    format!("refs/heads/{}", record.branch)
}

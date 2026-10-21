use serde::Serialize;
use specta::Type;
use yamt_gitio::{Oid, Operation, Rebase, Repo, Stop};

use crate::Result;
use crate::orientation::Orientation;
use crate::session::LOG_TARGET;

const QUOTE: char = '\'';

/// What one side of the operation is: a branch, a commit, the commit a revert undoes, or the
/// patch `git am` applies.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum SideName {
    Branch {
        name: String,
    },
    Commit {
        short_id: String,
        subject: String,
        message: String,
    },
    Revert {
        short_id: String,
        subject: String,
        message: String,
    },
    Patch {
        subject: String,
        message: String,
    },
}

/// Both panes' names, read once when the session opens; `None` when nothing names that side.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SideNames {
    pub local: Option<SideName>,
    pub remote: Option<SideName>,
}

impl SideNames {
    pub(crate) fn read(repo: &Repo, stop: &Stop, orientation: Orientation) -> SideNames {
        let ours = name_or_warn("ours", checked_out(repo, stop.head.as_ref()));
        let theirs = name_or_warn("theirs", applied(repo, stop.operation.as_ref()));
        let (local, remote) = orientation.panes(ours, theirs);
        SideNames { local, remote }
    }
}

/// The name `read` gave; a git failure drops only this name (plan §2 #50, #62), with a warning naming `label`.
pub(crate) fn name_or_warn(
    label: &'static str,
    read: Result<Option<SideName>>,
) -> Option<SideName> {
    match read {
        Ok(name) => name,
        Err(error) => {
            tracing::warn!(target: LOG_TARGET, event = "side_name_unread", name = label, %error, "this name is left out");
            None
        }
    }
}

/// HEAD's branch, else HEAD's commit (a rebase detaches HEAD).
pub(crate) fn checked_out(repo: &Repo, head: Option<&Oid>) -> Result<Option<SideName>> {
    if let Some(branch) = repo.current_branch()? {
        return Ok(Some(SideName::Branch {
            name: text(&branch),
        }));
    }
    named(repo, head, commit_name)
}

/// What git's theirs side is the change of, per operation (plan §2 #87).
pub(crate) fn applied(repo: &Repo, operation: Option<&Operation>) -> Result<Option<SideName>> {
    let Some(operation) = operation else {
        return Ok(None);
    };
    match operation {
        Operation::Merge { merging }
        | Operation::Rebase(Rebase {
            redoing_merge: Some(merging),
            ..
        }) => Ok(Some(merge_head_name(repo, merging)?)),
        Operation::SquashMerge { merging } => named(repo, merging.as_ref(), merge_head_name),
        Operation::Rebase(Rebase {
            redoing_merge: None,
            replaying: commit,
            ..
        })
        | Operation::CherryPick {
            picking: commit, ..
        } => named(repo, commit.as_ref(), commit_name),
        Operation::Revert { reverting, .. } => named(repo, reverting.as_ref(), revert_name),
        Operation::Am {
            subject, message, ..
        } => Ok(Some(SideName::Patch {
            subject: text(subject),
            message: message_text(message),
        })),
    }
}

pub(crate) fn named(
    repo: &Repo,
    commit: Option<&Oid>,
    name: fn(&Repo, &Oid) -> Result<SideName>,
) -> Result<Option<SideName>> {
    match commit {
        Some(commit) => Ok(Some(name(repo, commit)?)),
        None => Ok(None),
    }
}

pub(crate) fn merge_head_name(repo: &Repo, commit: &Oid) -> Result<SideName> {
    let branches: Vec<String> = repo
        .branches_at(commit)?
        .iter()
        .map(|name| text(name))
        .collect();
    let branch = match branches.as_slice() {
        [] => None,
        [only] => Some(only.clone()),
        [_, _, ..] => {
            let message = repo.merge_message()?.map(|message| text(&message));
            let quoted = message.as_deref().and_then(quoted_name).map(str::to_owned);
            quoted.filter(|name| branches.contains(name))
        }
    };
    match branch {
        Some(name) => Ok(SideName::Branch { name }),
        None => commit_name(repo, commit),
    }
}

pub(crate) fn commit_name(repo: &Repo, commit: &Oid) -> Result<SideName> {
    let summary = repo.commit_summary(commit)?;
    Ok(SideName::Commit {
        short_id: text(&summary.short_id),
        subject: text(&summary.subject),
        message: message_text(&summary.message),
    })
}

fn revert_name(repo: &Repo, commit: &Oid) -> Result<SideName> {
    let summary = repo.commit_summary(commit)?;
    Ok(SideName::Revert {
        short_id: text(&summary.short_id),
        subject: text(&summary.subject),
        message: message_text(&summary.message),
    })
}

fn quoted_name(message: &str) -> Option<&str> {
    let first_line = message.lines().next()?;
    let (_, after_quote) = first_line.split_once(QUOTE)?;
    let (name, _) = after_quote.split_once(QUOTE)?;
    Some(name)
}

pub(crate) fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

/// A commit's or a patch's message as shown: without the blank lines around it.
pub(crate) fn message_text(message: &[u8]) -> String {
    text(message).trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_quoted_name_is_the_first_one_on_the_first_line() {
        let local = "Merge branch 'minor' into vapor\n\n# 'not this'\n";
        let remote = "Merge remote-tracking branch 'origin/main'";
        assert_eq!(quoted_name(local), Some("minor"));
        assert_eq!(quoted_name(remote), Some("origin/main"));
        assert_eq!(quoted_name("Merge 'unclosed\n'name'"), None);
        assert_eq!(quoted_name("Merge abc123\n'second line'"), None);
        assert_eq!(quoted_name(""), None);
    }
}

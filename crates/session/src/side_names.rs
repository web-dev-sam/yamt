use serde::Serialize;
use specta::Type;
use yamt_gitio::{Oid, Repo};

use crate::Result;
use crate::session::LOG_TARGET;
use crate::sides::Side;

const HEAD: &str = "HEAD";
pub(crate) const MERGE_HEAD: &str = "MERGE_HEAD";
const REPLAYED_HEADS: [&str; 2] = ["CHERRY_PICK_HEAD", "REBASE_HEAD"];
const QUOTE: char = '\'';

/// What one side of the merge is: a branch, else a commit.
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
}

/// Both sides' names, read once when the session opens; `None` when nothing names that side.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SideNames {
    pub local: Option<SideName>,
    pub remote: Option<SideName>,
}

pub(crate) fn read_side_names(repo: &Repo) -> SideNames {
    SideNames {
        local: name_or_warn(Side::Local, checked_out(repo)),
        remote: name_or_warn(Side::Remote, merged_in(repo)),
    }
}

fn name_or_warn(side: Side, read: Result<Option<SideName>>) -> Option<SideName> {
    match read {
        Ok(name) => name,
        Err(error) => {
            tracing::warn!(target: LOG_TARGET, event = "side_name_unread", ?side, %error, "this side's name is left out");
            None
        }
    }
}

fn checked_out(repo: &Repo) -> Result<Option<SideName>> {
    if let Some(branch) = repo.current_branch()? {
        return Ok(Some(SideName::Branch {
            name: text(&branch),
        }));
    }
    match repo.commit_named(HEAD)? {
        Some(commit) => Ok(Some(commit_name(repo, &commit)?)),
        None => Ok(None),
    }
}

fn merged_in(repo: &Repo) -> Result<Option<SideName>> {
    if let Some(commit) = repo.commit_named(MERGE_HEAD)? {
        return Ok(Some(merge_head_name(repo, &commit)?));
    }
    for head in REPLAYED_HEADS {
        if let Some(commit) = repo.commit_named(head)? {
            return Ok(Some(commit_name(repo, &commit)?));
        }
    }
    Ok(None)
}

fn merge_head_name(repo: &Repo, commit: &Oid) -> Result<SideName> {
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

fn commit_name(repo: &Repo, commit: &Oid) -> Result<SideName> {
    let summary = repo.commit_summary(commit)?;
    Ok(SideName::Commit {
        short_id: text(&summary.short_id),
        subject: text(&summary.subject),
        message: text(&summary.message).trim().to_owned(),
    })
}

fn quoted_name(message: &str) -> Option<&str> {
    let first_line = message.lines().next()?;
    let (_, after_quote) = first_line.split_once(QUOTE)?;
    let (name, _) = after_quote.split_once(QUOTE)?;
    Some(name)
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
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

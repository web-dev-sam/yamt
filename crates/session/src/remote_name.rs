use serde::Serialize;
use specta::Type;
use yamt_gitio::{Oid, Repo};

use crate::Result;
use crate::session::LOG_TARGET;

const MERGE_HEAD: &str = "MERGE_HEAD";
const REPLAYED_HEADS: [&str; 2] = ["CHERRY_PICK_HEAD", "REBASE_HEAD"];
const QUOTE: char = '\'';

/// What is merged in: the one branch at `MERGE_HEAD`, else the commit being merged or replayed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum RemoteName {
    Branch {
        name: String,
    },
    Commit {
        short_id: String,
        subject: String,
        message: String,
    },
}

pub(crate) fn read_remote_name(repo: &Repo) -> Option<RemoteName> {
    match merged_in(repo) {
        Ok(name) => name,
        Err(error) => {
            tracing::warn!(target: LOG_TARGET, event = "remote_name_unread", %error, "the merged-in name is left out");
            None
        }
    }
}

fn merged_in(repo: &Repo) -> Result<Option<RemoteName>> {
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

fn merge_head_name(repo: &Repo, commit: &Oid) -> Result<RemoteName> {
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
        Some(name) => Ok(RemoteName::Branch { name }),
        None => commit_name(repo, commit),
    }
}

fn commit_name(repo: &Repo, commit: &Oid) -> Result<RemoteName> {
    let summary = repo.commit_summary(commit)?;
    Ok(RemoteName::Commit {
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

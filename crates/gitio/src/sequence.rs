use std::path::Path;

use crate::entry::Oid;
use crate::operation::{Progress, read_oid};
use crate::repo::{Repo, read_if_present};
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::todo::commands;
use crate::{Error, Result};

const REV_LIST: &str = "rev-list";

impl Repo {
    // The stopped command is still `todo`'s first line and git keeps no `done` file
    // (`cherry_pick_range_progress_moves_from_one_to_two_of_three`); every earlier step made one commit,
    // unless the range runs with `--no-commit` (`opts` as sequencer.c `save_opts` writes it).
    pub(crate) fn sequence_progress(
        &self,
        sequencer: &Path,
        todo: &[u8],
    ) -> Result<Option<Progress>> {
        let opts = read_if_present(&sequencer.join("opts"))?.unwrap_or_default();
        if makes_no_commits(&opts) {
            return Ok(None);
        }
        let Some(saved_head) = read_oid(&sequencer.join("head"))? else {
            return Ok(None);
        };
        let Some(start) = self.commit_named(saved_head.as_str())? else {
            return Ok(None);
        };
        let done = self.commits_since(&start)?;
        let Ok(left) = u32::try_from(commands(todo).count()) else {
            return Ok(None);
        };
        Ok(Progress::new(
            done.saturating_add(1),
            done.saturating_add(left),
        ))
    }

    fn commits_since(&self, start: &Oid) -> Result<u32> {
        let range = format!("{}..HEAD", start.as_str());
        let command = self.command(Access::Read, &[REV_LIST, "--count", &range]);
        let output = run(command, None, GIT_TIMEOUT)?;
        let count = String::from_utf8_lossy(output.trim_ascii());
        count.parse().map_err(|_| Error::UnexpectedOutput {
            command: REV_LIST,
            output: count.into_owned(),
        })
    }
}

fn makes_no_commits(opts: &[u8]) -> bool {
    opts.split(|&byte| byte == b'\n')
        .any(|line| line.trim_ascii() == b"no-commit = true")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_no_commit_option_set_to_true_makes_no_commits() {
        assert!(makes_no_commits(b"[options]\n\tno-commit = true\n"));
        assert!(!makes_no_commits(b"[options]\n\tsignoff = true\n"));
        assert!(!makes_no_commits(b""));
    }
}

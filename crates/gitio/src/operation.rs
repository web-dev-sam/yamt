use std::path::{Path, PathBuf};

use crate::entry::Oid;
use crate::repo::{Repo, exists, read_if_present};
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::todo::{commands, first_command, has_editor_steps};
use crate::{Error, Result};

const STATE_PATHS: [&str; 4] = ["rebase-merge", "rebase-apply", "sequencer", "SQUASH_MSG"];
const BRANCH_REF_PREFIX: &[u8] = b"refs/heads/";
const SQUASHED_COMMIT_PREFIX: &[u8] = b"commit ";
const REV_LIST: &str = "rev-list";

/// What git is doing in this worktree, and the commit HEAD is at.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stop {
    pub operation: Option<Operation>,
    pub head: Option<Oid>,
}

impl Stop {
    /// What makes this stop this stop: the operation's kind, the commit (or patch number) it applies, and HEAD.
    /// Continue, Abort and the moved-on check compare this, never the whole `Stop`: progress and the todo list
    /// are not part of it, so `git rebase --edit-todo` is the same stop.
    #[must_use]
    pub fn id(&self) -> StopId {
        let mut stop = self.clone();
        match &mut stop.operation {
            Some(Operation::Rebase(rebase)) => {
                rebase.progress = None;
                rebase.editor_steps_ahead = false;
            }
            Some(Operation::CherryPick { progress, .. } | Operation::Revert { progress, .. }) => {
                *progress = None;
            }
            Some(
                Operation::Merge { .. } | Operation::SquashMerge { .. } | Operation::Am { .. },
            )
            | None => {}
        }
        StopId(stop)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StopId(Stop);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Operation {
    /// `MERGE_HEAD`, no rebase in progress.
    Merge { merging: Oid },
    /// `SQUASH_MSG` and no `MERGE_HEAD`; `merging` is its first `commit <oid>` line.
    SquashMerge { merging: Option<Oid> },
    /// `rebase-merge/`, or `rebase-apply/` without `applying`.
    Rebase(Rebase),
    /// `CHERRY_PICK_HEAD` and/or the sequencer.
    CherryPick {
        picking: Option<Oid>,
        progress: Option<Progress>,
    },
    /// `REVERT_HEAD` and/or the sequencer.
    Revert {
        reverting: Option<Oid>,
        progress: Option<Progress>,
    },
    /// `rebase-apply/` with `applying`; the subject is the message's first line.
    Am {
        subject: Vec<u8>,
        message: Vec<u8>,
        progress: Option<Progress>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Rebase {
    /// `head-name` without `refs/heads/`; `None` for a detached rebase.
    pub branch: Option<Vec<u8>>,
    pub onto: Option<Oid>,
    /// `REBASE_HEAD`.
    pub replaying: Option<Oid>,
    /// `MERGE_HEAD` while `rebase -r` re-does a merge commit.
    pub redoing_merge: Option<Oid>,
    pub progress: Option<Progress>,
    /// A `reword`, `squash` or `fixup -c` (any spelling git accepts) left in the todo.
    pub editor_steps_ahead: bool,
}

/// Step `step` of `total`, counted from 1.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Progress {
    step: u32,
    total: u32,
}

impl Progress {
    #[must_use]
    pub fn new(step: u32, total: u32) -> Option<Progress> {
        (1 <= step && step <= total).then_some(Progress { step, total })
    }

    #[must_use]
    pub fn step(&self) -> u32 {
        self.step
    }

    #[must_use]
    pub fn total(&self) -> u32 {
        self.total
    }
}

struct StatePaths {
    rebase_merge: PathBuf,
    rebase_apply: PathBuf,
    sequencer: PathBuf,
    squash_msg: PathBuf,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SequenceStep {
    Pick,
    Revert,
}

impl Repo {
    /// What git is doing now; `operation: None` when git records nothing (no conflict operation, stash pop/apply,
    /// `checkout -m`). Git failures are `Err`, as every `Repo` read.
    pub fn stop(&self) -> Result<Stop> {
        let paths = self.state_paths()?;
        Ok(Stop {
            operation: self.operation(&paths)?,
            head: self.commit_named("HEAD")?,
        })
    }

    fn state_paths(&self) -> Result<StatePaths> {
        let paths = self.git_paths(&STATE_PATHS)?;
        match paths.as_slice() {
            [rebase_merge, rebase_apply, sequencer, squash_msg] => Ok(StatePaths {
                rebase_merge: rebase_merge.clone(),
                rebase_apply: rebase_apply.clone(),
                sequencer: sequencer.clone(),
                squash_msg: squash_msg.clone(),
            }),
            _ => Err(Error::UnexpectedOutput {
                command: "rev-parse",
                output: format!("{paths:?}"),
            }),
        }
    }

    // The order of git's own `wt_status_get_state` (wt-status.c): a rebase or `am` first, even
    // with `MERGE_HEAD`, then `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, the sequencer.
    fn operation(&self, paths: &StatePaths) -> Result<Option<Operation>> {
        if exists(&paths.rebase_apply)? {
            return self.applying_patches(&paths.rebase_apply).map(Some);
        }
        if exists(&paths.rebase_merge)? {
            let rebase_merge = &paths.rebase_merge;
            let todo = read_if_present(&rebase_merge.join("git-rebase-todo"))?;
            let editor_steps_ahead = todo.is_some_and(|todo| has_editor_steps(&todo));
            let progress = progress_in(rebase_merge, "msgnum", "end")?;
            let rebase = self.rebase(rebase_merge, progress, editor_steps_ahead)?;
            return Ok(Some(Operation::Rebase(rebase)));
        }
        if let Some(merging) = self.commit_named("MERGE_HEAD")? {
            return Ok(Some(Operation::Merge { merging }));
        }
        self.sequence_or_squash(paths)
    }

    fn applying_patches(&self, rebase_apply: &Path) -> Result<Operation> {
        let progress = progress_in(rebase_apply, "next", "last")?;
        if !exists(&rebase_apply.join("applying"))? {
            return Ok(Operation::Rebase(self.rebase(
                rebase_apply,
                progress,
                false,
            )?));
        }
        let message = read_if_present(&rebase_apply.join("final-commit"))?.unwrap_or_default();
        let subject = first_line(&message).to_vec();
        Ok(Operation::Am {
            subject,
            message,
            progress,
        })
    }

    fn rebase(
        &self,
        state_dir: &Path,
        progress: Option<Progress>,
        editor_steps_ahead: bool,
    ) -> Result<Rebase> {
        let head_name = read_if_present(&state_dir.join("head-name"))?;
        Ok(Rebase {
            branch: head_name.as_deref().and_then(branch_name),
            onto: read_oid(&state_dir.join("onto"))?,
            replaying: self.commit_named("REBASE_HEAD")?,
            redoing_merge: self.commit_named("MERGE_HEAD")?,
            progress,
            editor_steps_ahead,
        })
    }

    fn sequence_or_squash(&self, paths: &StatePaths) -> Result<Option<Operation>> {
        let todo = read_if_present(&paths.sequencer.join("todo"))?.unwrap_or_default();
        let next = first_command(&todo).and_then(sequence_step);
        let Some((step, applying)) = self.applied_step(next)? else {
            return self.squash_merge(&paths.squash_msg);
        };
        let progress = if next == Some(step) {
            self.sequence_progress(&paths.sequencer, &todo)?
        } else {
            None
        };
        Ok(Some(match step {
            SequenceStep::Pick => Operation::CherryPick {
                picking: applying,
                progress,
            },
            SequenceStep::Revert => Operation::Revert {
                reverting: applying,
                progress,
            },
        }))
    }

    fn applied_step(
        &self,
        next: Option<SequenceStep>,
    ) -> Result<Option<(SequenceStep, Option<Oid>)>> {
        if let Some(picking) = self.commit_named("CHERRY_PICK_HEAD")? {
            return Ok(Some((SequenceStep::Pick, Some(picking))));
        }
        if let Some(reverting) = self.commit_named("REVERT_HEAD")? {
            return Ok(Some((SequenceStep::Revert, Some(reverting))));
        }
        Ok(next.map(|step| (step, None)))
    }

    // The stopped command is still `todo`'s first line and git keeps no `done` file
    // (`cherry_pick_range_progress_moves_from_one_to_two_of_three`); every earlier step made one commit,
    // unless the range runs with `--no-commit` (`opts` as sequencer.c `save_opts` writes it).
    fn sequence_progress(&self, sequencer: &Path, todo: &[u8]) -> Result<Option<Progress>> {
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

    fn squash_merge(&self, squash_msg: &Path) -> Result<Option<Operation>> {
        let Some(message) = read_if_present(squash_msg)? else {
            return Ok(None);
        };
        let named = message
            .split(|&byte| byte == b'\n')
            .find_map(|line| line.strip_prefix(SQUASHED_COMMIT_PREFIX))
            .and_then(oid_in);
        let merging = match named {
            Some(oid) => self.commit_named(oid.as_str())?,
            None => None,
        };
        Ok(Some(Operation::SquashMerge { merging }))
    }
}

fn progress_in(state_dir: &Path, step_file: &str, total_file: &str) -> Result<Option<Progress>> {
    let step = read_if_present(&state_dir.join(step_file))?;
    let total = read_if_present(&state_dir.join(total_file))?;
    let (Some(step), Some(total)) = (step, total) else {
        return Ok(None);
    };
    Ok(number_in(&step)
        .zip(number_in(&total))
        .and_then(|(step, total)| Progress::new(step, total)))
}

fn number_in(text: &[u8]) -> Option<u32> {
    String::from_utf8_lossy(text.trim_ascii()).parse().ok()
}

fn oid_in(text: &[u8]) -> Option<Oid> {
    Oid::parse(&String::from_utf8_lossy(text.trim_ascii())).ok()
}

fn read_oid(path: &Path) -> Result<Option<Oid>> {
    Ok(read_if_present(path)?.as_deref().and_then(oid_in))
}

fn branch_name(head_name: &[u8]) -> Option<Vec<u8>> {
    let branch = head_name.trim_ascii_end().strip_prefix(BRANCH_REF_PREFIX)?;
    Some(branch.to_vec())
}

fn sequence_step(command: &[u8]) -> Option<SequenceStep> {
    match command {
        b"pick" | b"p" => Some(SequenceStep::Pick),
        b"revert" => Some(SequenceStep::Revert),
        _ => None,
    }
}

fn makes_no_commits(opts: &[u8]) -> bool {
    opts.split(|&byte| byte == b'\n')
        .any(|line| line.trim_ascii() == b"no-commit = true")
}

fn first_line(message: &[u8]) -> &[u8] {
    message
        .split(|&byte| byte == b'\n')
        .next()
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_exists_only_from_one_up_to_the_total() {
        assert_eq!(Progress::new(0, 3), None);
        assert_eq!(Progress::new(4, 3), None);
        let last = Progress::new(3, 3).unwrap();
        assert_eq!((last.step(), last.total()), (3, 3));
        assert_eq!(Progress::new(1, 1).map(|one| one.step()), Some(1));
    }

    fn rebase_at(progress: Option<Progress>, editor_steps_ahead: bool) -> Stop {
        let rebase = Rebase {
            branch: None,
            onto: None,
            replaying: None,
            redoing_merge: None,
            progress,
            editor_steps_ahead,
        };
        let operation = Some(Operation::Rebase(rebase));
        Stop {
            operation,
            head: None,
        }
    }

    fn am_at(progress: Option<Progress>) -> Stop {
        let (subject, message) = (Vec::new(), Vec::new());
        let operation = Some(Operation::Am {
            subject,
            message,
            progress,
        });
        Stop {
            operation,
            head: None,
        }
    }

    #[test]
    fn an_id_leaves_out_progress_and_steps_ahead_but_keeps_the_patch_number() {
        let first = rebase_at(Progress::new(1, 3), false).id();
        assert_eq!(rebase_at(Progress::new(1, 2), true).id(), first);
        let range = |progress| Stop {
            operation: Some(Operation::Revert {
                reverting: None,
                progress,
            }),
            head: None,
        };
        assert_eq!(range(Progress::new(1, 3)).id(), range(None).id());
        assert_ne!(
            am_at(Progress::new(1, 3)).id(),
            am_at(Progress::new(2, 3)).id()
        );
    }

    #[test]
    fn unreadable_numbers_give_no_progress() {
        assert_eq!(number_in(b" 2\n"), Some(2));
        assert_eq!(number_in(b"two"), None);
        assert_eq!(number_in(b"-1"), None);
    }

    #[test]
    fn only_a_no_commit_option_set_to_true_makes_no_commits() {
        assert!(makes_no_commits(b"[options]\n\tno-commit = true\n"));
        assert!(!makes_no_commits(b"[options]\n\tsignoff = true\n"));
        assert!(!makes_no_commits(b""));
    }
}

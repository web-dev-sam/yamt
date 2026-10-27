use crate::Result;
use crate::operation::Operation;
use crate::repo::Repo;
use crate::run::{run_to_end, run_to_success};

/// What one git run printed, stdout then stderr, and whether it exited 0.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GitRun {
    pub succeeded: bool,
    pub output: Vec<u8>,
}

impl Repo {
    /// git's own abort for `operation` (plan §2 #88; a squash merge: `reset --merge`, as `merge --abort`
    /// refuses without `MERGE_HEAD`). No deadline: a kill in the middle of a reset leaves `index.lock`.
    /// A refusal is `Error::GitFailed` with git's stderr.
    pub fn abort(&self, operation: &Operation) -> Result<()> {
        run_to_success(self.command_as_user(&abort_args(operation)))?;
        Ok(())
    }

    /// git's own continue for `operation` (plan §2 #89; a squash merge: `commit`). A non-zero exit is not
    /// an `Err`: the caller reads the stop again to learn what happened.
    pub fn continue_operation(&self, operation: &Operation) -> Result<GitRun> {
        let mut command = self.command_as_user(continue_args(operation));
        // GIT_EDITOR wins over core.editor, and `:` is never run (git editor.c): the commit keeps
        // git's prepared message with its comment lines stripped, as an editor saved unchanged would.
        command.env("GIT_EDITOR", ":");
        let finished = run_to_end(command)?;
        Ok(GitRun {
            succeeded: finished.status.success(),
            output: finished.combined(),
        })
    }
}

fn abort_args(operation: &Operation) -> [&'static str; 2] {
    match operation {
        Operation::Merge { .. } => ["merge", "--abort"],
        Operation::SquashMerge { .. } => ["reset", "--merge"],
        Operation::Rebase(_) => ["rebase", "--abort"],
        Operation::CherryPick { .. } => ["cherry-pick", "--abort"],
        Operation::Revert { .. } => ["revert", "--abort"],
        Operation::Am { .. } => ["am", "--abort"],
    }
}

fn continue_args(operation: &Operation) -> &'static [&'static str] {
    match operation {
        Operation::Merge { .. } => &["merge", "--continue"],
        Operation::SquashMerge { .. } => &["commit"],
        Operation::Rebase(_) => &["rebase", "--continue"],
        Operation::CherryPick { .. } => &["cherry-pick", "--continue"],
        Operation::Revert { .. } => &["revert", "--continue"],
        Operation::Am { .. } => &["am", "--continue"],
    }
}

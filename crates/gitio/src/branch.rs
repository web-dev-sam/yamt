use crate::Result;
use crate::abort_continue::GitRun;
use crate::entry::Oid;
use crate::repo::Repo;
use crate::run::{Access, GIT_TIMEOUT, run, run_to_end, run_to_success};

impl Repo {
    /// `git checkout --quiet -B <branch> <commit>`: the branch created, or moved, at `commit` and checked out; an
    /// existing branch keeps its `branch.<branch>.*` config. No deadline: writing a large tree takes long.
    pub fn checkout_branch_at(&self, branch: &str, commit: &Oid) -> Result<()> {
        let args = ["checkout", "--quiet", "-B", branch, commit.as_str()];
        run_to_success(self.command(Access::Write, &args))?;
        Ok(())
    }

    /// `git checkout --quiet <branch> --`. No deadline: writing a large tree takes long.
    pub fn checkout_branch(&self, branch: &str) -> Result<()> {
        let args = ["checkout", "--quiet", branch, "--"];
        run_to_success(self.command(Access::Write, &args))?;
        Ok(())
    }

    /// `git config branch.<branch>.remote <remote>`, then `git config branch.<branch>.merge refs/heads/<branch>`:
    /// what `--track` writes, whatever the remote's fetch refspec.
    pub fn set_upstream(&self, branch: &str, remote: &str) -> Result<()> {
        self.set_config(&format!("branch.{branch}.remote"), remote)?;
        self.set_config(
            &format!("branch.{branch}.merge"),
            &format!("refs/heads/{branch}"),
        )
    }

    fn set_config(&self, key: &str, value: &str) -> Result<()> {
        run(
            self.command(Access::Write, &["config", key, value]),
            None,
            GIT_TIMEOUT,
        )?;
        Ok(())
    }

    /// `git branch --quiet -D <branch>`, its `branch.<branch>.*` config with it; git refuses a branch checked out
    /// in any worktree.
    pub fn delete_branch(&self, branch: &str) -> Result<()> {
        let command = self.command(Access::Write, &["branch", "--quiet", "-D", branch]);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    /// `git branch --quiet --force <branch> <commit>`; git refuses a branch checked out in any worktree.
    pub fn move_branch(&self, branch: &str, commit: &Oid) -> Result<()> {
        let args = ["branch", "--quiet", "--force", branch, commit.as_str()];
        run(self.command(Access::Write, &args), None, GIT_TIMEOUT)?;
        Ok(())
    }

    /// `git reset --quiet --keep <commit>`: the checked-out branch moved to `commit`, refused when a local change
    /// is in the way (git-reset(1)). No deadline: writing a large tree takes long.
    pub fn reset_keep(&self, commit: &Oid) -> Result<()> {
        let args = ["reset", "--quiet", "--keep", commit.as_str()];
        run_to_success(self.command(Access::Write, &args))?;
        Ok(())
    }

    /// `git merge --no-ff --no-commit <rev>`. No deadline: a large merge takes long. A non-zero exit is not an
    /// `Err`, as in `continue_operation`: the caller reads the stop to learn what happened.
    pub fn merge_no_commit(&self, rev: &str) -> Result<GitRun> {
        let args = ["merge", "--no-ff", "--no-commit", rev];
        let finished = run_to_end(self.command(Access::Write, &args))?;
        Ok(GitRun {
            succeeded: finished.status.success(),
            output: finished.combined(),
        })
    }
}

use std::time::Duration;

use crate::entry::Oid;
use crate::objects::refuse_lazy_fetch;
use crate::repo::Repo;
use crate::run::{Access, run};
use crate::{Error, GitVersion, Result};

const MERGE_TREE: &str = "merge-tree";
const CONFLICTS_STATUS: i32 = 1;
const FIRST_WITH_WRITE_TREE: GitVersion = GitVersion {
    major: 2,
    minor: 38,
};
const FIRST_WITH_QUIET: GitVersion = GitVersion {
    major: 2,
    minor: 50,
};

/// Whether git's merge of two commits is clean.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MergeOutcome {
    Clean,
    Conflicts,
}

/// How `merge_tree` runs git, by what the installed git can do.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MergeTreeRun {
    /// `--write-tree --quiet` (git 2.50+): no object is written, and git stops at the first conflict.
    Quiet,
    /// `--write-tree` (git 2.38–2.49): the merge's objects are left unreferenced in the object store.
    Writing,
}

impl MergeTreeRun {
    /// The run `version` can do; `None` before 2.38, which has no `--write-tree`.
    #[must_use]
    pub fn for_version(version: GitVersion) -> Option<MergeTreeRun> {
        if version >= FIRST_WITH_QUIET {
            Some(MergeTreeRun::Quiet)
        } else if version >= FIRST_WITH_WRITE_TREE {
            Some(MergeTreeRun::Writing)
        } else {
            None
        }
    }
}

impl Repo {
    /// `git merge-tree --write-tree [--quiet] <first> <second>` (`Quiet` adds `--quiet`): exit 0 → `Clean`,
    /// exit 1 with nothing on stderr → `Conflicts`, any other exit → `Error::GitFailed`; killed at `timeout` →
    /// `Error::Timeout`. Never reads or writes the index, the working tree or a ref (git-merge-tree(1)), and never
    /// fetches an object a partial clone lacks: the run fails instead.
    pub fn merge_tree(
        &self,
        first: &Oid,
        second: &Oid,
        run_kind: MergeTreeRun,
        timeout: Duration,
    ) -> Result<MergeOutcome> {
        let (access, options): (Access, &[&str]) = match run_kind {
            MergeTreeRun::Quiet => (Access::Read, &["--write-tree", "--quiet"]),
            MergeTreeRun::Writing => (Access::Write, &["--write-tree"]),
        };
        let mut command = self.command(access, &[MERGE_TREE]);
        command
            .args(options)
            .args([first.as_str(), second.as_str()]);
        refuse_lazy_fetch(&mut command);
        // git also exits 1 for a commit it cannot find, printing "merge-tree: <id> - not something we can merge"
        // (measured with git 2.56, both forms); a conflict leaves stderr empty.
        match run(command, None, timeout) {
            Ok(_) => Ok(MergeOutcome::Clean),
            Err(Error::GitFailed {
                status: Some(CONFLICTS_STATUS),
                stderr,
                ..
            }) if stderr.is_empty() => Ok(MergeOutcome::Conflicts),
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run_for(major: u32, minor: u32) -> Option<MergeTreeRun> {
        MergeTreeRun::for_version(GitVersion { major, minor })
    }

    #[test]
    fn git_before_2_38_cannot_merge_without_a_worktree() {
        assert_eq!(run_for(2, 37), None);
        assert_eq!(run_for(1, 99), None);
    }

    #[test]
    fn git_2_38_to_2_49_writes_the_merge_objects() {
        assert_eq!(run_for(2, 38), Some(MergeTreeRun::Writing));
        assert_eq!(run_for(2, 49), Some(MergeTreeRun::Writing));
    }

    #[test]
    fn git_2_50_and_later_merges_quietly() {
        assert_eq!(run_for(2, 50), Some(MergeTreeRun::Quiet));
        assert_eq!(run_for(3, 0), Some(MergeTreeRun::Quiet));
    }
}

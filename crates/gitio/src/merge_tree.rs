use std::time::Duration;

use crate::entry::Oid;
use crate::objects::refuse_lazy_fetch;
use crate::repo::Repo;
use crate::run::{Access, run};
use crate::{Error, GitVersion, Result};

const MERGE_TREE: &str = "merge-tree";
const NO_GLOBAL_ATTRIBUTES: &str = "core.attributesFile=";
const CONFLICTS_STATUS: i32 = 1;
const FIRST_WITH_WRITE_TREE: GitVersion = GitVersion {
    major: 2,
    minor: 38,
};

/// Whether `version` has `merge-tree --write-tree` (git 2.38.0 release notes).
#[must_use]
pub fn merge_tree_supported(version: GitVersion) -> bool {
    version >= FIRST_WITH_WRITE_TREE
}

/// Whether git's merge of two commits is clean.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MergeOutcome {
    Clean,
    Conflicts,
}

impl Repo {
    /// `git merge-tree --write-tree <first> <second>`: exit 0 → `Clean`, exit 1 with nothing on stderr → `Conflicts`,
    /// any other exit → `Error::GitFailed`; killed at `timeout` → `Error::Timeout`. Leaves the merge's objects
    /// unreferenced in the object store; never reads or writes the index, the working tree or a ref
    /// (git-merge-tree(1)), and never fetches an object a partial clone lacks: the run fails instead.
    /// No `--quiet`: git 2.50.1 exited 0 on a content conflict the plain form reports (brief local-conflicts-no-quiet).
    /// Attributes come from `first`'s tree only (`attr.tree`), never the working tree, the global or the system
    /// file (gitattributes(5); git(1) "ENVIRONMENT" `GIT_ATTR_NOSYSTEM`); except `$GIT_DIR/info/attributes`, which
    /// gitattributes(5) reads with the highest precedence, and git before 2.43, which ignores `attr.tree` (git
    /// 2.43.0 release notes).
    pub fn merge_tree(&self, first: &Oid, second: &Oid, timeout: Duration) -> Result<MergeOutcome> {
        let attributes_tree = format!("attr.tree={}", first.as_str());
        let args = [
            "-c",
            &attributes_tree,
            "-c",
            NO_GLOBAL_ATTRIBUTES,
            MERGE_TREE,
            "--write-tree",
            first.as_str(),
            second.as_str(),
        ];
        let mut command = self.command(Access::Write, &args);
        refuse_lazy_fetch(&mut command);
        command.env("GIT_ATTR_NOSYSTEM", "1");
        // git also exits 1 for a commit it cannot find, printing "merge-tree: <id> - not something we can merge"
        // (measured with git 2.56); a conflict leaves stderr empty.
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

    fn supported(major: u32, minor: u32) -> bool {
        merge_tree_supported(GitVersion { major, minor })
    }

    #[test]
    fn git_before_2_38_cannot_merge_without_a_worktree() {
        assert!(!supported(2, 37));
        assert!(!supported(1, 99));
    }

    #[test]
    fn git_2_38_and_later_can_merge_without_a_worktree() {
        assert!(supported(2, 38));
        assert!(supported(3, 0));
    }
}

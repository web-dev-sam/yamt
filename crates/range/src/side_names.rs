use yamt_gitio::{Oid, Repo};

use crate::Result;
use crate::open::commit_named;
use crate::spec::{Dots, RangeSpec};

const REFS_PREFIX: &str = "refs/";

/// One side of the range as a review remembers it (plan §2 #195, request rule 4).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SideName {
    /// The full ref `symbolic_full_name` gives when it starts with `refs/` (`HEAD` on a branch → that branch).
    Ref { full_name: String },
    /// Otherwise (a commit id, a detached HEAD, `HEAD~2`): the commit the typed name names now.
    Commit { id: Oid },
}

/// Both typed sides by name and the dots between them; the left is the typed left, never the merge base.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SideNames {
    pub left: SideName,
    pub dots: Dots,
    pub right: SideName,
}

pub(crate) fn side_names(repo: &Repo, spec: &RangeSpec) -> Result<SideNames> {
    Ok(SideNames {
        left: side_name(repo, &spec.left)?,
        dots: spec.dots,
        right: side_name(repo, &spec.right)?,
    })
}

/// `commit_named` first: it answers an unknown name as `UnknownName`, where `symbolic_full_name` fails.
fn side_name(repo: &Repo, typed: &str) -> Result<SideName> {
    let id = commit_named(repo, typed)?;
    let full_name = repo
        .symbolic_full_name(typed)?
        .and_then(|name| String::from_utf8(name).ok())
        .filter(|name| name.starts_with(REFS_PREFIX));
    Ok(match full_name {
        Some(full_name) => SideName::Ref { full_name },
        None => SideName::Commit { id },
    })
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};

    use super::*;
    use crate::{Error, Resolved};

    fn repo() -> TempDir {
        let file = ConflictFile {
            path: "a.txt",
            kind: FileKind::Regular,
            base: Some(b"base\n"),
            local: Some(b"local\n"),
            remote: Some(b"remote\n"),
        };
        diverged_repo(&[file]).unwrap()
    }

    fn rev_parse(root: &Path, args: &[&str]) -> String {
        let output = git_ok(root, &[&["rev-parse"], args].concat()).unwrap();
        String::from_utf8(output).unwrap().trim_end().to_owned()
    }

    fn commit(root: &Path, revision: &str) -> SideName {
        SideName::Commit {
            id: Oid::parse(&rev_parse(root, &[revision])).unwrap(),
        }
    }

    fn reference(full_name: &str) -> SideName {
        SideName::Ref {
            full_name: full_name.to_owned(),
        }
    }

    fn names(root: &Path, text: &str) -> SideNames {
        let spec = RangeSpec::parse(text).unwrap();
        let range = Resolved::resolve(root, &spec).unwrap().list().unwrap();
        range.side_names().unwrap()
    }

    #[test]
    fn side_names_follow_the_branch_head_names_and_keep_a_commit_id() {
        let repo = repo();
        let root = repo.path();
        git_ok(root, &["branch", "dev", "main"]).unwrap();
        git_ok(root, &["checkout", "--quiet", "-b", "feature-x"]).unwrap();

        let on_branch = SideNames {
            left: reference("refs/heads/dev"),
            dots: Dots::Three,
            right: reference("refs/heads/feature-x"),
        };
        assert_eq!(names(root, "dev...HEAD"), on_branch);

        let abbreviated = rev_parse(root, &["--short", "remote"]);
        let by_id = SideNames {
            left: reference("refs/heads/main"),
            dots: Dots::Two,
            right: commit(root, "remote"),
        };
        assert_eq!(names(root, &format!("main..{abbreviated}")), by_id);
    }

    #[test]
    fn a_detached_head_and_an_expression_are_the_commit_they_name_now() {
        let repo = repo();
        let root = repo.path();
        git_ok(root, &["checkout", "--quiet", "--detach", "local"]).unwrap();

        let detached = SideNames {
            left: commit(root, "main"),
            dots: Dots::Two,
            right: commit(root, "local"),
        };
        assert_eq!(names(root, "HEAD~1..HEAD"), detached);
    }

    #[test]
    fn a_side_name_git_no_longer_knows_is_unknown_name() {
        let repo = repo();
        let root = repo.path();
        let spec = RangeSpec::parse("main..remote").unwrap();
        let range = Resolved::resolve(root, &spec).unwrap().list().unwrap();
        git_ok(root, &["branch", "--quiet", "-D", "remote"]).unwrap();

        let refused = range.side_names().unwrap_err();
        assert!(
            matches!(&refused, Error::UnknownName { name } if name == "remote"),
            "{refused:?}"
        );
    }
}

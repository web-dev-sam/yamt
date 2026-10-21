use std::fs;
use std::path::Path;

use crate::{ConflictFile, Result, Run, TempDir, commit_side, diverged_repo, git_ok, stopped};

const MERGE: [&str; 3] = ["merge", "--quiet", "remote"];
const MERGE_LATER: [&str; 3] = ["merge", "--quiet", "later"];

/// A file whose conflict was resolved to `resolution` in an earlier merge, so rerere remembers it.
#[derive(Clone, Copy, Debug)]
pub struct Remembered<'a> {
    pub file: ConflictFile<'a>,
    pub resolution: &'a [u8],
}

/// What rerere does in the second merge.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Replay {
    /// `rerere.autoUpdate` false: git replays a resolution and leaves it unstaged for review.
    Review,
    /// `rerere.autoUpdate` true: git replays a resolution and stages it.
    Stage,
    /// `rerere.enabled` false after the first merge was committed and kept: nothing is replayed, and
    /// the empty `MERGE_RR` that commit left stays. Only the `fresh` files conflict, merged from
    /// branch `later`.
    Off,
}

/// A repo where `git merge` on branch `local` stopped a second time: each `remembered` file's
/// conflict was resolved and committed in a first merge of `remote` with rerere on, which `Review`
/// and `Stage` then undo, so rerere replays its resolution; each `fresh` file conflicts only in the
/// second merge, and needs sides no remembered file has (rerere.c identifies a conflict by its text,
/// not its path).
pub fn rerere_repo(
    remembered: &[Remembered],
    fresh: &[ConflictFile],
    replay: Replay,
) -> Result<TempDir> {
    let fresh_in_first = fresh.iter().map(|file| match replay {
        Replay::Review | Replay::Stage => ConflictFile {
            remote: file.local,
            ..*file
        },
        Replay::Off => ConflictFile {
            local: file.base,
            remote: file.base,
            ..*file
        },
    });
    let first: Vec<ConflictFile> = remembered
        .iter()
        .map(|resolved| resolved.file)
        .chain(fresh_in_first)
        .collect();
    let dir = diverged_repo(&first)?;
    let root = dir.path();
    if replay == Replay::Off {
        commit_remote_again(root, fresh, "later")?;
    }
    first_merge_committed(root, remembered, replay)?;
    match replay {
        Replay::Review | Replay::Stage => {
            git_ok(root, &["reset", "--quiet", "--hard", "HEAD^"])?;
            if !fresh.is_empty() {
                commit_remote_again(root, fresh, "remote")?;
            }
            stopped(Run::Merge, root, &MERGE, None)?;
        }
        Replay::Off => {
            git_ok(root, &["config", "rerere.enabled", "false"])?;
            commit_side(root, fresh, |file| file.local, "local again")?;
            stopped(Run::Merge, root, &MERGE_LATER, None)?;
        }
    }
    Ok(dir)
}

fn first_merge_committed(root: &Path, remembered: &[Remembered], replay: Replay) -> Result<()> {
    let auto_update = match replay {
        Replay::Review | Replay::Off => "false",
        Replay::Stage => "true",
    };
    git_ok(root, &["config", "rerere.enabled", "true"])?;
    git_ok(root, &["config", "rerere.autoUpdate", auto_update])?;
    stopped(Run::Merge, root, &MERGE, None)?;
    for resolved in remembered {
        fs::write(root.join(resolved.file.path), resolved.resolution)?;
        git_ok(root, &["add", "--", resolved.file.path])?;
    }
    git_ok(root, &["commit", "--quiet", "--no-edit"])?;
    Ok(())
}

/// Commits each `fresh` file's remote side on `branch`, made or moved to `remote` first; a checkout
/// drops `MERGE_RR` (branch.c `remove_merge_branch_state`), so it runs before any merge that needs it kept.
fn commit_remote_again(root: &Path, fresh: &[ConflictFile], branch: &str) -> Result<()> {
    git_ok(root, &["checkout", "--quiet", "-B", branch, "remote"])?;
    commit_side(root, fresh, |file| file.remote, "remote again")?;
    git_ok(root, &["checkout", "--quiet", "local"])?;
    Ok(())
}

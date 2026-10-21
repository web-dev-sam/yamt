use std::fs;

use crate::{ConflictFile, Result, Run, TempDir, commit_side, diverged_repo, git_ok, stopped};

const MERGE: [&str; 3] = ["merge", "--quiet", "remote"];

/// A file whose conflict was resolved to `resolution` in an earlier merge, so rerere remembers it.
#[derive(Clone, Copy, Debug)]
pub struct Remembered<'a> {
    pub file: ConflictFile<'a>,
    pub resolution: &'a [u8],
}

/// `rerere.autoUpdate`: git leaves a replayed resolution unstaged for review, or stages it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Replay {
    Review,
    Stage,
}

/// A repo where `git merge remote` on branch `local` stopped a second time with rerere on: each
/// `remembered` file's conflict was resolved and committed in a first merge that was then undone,
/// so rerere replays its resolution; each `fresh` file conflicts only in the second merge, and needs
/// sides no remembered file has (rerere.c identifies a conflict by its text, not its path).
pub fn rerere_repo(
    remembered: &[Remembered],
    fresh: &[ConflictFile],
    replay: Replay,
) -> Result<TempDir> {
    let fresh_as_local = fresh.iter().map(|file| ConflictFile {
        remote: file.local,
        ..*file
    });
    let first: Vec<ConflictFile> = remembered
        .iter()
        .map(|resolved| resolved.file)
        .chain(fresh_as_local)
        .collect();
    let dir = diverged_repo(&first)?;
    let root = dir.path();
    let auto_update = match replay {
        Replay::Review => "false",
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
    git_ok(root, &["reset", "--quiet", "--hard", "HEAD^"])?;
    if !fresh.is_empty() {
        git_ok(root, &["checkout", "--quiet", "remote"])?;
        commit_side(root, fresh, |file| file.remote, "remote again")?;
        git_ok(root, &["checkout", "--quiet", "local"])?;
    }
    stopped(Run::Merge, root, &MERGE, None)?;
    Ok(dir)
}

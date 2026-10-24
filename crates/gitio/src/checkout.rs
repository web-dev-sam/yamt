use std::path::{Path, PathBuf};
use std::process::Command;

use crate::entry::{Oid, path_from_git};
use crate::repo::{REV_PARSE, Repo, without_final_newline};
use crate::run::{Access, GIT_TIMEOUT, argv, run, run_to_end};
use crate::{Error, Result};

const STATUS: &str = "status";
const FOR_EACH_REF: &str = "for-each-ref";

/// One file `git status --porcelain=v1` lists: its two status letters (`??` untracked) and its path.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StatusEntry {
    pub xy: [u8; 2],
    pub path: PathBuf,
}

impl Repo {
    /// `git clone --shared --no-checkout --quiet <this repository> <into>`, then HEAD detached at the cloned
    /// branch's commit and that branch deleted, so the clone holds no branch of this repository. No deadline:
    /// a large repository takes long. A relative `into` is relative to this repository's root.
    pub fn clone_shared_into(&self, into: &Path) -> Result<Repo> {
        let into = self.root().join(into);
        let mut command = self.command(
            Access::Write,
            &["clone", "--shared", "--no-checkout", "--quiet", "--"],
        );
        command.arg(self.root()).arg(&into);
        run_to_success(command)?;
        let clone = Repo::discover(&into)?;
        clone.delete_branches_detaching_head()?;
        Ok(clone)
    }

    /// `git remote remove <name>`: the remote, its remote-tracking branches and its config.
    pub fn remove_remote(&self, name: &str) -> Result<()> {
        let command = self.command(Access::Write, &["remote", "remove", name]);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    /// `git checkout --detach --quiet <commit>`. No deadline: writing a large tree takes long.
    pub fn checkout_detached(&self, commit: &Oid) -> Result<()> {
        let args = ["checkout", "--detach", "--quiet", commit.as_str()];
        run_to_success(self.command(Access::Write, &args))
    }

    /// Every modified, added, deleted and untracked file, never an ignored one:
    /// `git status --porcelain=v1 -z --untracked-files=all --no-renames`.
    pub fn status_entries(&self) -> Result<Vec<StatusEntry>> {
        let args = [
            STATUS,
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--no-renames",
        ];
        parse_status(&run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?)
    }

    /// The commit HEAD names: `git rev-parse --verify HEAD^{commit}`.
    pub fn head_commit(&self) -> Result<Oid> {
        let command = self.command(Access::Read, &[REV_PARSE, "--verify", "HEAD^{commit}"]);
        let line = without_final_newline(REV_PARSE, run(command, None, GIT_TIMEOUT)?)?;
        Oid::parse(&String::from_utf8_lossy(&line))
    }

    fn delete_branches_detaching_head(&self) -> Result<()> {
        let Some(head) = self.commit_named("HEAD")? else {
            return Ok(());
        };
        let detach = ["update-ref", "--no-deref", "HEAD", head.as_str()];
        run(self.command(Access::Write, &detach), None, GIT_TIMEOUT)?;
        let listing = self.command(
            Access::Read,
            &[FOR_EACH_REF, "--format=%(refname)", "refs/heads"],
        );
        let mut deletes = Vec::new();
        for branch in run(listing, None, GIT_TIMEOUT)?.split(|&byte| byte == b'\n') {
            if !branch.is_empty() {
                deletes.extend_from_slice(b"delete ");
                deletes.extend_from_slice(branch);
                deletes.push(b'\n');
            }
        }
        let command = self.command(Access::Write, &["update-ref", "--stdin"]);
        run(command, Some(deletes), GIT_TIMEOUT)?;
        Ok(())
    }
}

fn run_to_success(command: Command) -> Result<()> {
    let args = argv(&command);
    let finished = run_to_end(command)?;
    if finished.status.success() {
        return Ok(());
    }
    Err(Error::GitFailed {
        args,
        status: finished.status.code(),
        stderr: String::from_utf8_lossy(&finished.stderr)
            .trim_end()
            .to_owned(),
    })
}

// git-status(1) "Porcelain Format Version 1" with `-z`: records `XY SP <path> NUL`, path unquoted; without
// renames no record carries a second path.
fn parse_status(output: &[u8]) -> Result<Vec<StatusEntry>> {
    let mut entries = Vec::new();
    for record in output.split(|&byte| byte == b'\0') {
        if record.is_empty() {
            continue;
        }
        let entry = status_entry(record).ok_or_else(|| Error::UnexpectedOutput {
            command: STATUS,
            output: String::from_utf8_lossy(record).into_owned(),
        })?;
        entries.push(entry);
    }
    Ok(entries)
}

fn status_entry(record: &[u8]) -> Option<StatusEntry> {
    match record {
        [x, y, b' ', path @ ..] if !path.is_empty() => Some(StatusEntry {
            xy: [*x, *y],
            path: path_from_git(path),
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(xy: [u8; 2], path: &str) -> StatusEntry {
        StatusEntry {
            xy,
            path: PathBuf::from(path),
        }
    }

    #[test]
    fn status_records_parse_with_their_letters_and_paths_as_written() {
        let output = b"?? new file.txt\0 D gone\nline.txt\0M  staged.txt\0A  added.txt\0";

        let entries = parse_status(output).unwrap();

        let expected = vec![
            entry(*b"??", "new file.txt"),
            entry(*b" D", "gone\nline.txt"),
            entry(*b"M ", "staged.txt"),
            entry(*b"A ", "added.txt"),
        ];
        assert_eq!(entries, expected);
    }

    #[cfg(unix)]
    #[test]
    fn a_status_path_that_is_not_utf8_keeps_its_bytes() {
        use std::os::unix::ffi::OsStrExt;

        let entries = parse_status(b" M bytes \xff\xfe.txt\0").unwrap();

        let path = PathBuf::from(std::ffi::OsStr::from_bytes(b"bytes \xff\xfe.txt"));
        assert_eq!(entries, vec![StatusEntry { xy: *b" M", path }]);
    }

    #[test]
    fn a_clean_status_lists_nothing() {
        assert_eq!(parse_status(b"").unwrap(), Vec::new());
    }

    #[test]
    fn a_status_record_without_a_path_or_its_space_is_unexpected_output() {
        for record in [&b"?? \0"[..], b"??x.txt\0", b"M\0"] {
            let error = parse_status(record).unwrap_err();
            assert!(
                matches!(
                    error,
                    Error::UnexpectedOutput {
                        command: STATUS,
                        ..
                    }
                ),
                "{record:?}: {error:?}"
            );
        }
    }
}

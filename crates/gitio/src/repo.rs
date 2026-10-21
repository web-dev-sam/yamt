use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::blob::{BlobReader, CAT_FILE};
use crate::entry::{LS_FILES, Oid, index_info, parse_unmerged, path_from_git};
use crate::run::{Access, GIT_TIMEOUT, git_command, run};
use crate::{Error, Result, StageEntry};

const REV_PARSE: &str = "rev-parse";
const BRANCH: &str = "branch";
const LOG: &str = "log";
const HASH_OBJECT: &str = "hash-object";
const MERGE_MSG: &str = "MERGE_MSG";
const REBASE_STATE_DIRS: [&str; 2] = ["rebase-merge", "rebase-apply"];
const UNRESOLVED_NAME_STATUS: i32 = 1;
const NON_SYMBOLIC_SHORT_NAME: &str =
    "--format=%(if)%(symref)%(then)%(else)%(refname:lstrip=2)%(end)";
const SHORT_ID_SUBJECT_MESSAGE: &str = "--format=%h%x00%s%x00%B";
const COMMIT_SUMMARY_FIELDS: usize = 3;

pub struct Repo {
    root: PathBuf,
    git: PathBuf,
}

/// A commit as `git log` prints it: `%h`, `%s` and `%B`, bytes as git wrote them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitSummary {
    pub short_id: Vec<u8>,
    pub subject: Vec<u8>,
    pub message: Vec<u8>,
}

impl Repo {
    pub fn discover(cwd: &Path) -> Result<Repo> {
        let git = find_git_on_path()?;
        let command = git_command(&git, cwd, Access::Read, &[REV_PARSE, "--show-toplevel"]);
        let output = without_final_newline(REV_PARSE, run(command, None, GIT_TIMEOUT)?)?;
        let root = path_from_git(&output);
        Ok(Repo { root, git })
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn unmerged(&self) -> Result<Vec<StageEntry>> {
        let command = self.command(Access::Read, &[LS_FILES, "-u", "-z"]);
        parse_unmerged(&run(command, None, GIT_TIMEOUT)?)
    }

    pub fn commit_named(&self, name: &str) -> Result<Option<Oid>> {
        let revision = format!("{name}^{{commit}}");
        let command = self.command(Access::Read, &[REV_PARSE, "--verify", "--quiet", &revision]);
        let output = match run(command, None, GIT_TIMEOUT) {
            Ok(output) => output,
            Err(error) if is_unresolved_name(&error) => return Ok(None),
            Err(error) => return Err(error),
        };
        let line = without_final_newline(REV_PARSE, output)?;
        let hex = String::from_utf8_lossy(&line);
        Ok(Some(Oid::parse(&hex)?))
    }

    /// The branch HEAD is on (`branch --show-current`); `None` when HEAD is detached.
    pub fn current_branch(&self) -> Result<Option<Vec<u8>>> {
        let command = self.command(Access::Read, &[BRANCH, "--show-current"]);
        let output = run(command, None, GIT_TIMEOUT)?;
        if output.is_empty() {
            return Ok(None);
        }
        Ok(Some(without_final_newline(BRANCH, output)?))
    }

    pub fn branches_at(&self, commit: &Oid) -> Result<Vec<Vec<u8>>> {
        let args = [
            "for-each-ref",
            NON_SYMBOLIC_SHORT_NAME,
            "--points-at",
            commit.as_str(),
            "refs/heads",
            "refs/remotes",
        ];
        let output = run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?;
        let names = output.split(|&byte| byte == b'\n');
        Ok(names
            .filter(|name| !name.is_empty())
            .map(<[u8]>::to_vec)
            .collect())
    }

    pub fn merge_message(&self) -> Result<Option<Vec<u8>>> {
        read_if_present(&self.git_path(MERGE_MSG)?)
    }

    /// A rebase is stopped here: `rebase-merge` or `rebase-apply` exists in the git directory.
    pub fn rebase_in_progress(&self) -> Result<bool> {
        for name in REBASE_STATE_DIRS {
            if exists(&self.git_path(name)?)? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// `git merge --abort`; git's own refusal comes back as `Error::GitFailed` with its stderr.
    pub fn abort_merge(&self) -> Result<()> {
        run(
            self.command(Access::Write, &["merge", "--abort"]),
            None,
            GIT_TIMEOUT,
        )?;
        Ok(())
    }

    fn git_path(&self, name: &str) -> Result<PathBuf> {
        let [path] = self.git_paths([name])?;
        Ok(path)
    }

    /// One `rev-parse --git-path` call for every name (git-rev-parse(1): the path inside the git directory,
    /// relative to the cwd); the paths in the order of `names`.
    pub(crate) fn git_paths<const N: usize>(&self, names: [&str; N]) -> Result<[PathBuf; N]> {
        let mut command = self.command(Access::Read, &[REV_PARSE]);
        for name in names {
            command.args(["--git-path", name]);
        }
        let output = without_final_newline(REV_PARSE, run(command, None, GIT_TIMEOUT)?)?;
        let paths: Vec<PathBuf> = output
            .split(|&byte| byte == b'\n')
            .map(|line| self.root.join(path_from_git(line)))
            .collect();
        paths.try_into().map_err(|paths| Error::UnexpectedOutput {
            command: REV_PARSE,
            output: format!("{paths:?}"),
        })
    }

    pub fn commit_summary(&self, commit: &Oid) -> Result<CommitSummary> {
        let args = [
            LOG,
            "-1",
            "--no-show-signature",
            SHORT_ID_SUBJECT_MESSAGE,
            commit.as_str(),
            "--",
        ];
        let output = run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?;
        let fields: Vec<&[u8]> = output
            .splitn(COMMIT_SUMMARY_FIELDS, |&byte| byte == b'\0')
            .collect();
        let [short_id, subject, message] = fields.as_slice() else {
            return Err(Error::UnexpectedOutput {
                command: LOG,
                output: String::from_utf8_lossy(&output).into_owned(),
            });
        };
        Ok(CommitSummary {
            short_id: short_id.to_vec(),
            subject: subject.to_vec(),
            message: message.to_vec(),
        })
    }

    pub fn index_records(&self, path: &Path) -> Result<Vec<u8>> {
        let mut command = self.command(Access::Read, &[LS_FILES, "-s", "-z", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)
    }

    // git-update-index(1) "USING --INDEX-INFO" reads the records `ls-files --stage` prints.
    pub fn restore_index_records(&self, path: &Path, records: Vec<u8>) -> Result<()> {
        if records.is_empty() {
            return self.remove_paths(&[path]);
        }
        let command = self.command(Access::Write, &["update-index", "-z", "--index-info"]);
        run(command, Some(records), GIT_TIMEOUT)?;
        Ok(())
    }

    pub fn blob_reader(&self) -> Result<BlobReader> {
        BlobReader::spawn(self.command(Access::Read, &[CAT_FILE, "--batch"]))
    }

    pub fn restore_stages(&self, entries: &[StageEntry]) -> Result<()> {
        let command = self.command(Access::Write, &["update-index", "-z", "--index-info"]);
        run(command, Some(index_info(entries)), GIT_TIMEOUT)?;
        Ok(())
    }

    pub fn checkout_merge(&self, path: &Path) -> Result<()> {
        let mut command = self.command(Access::Write, &["checkout", "-m", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    /// Stages each path as it is in the worktree: `git add -- <paths>`.
    pub fn add_paths(&self, paths: &[&Path]) -> Result<()> {
        let mut command = self.command(Access::Write, &["add", "--"]);
        command.args(paths);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    pub fn resolve_with(&self, chosen: &StageEntry) -> Result<()> {
        let (mode, oid) = (chosen.mode, chosen.oid.as_str());
        let mut record = format!("{mode:o} {oid} 0\t").into_bytes();
        record.extend_from_slice(chosen.path.as_os_str().as_encoded_bytes());
        record.push(b'\0');
        let command = self.command(Access::Write, &["update-index", "-z", "--index-info"]);
        run(command, Some(record), GIT_TIMEOUT)?;
        Ok(())
    }

    /// Removes every index entry of each path: `git update-index --force-remove -- <paths>`.
    pub fn remove_paths(&self, paths: &[&Path]) -> Result<()> {
        let mut command = self.command(Access::Write, &["update-index", "--force-remove", "--"]);
        command.args(paths);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    /// The blob id each worktree file would get when staged, through the path's filters; one per path.
    pub fn hash_objects(&self, paths: &[&Path]) -> Result<Vec<Oid>> {
        if paths.is_empty() {
            return Ok(Vec::new());
        }
        let mut input = Vec::new();
        for path in paths {
            input.extend_from_slice(path.as_os_str().as_encoded_bytes());
            input.push(b'\n');
        }
        let command = self.command(Access::Read, &[HASH_OBJECT, "--stdin-paths"]);
        let output = run(command, Some(input), GIT_TIMEOUT)?;
        let text = String::from_utf8_lossy(&output);
        let oids: Vec<Oid> = text.lines().map(Oid::parse).collect::<Result<_>>()?;
        if oids.len() != paths.len() {
            return Err(Error::UnexpectedOutput {
                command: HASH_OBJECT,
                output: text.into_owned(),
            });
        }
        Ok(oids)
    }

    /// The commit checked out in the submodule at `path`; `None` when it is not checked out.
    pub fn submodule_head(&self, path: &Path) -> Result<Option<Oid>> {
        let submodule = self.root.join(path);
        if fs::symlink_metadata(submodule.join(".git")).is_err() {
            return Ok(None);
        }
        let args = [REV_PARSE, "--verify", "--quiet", "HEAD"];
        let command = git_command(&self.git, &submodule, Access::Read, &args);
        let output = match run(command, None, GIT_TIMEOUT) {
            Ok(output) => output,
            Err(error) if is_unresolved_name(&error) => return Ok(None),
            Err(error) => return Err(error),
        };
        let line = without_final_newline(REV_PARSE, output)?;
        Ok(Some(Oid::parse(&String::from_utf8_lossy(&line))?))
    }

    pub fn checkout_from_index(&self, path: &Path) -> Result<()> {
        let mut command = self.command(Access::Write, &["checkout-index", "-u", "--force", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    pub(crate) fn command(&self, access: Access, args: &[&str]) -> Command {
        git_command(&self.git, &self.root, access, args)
    }
}

// git-rev-parse(1) `--verify --quiet`: a name that does not resolve exits non-zero without a message.
fn is_unresolved_name(error: &Error) -> bool {
    matches!(
        error,
        Error::GitFailed { status: Some(UNRESOLVED_NAME_STATUS), stderr, .. } if stderr.is_empty()
    )
}

pub(crate) fn exists(path: &Path) -> Result<bool> {
    path.try_exists().map_err(|source| Error::ReadFailed {
        path: path.to_path_buf(),
        source,
    })
}

pub(crate) fn read_if_present(path: &Path) -> Result<Option<Vec<u8>>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(source) if source.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(source) => Err(Error::ReadFailed {
            path: path.to_path_buf(),
            source,
        }),
    }
}

fn without_final_newline(command: &'static str, mut output: Vec<u8>) -> Result<Vec<u8>> {
    if output.pop() == Some(b'\n') {
        return Ok(output);
    }
    Err(Error::UnexpectedOutput {
        command,
        output: String::from_utf8_lossy(&output).into_owned(),
    })
}

fn find_git_on_path() -> Result<PathBuf> {
    let search_path = std::env::var_os("PATH").ok_or(Error::GitNotFound)?;
    git_in(&search_path).ok_or(Error::GitNotFound)
}

fn git_in(search_path: &OsStr) -> Option<PathBuf> {
    std::env::split_paths(search_path)
        .filter(|dir| dir.is_absolute())
        .map(|dir| dir.join(GIT_FILE_NAME))
        .find(|candidate| is_runnable(candidate))
}

#[cfg(unix)]
const GIT_FILE_NAME: &str = "git";

#[cfg(not(unix))]
const GIT_FILE_NAME: &str = "git.exe";

#[cfg(unix)]
fn is_runnable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    const ANY_EXECUTE_BIT: u32 = 0o111;
    path.metadata().is_ok_and(|metadata| {
        metadata.is_file() && metadata.permissions().mode() & ANY_EXECUTE_BIT != 0
    })
}

// Windows has no execute bit: the `.exe` name is what makes a file runnable.
#[cfg(not(unix))]
fn is_runnable(path: &Path) -> bool {
    path.is_file()
}

#[cfg(test)]
mod tests {
    use std::ffi::OsString;

    use super::*;

    fn search_path(dirs: &[&Path]) -> OsString {
        std::env::join_paths(dirs).unwrap()
    }

    #[cfg(unix)]
    fn runnable_git_in(dir: &Path) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let git = dir.join(GIT_FILE_NAME);
        fs::write(&git, "").unwrap();
        fs::set_permissions(&git, fs::Permissions::from_mode(0o755)).unwrap();
        git
    }

    #[cfg(not(unix))]
    fn runnable_git_in(dir: &Path) -> PathBuf {
        let git = dir.join(GIT_FILE_NAME);
        fs::write(&git, "").unwrap();
        git
    }

    #[test]
    fn a_relative_path_entry_is_skipped_and_the_same_folder_found_by_its_absolute_path() {
        let dir = tempfile::tempdir_in(".").unwrap();
        runnable_git_in(dir.path());
        let name = dir.path().file_name().unwrap();
        let (relative, absolute) = (Path::new(name), std::env::current_dir().unwrap().join(name));
        assert_eq!(git_in(&search_path(&[relative])), None);
        let found = git_in(&search_path(&[relative, &absolute]));
        assert_eq!(found, Some(absolute.join(GIT_FILE_NAME)));
    }

    #[cfg(unix)]
    #[test]
    fn a_git_without_an_execute_bit_is_skipped_and_the_next_executable_one_found() {
        use std::os::unix::fs::PermissionsExt;
        let (plain, runnable) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let not_executable = plain.path().join("git");
        fs::write(&not_executable, "").unwrap();
        fs::set_permissions(&not_executable, fs::Permissions::from_mode(0o644)).unwrap();
        let git = runnable_git_in(runnable.path());
        assert_eq!(
            git_in(&search_path(&[plain.path(), runnable.path()])),
            Some(git)
        );
    }

    #[cfg(not(unix))]
    #[test]
    fn a_git_without_the_exe_name_is_skipped_and_the_next_git_exe_found() {
        let (plain, runnable) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        fs::write(plain.path().join("git"), "").unwrap();
        let git = runnable_git_in(runnable.path());
        assert_eq!(
            git_in(&search_path(&[plain.path(), runnable.path()])),
            Some(git)
        );
    }
}

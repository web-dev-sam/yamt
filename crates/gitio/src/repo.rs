use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::blob::{BlobReader, CAT_FILE};
use crate::entry::{LS_FILES, Oid, index_info, parse_unmerged, path_from_git};
use crate::program::program_in;
use crate::run::{Access, GIT_TIMEOUT, git_command, git_command_as_user, run};
use crate::{Error, Result, StageEntry};

pub(crate) const REV_PARSE: &str = "rev-parse";
const HASH_OBJECT: &str = "hash-object";
const MERGE_BASE: &str = "merge-base";
const SILENT_FAILURE_STATUS: i32 = 1;
const GIT: &str = "git";

pub struct Repo {
    root: PathBuf,
    git: PathBuf,
    lookup: Lookup,
}

/// How git finds this repository: as yamt's environment says (an inherited `GIT_DIR` and its kin
/// included), or from its folder alone.
#[derive(Clone, Copy)]
enum Lookup {
    Environment,
    Folder,
}

impl Repo {
    /// The variables that name a repository other than the one a folder holds (git(1) "ENVIRONMENT
    /// VARIABLES"): every git run on a repository of its own leaves them out, and so does the agent.
    pub const REPOSITORY_VARIABLES: [&str; 6] = [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    ];

    pub fn discover(cwd: &Path) -> Result<Repo> {
        discovered(cwd, Lookup::Environment)
    }

    /// The repository git finds from `cwd` alone, never the one an inherited `GIT_DIR` names; every
    /// run on it leaves `REPOSITORY_VARIABLES` out.
    pub fn discover_from_folder(cwd: &Path) -> Result<Repo> {
        discovered(cwd, Lookup::Folder)
    }

    /// The repository of its own at `root`, run by the same git as this one; found from its folder alone.
    pub(crate) fn with_root(&self, root: PathBuf) -> Repo {
        Repo {
            root,
            git: self.git.clone(),
            lookup: Lookup::Folder,
        }
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
        let revision = commit_revision(name);
        let command = self.command(Access::Read, &[REV_PARSE, "--verify", "--quiet", &revision]);
        oid_unless_silent(command, REV_PARSE)
    }

    /// `git merge-base <a> <b>`: the first base when there are several (as `git diff a...b`); exit 1 → None
    pub fn merge_base(&self, a: &Oid, b: &Oid) -> Result<Option<Oid>> {
        let command = self.command(Access::Read, &[MERGE_BASE, a.as_str(), b.as_str()]);
        oid_unless_silent(command, MERGE_BASE)
    }

    /// `git merge-base --is-ancestor <ancestor> <of>`: exit 0 → true, exit 1 → false, anything else an `Err`.
    pub fn is_ancestor(&self, ancestor: &Oid, of: &Oid) -> Result<bool> {
        let args = [MERGE_BASE, "--is-ancestor", ancestor.as_str(), of.as_str()];
        match run(self.command(Access::Read, &args), None, GIT_TIMEOUT) {
            Ok(_) => Ok(true),
            Err(Error::GitFailed {
                status: Some(SILENT_FAILURE_STATUS),
                ..
            }) => Ok(false),
            Err(error) => Err(error),
        }
    }

    /// Whether any tracked file is staged, unstaged or unmerged; untracked files do not count:
    /// `git status --porcelain=v1 -z --untracked-files=no` lists anything.
    pub fn has_tracked_changes(&self) -> Result<bool> {
        let args = ["status", "--porcelain=v1", "-z", "--untracked-files=no"];
        let output = run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?;
        Ok(!output.is_empty())
    }

    /// `git rev-parse --path-format=absolute --git-common-dir`: one identity for every worktree of a repository
    pub fn common_dir(&self) -> Result<PathBuf> {
        let args = [REV_PARSE, "--path-format=absolute", "--git-common-dir"];
        let output = run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?;
        Ok(path_from_git(&without_final_newline(REV_PARSE, output)?))
    }

    /// The path of `name` inside this checkout's git directory: `git rev-parse --git-path <name>`.
    pub fn git_path(&self, name: &str) -> Result<PathBuf> {
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
        oid_unless_silent(command, REV_PARSE)
    }

    pub fn checkout_from_index(&self, path: &Path) -> Result<()> {
        let mut command = self.command(Access::Write, &["checkout-index", "-u", "--force", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    pub(crate) fn command(&self, access: Access, args: &[&str]) -> Command {
        self.lookup
            .applied(git_command(&self.git, &self.root, access, args))
    }

    /// A command as the user's terminal would run it (`git_command_as_user`): Abort and Continue only.
    pub(crate) fn command_as_user(&self, args: &[&str]) -> Command {
        self.lookup
            .applied(git_command_as_user(&self.git, &self.root, args))
    }
}

impl Lookup {
    fn applied(self, command: Command) -> Command {
        match self {
            Lookup::Environment => command,
            Lookup::Folder => without_repository_variables(command),
        }
    }
}

/// `command` with every one of `Repo::REPOSITORY_VARIABLES` left out of its environment.
pub(crate) fn without_repository_variables(mut command: Command) -> Command {
    for variable in Repo::REPOSITORY_VARIABLES {
        command.env_remove(variable);
    }
    command
}

fn discovered(cwd: &Path, lookup: Lookup) -> Result<Repo> {
    let git = find_git_on_path()?;
    let command = git_command(&git, cwd, Access::Read, &[REV_PARSE, "--show-toplevel"]);
    let output = run(lookup.applied(command), None, GIT_TIMEOUT)?;
    let root = path_from_git(&without_final_newline(REV_PARSE, output)?);
    Ok(Repo { root, git, lookup })
}

/// `<name>^{commit}`: the commit `name` resolves to, a tag peeled.
pub(crate) fn commit_revision(name: &str) -> String {
    format!("{name}^{{commit}}")
}

/// The one commit id a git read printed on its line.
pub(crate) fn oid_line(command: &'static str, output: Vec<u8>) -> Result<Oid> {
    let line = without_final_newline(command, output)?;
    Oid::parse(&String::from_utf8_lossy(&line))
}

// git-rev-parse(1) `--verify --quiet`: a name that does not resolve exits 1 without a message; git-merge-base(1)
// exits 1 without a message when the commits share no ancestor (builtin/merge-base.c `show_merge_base`).
fn oid_unless_silent(command: Command, name: &'static str) -> Result<Option<Oid>> {
    let output = match run(command, None, GIT_TIMEOUT) {
        Ok(output) => output,
        Err(Error::GitFailed {
            status: Some(SILENT_FAILURE_STATUS),
            stderr,
            ..
        }) if stderr.is_empty() => return Ok(None),
        Err(error) => return Err(error),
    };
    Ok(Some(oid_line(name, output)?))
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

pub(crate) fn without_final_newline(command: &'static str, mut output: Vec<u8>) -> Result<Vec<u8>> {
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
    program_in(&search_path, GIT).ok_or(Error::GitNotFound)
}

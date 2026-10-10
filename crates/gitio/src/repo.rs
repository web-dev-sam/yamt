use std::ffi::OsStr;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::blob::{BlobReader, CAT_FILE};
use crate::entry::{LS_FILES, index_info, parse_unmerged};
use crate::run::{Access, GIT_TIMEOUT, git_command, run};
use crate::{Error, Result, StageEntry};

const ANY_EXECUTE_BIT: u32 = 0o111;
const REV_PARSE: &str = "rev-parse";

pub struct Repo {
    root: PathBuf,
    git: PathBuf,
}

impl Repo {
    pub fn discover(cwd: &Path) -> Result<Repo> {
        let git = find_git_on_path()?;
        let command = git_command(&git, cwd, Access::Read, &[REV_PARSE, "--show-toplevel"]);
        let mut output = run(command, None, GIT_TIMEOUT)?;
        if output.pop() != Some(b'\n') {
            return Err(Error::UnexpectedOutput {
                command: REV_PARSE,
                output: String::from_utf8_lossy(&output).into_owned(),
            });
        }
        let root = PathBuf::from(OsStr::from_bytes(&output));
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

    pub fn add(&self, path: &Path) -> Result<()> {
        let mut command = self.command(Access::Write, &["add", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    pub fn resolve_with(&self, chosen: &StageEntry) -> Result<()> {
        let (mode, oid) = (chosen.mode, chosen.oid.as_str());
        let mut record = format!("{mode:o} {oid} 0\t").into_bytes();
        record.extend_from_slice(chosen.path.as_os_str().as_bytes());
        record.push(b'\0');
        let command = self.command(Access::Write, &["update-index", "-z", "--index-info"]);
        run(command, Some(record), GIT_TIMEOUT)?;
        Ok(())
    }

    pub fn remove_from_index(&self, path: &Path) -> Result<()> {
        let mut command = self.command(Access::Write, &["update-index", "--force-remove", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    pub fn checkout_from_index(&self, path: &Path) -> Result<()> {
        let mut command = self.command(Access::Write, &["checkout-index", "--force", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    fn command(&self, access: Access, args: &[&str]) -> Command {
        git_command(&self.git, &self.root, access, args)
    }
}

fn find_git_on_path() -> Result<PathBuf> {
    let search_path = std::env::var_os("PATH").ok_or(Error::GitNotFound)?;
    for dir in std::env::split_paths(&search_path) {
        if !dir.is_absolute() {
            continue;
        }
        let candidate = dir.join("git");
        let is_executable = candidate.metadata().is_ok_and(|metadata| {
            metadata.is_file() && metadata.permissions().mode() & ANY_EXECUTE_BIT != 0
        });
        if is_executable {
            return Ok(candidate);
        }
    }
    Err(Error::GitNotFound)
}

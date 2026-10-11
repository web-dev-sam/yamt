use std::ffi::OsStr;
use std::fs;
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::blob::{BlobReader, CAT_FILE};
use crate::entry::{LS_FILES, Oid, index_info, parse_unmerged};
use crate::run::{Access, GIT_TIMEOUT, git_command, run};
use crate::{Error, Result, StageEntry};

const ANY_EXECUTE_BIT: u32 = 0o111;
const REV_PARSE: &str = "rev-parse";
const LOG: &str = "log";
const MERGE_MSG: &str = "MERGE_MSG";
const UNRESOLVED_NAME_STATUS: i32 = 1;
const NON_SYMBOLIC_SHORT_NAME: &str = "--format=%(if)%(symref)%(then)%(else)%(refname:short)%(end)";
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
        let output = without_final_newline(run(command, None, GIT_TIMEOUT)?)?;
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

    pub fn commit_named(&self, name: &str) -> Result<Option<Oid>> {
        let revision = format!("{name}^{{commit}}");
        let command = self.command(Access::Read, &[REV_PARSE, "--verify", "--quiet", &revision]);
        let output = match run(command, None, GIT_TIMEOUT) {
            Ok(output) => output,
            Err(error) if is_unresolved_name(&error) => return Ok(None),
            Err(error) => return Err(error),
        };
        let line = without_final_newline(output)?;
        let hex = String::from_utf8_lossy(&line);
        Ok(Some(Oid::parse(&hex)?))
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
        let command = self.command(Access::Read, &[REV_PARSE, "--git-path", MERGE_MSG]);
        let git_path = without_final_newline(run(command, None, GIT_TIMEOUT)?)?;
        match fs::read(self.root.join(OsStr::from_bytes(&git_path))) {
            Ok(message) => Ok(Some(message)),
            Err(source) if source.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(source) => Err(source.into()),
        }
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
            return self.remove_from_index(path);
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
        let mut command = self.command(Access::Write, &["checkout-index", "-u", "--force", "--"]);
        command.arg(path);
        run(command, None, GIT_TIMEOUT)?;
        Ok(())
    }

    fn command(&self, access: Access, args: &[&str]) -> Command {
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

fn without_final_newline(mut output: Vec<u8>) -> Result<Vec<u8>> {
    if output.pop() == Some(b'\n') {
        return Ok(output);
    }
    Err(Error::UnexpectedOutput {
        command: REV_PARSE,
        output: String::from_utf8_lossy(&output).into_owned(),
    })
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

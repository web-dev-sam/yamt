use crate::entry::Oid;
use crate::repo::{Repo, read_if_present, without_final_newline};
use crate::run::{Access, GIT_TIMEOUT, run};
use crate::{Error, Result};

const BRANCH: &str = "branch";
const LOG: &str = "log";
const REV_PARSE: &str = "rev-parse";
const MERGE_MSG: &str = "MERGE_MSG";
const NON_SYMBOLIC_SHORT_NAME: &str =
    "--format=%(if)%(symref)%(then)%(else)%(refname:lstrip=2)%(end)";
const SHORT_ID_SUBJECT_MESSAGE: &str = "--format=%h%x00%s%x00%B";
const COMMIT_SUMMARY_FIELDS: usize = 3;

/// A commit as `git log` prints it: `%h`, `%s` and `%B`, bytes as git wrote them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitSummary {
    pub short_id: Vec<u8>,
    pub subject: Vec<u8>,
    pub message: Vec<u8>,
}

impl Repo {
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
        Ok(non_empty_lines(&output))
    }

    /// The ref `name` stands for (`refs/heads/x`, `refs/remotes/origin/x`, `HEAD` when detached…); `None` for a
    /// commit id or an expression such as `HEAD~2`. `--verify` refuses a range or an option: `GitFailed`.
    pub fn symbolic_full_name(&self, name: &str) -> Result<Option<Vec<u8>>> {
        let args = [REV_PARSE, "--verify", "--symbolic-full-name", name];
        let output = run(self.command(Access::Read, &args), None, GIT_TIMEOUT)?;
        if output.is_empty() {
            return Ok(None);
        }
        Ok(Some(without_final_newline(REV_PARSE, output)?))
    }

    pub fn remote_names(&self) -> Result<Vec<Vec<u8>>> {
        let output = run(self.command(Access::Read, &["remote"]), None, GIT_TIMEOUT)?;
        Ok(non_empty_lines(&output))
    }

    pub fn merge_message(&self) -> Result<Option<Vec<u8>>> {
        read_if_present(&self.git_path(MERGE_MSG)?)
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
}

fn non_empty_lines(output: &[u8]) -> Vec<Vec<u8>> {
    let lines = output.split(|&byte| byte == b'\n');
    lines
        .filter(|line| !line.is_empty())
        .map(<[u8]>::to_vec)
        .collect()
}

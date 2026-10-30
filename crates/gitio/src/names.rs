use std::process::ExitStatus;

use crate::entry::Oid;
use crate::repo::{REV_PARSE, Repo, read_if_present, without_final_newline};
use crate::run::{Access, GIT_TIMEOUT, run, run_accepting};
use crate::{Error, Result};

const BRANCH: &str = "branch";
const LOG: &str = "log";
const MERGE_MSG: &str = "MERGE_MSG";
const NON_SYMBOLIC_SHORT_NAME: &str =
    "--format=%(if)%(symref)%(then)%(else)%(refname:lstrip=2)%(end)";
const SHORT_ID_SUBJECT_MESSAGE: &str = "--format=%h%x00%s%x00%B";
const COMMIT_SUMMARY_FIELDS: usize = 3;
const REMOTE_URL_KEYS: &str = r"^remote\..*\.url$";
const REMOTE_KEY_PREFIX: &[u8] = b"remote.";
const URL_KEY_SUFFIX: &[u8] = b".url";
// git-config(1): `--get-regexp` exits with 1 when no key matches.
const NO_MATCH_STATUS: i32 = 1;

/// A commit as `git log` prints it: `%h`, `%s` and `%B`, bytes as git wrote them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitSummary {
    pub short_id: Vec<u8>,
    pub subject: Vec<u8>,
    pub message: Vec<u8>,
}

/// One `remote.<name>.url` entry, bytes as git stores them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteUrl {
    pub name: Vec<u8>,
    pub url: Vec<u8>,
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

    /// Every remote's URL in config order (`config -z --get-regexp`); empty when there is none.
    pub fn remote_urls(&self) -> Result<Vec<RemoteUrl>> {
        let args = ["config", "-z", "--get-regexp", REMOTE_URL_KEYS];
        let command = self.command(Access::Read, &args);
        let output = run_accepting(command, None, GIT_TIMEOUT, is_found_or_no_match)?;
        Ok(parse_remote_urls(&output))
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

fn is_found_or_no_match(status: ExitStatus) -> bool {
    status.success() || status.code() == Some(NO_MATCH_STATUS)
}

// git-config(1) `-z`: each entry is `<key> NL <value> NUL`; the `<name>` subsection is kept as written.
fn parse_remote_urls(output: &[u8]) -> Vec<RemoteUrl> {
    let mut urls = Vec::new();
    for entry in output.split(|&byte| byte == b'\0') {
        let mut parts = entry.splitn(2, |&byte| byte == b'\n');
        let (Some(key), Some(url)) = (parts.next(), parts.next()) else {
            continue;
        };
        let name = key
            .strip_prefix(REMOTE_KEY_PREFIX)
            .and_then(|rest| rest.strip_suffix(URL_KEY_SUFFIX));
        if let Some(name) = name {
            urls.push(RemoteUrl {
                name: name.to_vec(),
                url: url.to_vec(),
            });
        }
    }
    urls
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_urls_keep_config_order_and_dotted_names_and_skip_valueless_keys() {
        let output =
            b"remote.origin.url\nhttps://gitlab.example/a.git\0remote.my.fork.url\ngit@host:b\0\
remote.empty.url\0remote.origin.url\nsecond\0";

        let urls = parse_remote_urls(output);

        let url = |name: &[u8], url: &[u8]| RemoteUrl {
            name: name.to_vec(),
            url: url.to_vec(),
        };
        let expected = [
            url(b"origin", b"https://gitlab.example/a.git"),
            url(b"my.fork", b"git@host:b"),
            url(b"origin", b"second"),
        ];
        assert_eq!(urls, expected);
        assert_eq!(parse_remote_urls(b""), []);
    }
}

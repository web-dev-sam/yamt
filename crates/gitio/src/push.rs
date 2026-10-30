use std::time::Duration;

use crate::fetch::refuse_prompts;
use crate::repo::Repo;
use crate::run::{Access, Waited, argv, run_with_deadline};

/// A push's deadline: it talks to a server over the network, and may never get an answer.
pub const PUSH_TIMEOUT: Duration = Duration::from_secs(120);
const PUSH: [&str; 5] = [
    "push",
    "--porcelain",
    "--no-follow-tags",
    "--recurse-submodules=no",
    "--end-of-options",
];
const REJECTED_FLAG: &str = "!";

impl Repo {
    /// `git push` of `branch` to the branch of the same name on `remote`, never forced (no `+`, no `--force`), and
    /// never waiting on a prompt; killed at `timeout` (`PUSH_TIMEOUT`). `Err` holds the ref's summary and reason
    /// when the remote rejected it ("[rejected] (fetch first)"), else git's first `fatal:` or `error:` line, else
    /// git's exit in words.
    pub fn push_branch(&self, remote: &str, branch: &str, timeout: Duration) -> Result<(), String> {
        let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
        let mut command = self.command(Access::Write, &PUSH);
        command.arg(remote).arg(&refspec);
        refuse_prompts(&mut command);
        tracing::debug!(args = ?argv(&command), "running git");
        let finished = match run_with_deadline(command, None, timeout) {
            Err(error) => return Err(format!("cannot run git push: {error}")),
            Ok(Waited::TimedOut) => {
                return Err(format!(
                    "git push got no answer within {} s",
                    timeout.as_secs()
                ));
            }
            Ok(Waited::Exited(finished)) => finished,
        };
        if let Some(summary) = rejection(&finished.stdout, &refspec) {
            return Err(summary);
        }
        if finished.status.success() {
            return Ok(());
        }
        Err(failure_line(&finished.stderr)
            .unwrap_or_else(|| format!("git push failed: {}", finished.status)))
    }
}

/// The summary and reason of `refspec`'s line when its flag says the push of it was rejected. git-push(1)
/// "OUTPUT": with `--porcelain`, each ref is a line `<flag> TAB <from>:<to> TAB <summary> (<reason>)`, flag `!`
/// for a rejected ref.
fn rejection(porcelain: &[u8], refspec: &str) -> Option<String> {
    let text = String::from_utf8_lossy(porcelain);
    for line in text.lines() {
        let fields: Vec<&str> = line.split('\t').collect();
        if let [flag, ref_pair, summary] = fields.as_slice()
            && *ref_pair == refspec
        {
            return (*flag == REJECTED_FLAG).then(|| (*summary).to_owned());
        }
    }
    None
}

/// git's first stderr line that states a failure: the cause, before hints and advice.
fn failure_line(stderr: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(stderr);
    let line = text
        .lines()
        .find(|line| line.starts_with("fatal:") || line.starts_with("error:"));
    line.map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    const REFSPEC: &str = "refs/heads/feature:refs/heads/feature";

    #[test]
    fn a_rejected_ref_gives_its_summary_and_reason() {
        let porcelain = b"To /srv/remote.git\n\
            !\trefs/heads/feature:refs/heads/feature\t[rejected] (fetch first)\nDone\n";

        assert_eq!(
            rejection(porcelain, REFSPEC),
            Some("[rejected] (fetch first)".to_owned())
        );
    }

    #[test]
    fn a_pushed_or_up_to_date_ref_is_no_rejection() {
        let pushed = b"To /srv/remote.git\n \trefs/heads/feature:refs/heads/feature\t1111111..2222222\nDone\n";
        let up_to_date =
            b"To /srv/remote.git\n=\trefs/heads/feature:refs/heads/feature\t[up to date]\nDone\n";

        assert_eq!(rejection(pushed, REFSPEC), None);
        assert_eq!(rejection(up_to_date, REFSPEC), None);
    }

    #[test]
    fn another_ref_s_rejection_is_not_this_ref_s() {
        let porcelain =
            b"To /srv/remote.git\n!\trefs/heads/other:refs/heads/other\t[rejected] (fetch first)\nDone\n";

        assert_eq!(rejection(porcelain, REFSPEC), None);
    }

    #[test]
    fn the_failure_line_is_the_first_fatal_or_error_line() {
        let fatal = b"hint: something\nfatal: 'gone' does not appear to be a git repository\nfatal: second\n";
        let error = b"To /srv/remote.git\nerror: failed to push some refs to '/srv/remote.git'\n";

        assert_eq!(
            failure_line(fatal),
            Some("fatal: 'gone' does not appear to be a git repository".to_owned())
        );
        assert_eq!(
            failure_line(error),
            Some("error: failed to push some refs to '/srv/remote.git'".to_owned())
        );
        assert_eq!(failure_line(b"hint: only advice\n"), None);
    }
}

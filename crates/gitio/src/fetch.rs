use std::process::Command;
use std::time::Duration;

use crate::Repo;
use crate::glab::first_line;
use crate::run::{Access, Waited, argv, run_with_deadline};

/// A fetch's deadline: it talks to a server over the network, and may never get an answer.
pub const FETCH_TIMEOUT: Duration = Duration::from_secs(120);
const FETCH: [&str; 8] = [
    "fetch",
    "--no-tags",
    "--no-write-fetch-head",
    "--no-recurse-submodules",
    "--no-auto-maintenance",
    "--refmap=",
    "--quiet",
    "--end-of-options",
];

impl Repo {
    /// `git fetch` of `refspecs` from `remote`, which brings their commits and writes no ref, no `FETCH_HEAD`
    /// (git-fetch(1): refspecs without a destination and an empty `--refmap=`), and never waits on a prompt; killed
    /// at `timeout` (`FETCH_TIMEOUT`). `Err` holds git's first stderr line: the cause, before advice such as "Please
    /// make sure you have the correct access rights".
    pub fn fetch_without_refs(
        &self,
        remote: &str,
        refspecs: &[&str],
        timeout: Duration,
    ) -> Result<(), String> {
        self.fetch(remote, refspecs, timeout)
    }

    /// `git fetch` of each of `branches` from `remote` into its remote-tracking branch
    /// (`+refs/heads/<b>:refs/remotes/<remote>/<b>`), which writes those refs only: no `FETCH_HEAD`, and the empty
    /// `--refmap=` keeps the configured refspec from updating others. As `fetch_without_refs`: no prompt, killed at
    /// `timeout`, `Err` git's first stderr line. The caller checks that no branch name holds ':'.
    pub fn fetch_branches(
        &self,
        remote: &str,
        branches: &[&str],
        timeout: Duration,
    ) -> Result<(), String> {
        let refspecs: Vec<String> = branches
            .iter()
            .map(|branch| format!("+refs/heads/{branch}:refs/remotes/{remote}/{branch}"))
            .collect();
        let refspecs: Vec<&str> = refspecs.iter().map(String::as_str).collect();
        self.fetch(remote, &refspecs, timeout)
    }

    fn fetch(&self, remote: &str, refspecs: &[&str], timeout: Duration) -> Result<(), String> {
        let mut command = self.command(Access::Write, &FETCH);
        command.arg(remote).args(refspecs);
        refuse_prompts(&mut command);
        tracing::debug!(args = ?argv(&command), "running git");
        match run_with_deadline(command, None, timeout) {
            Err(error) => Err(format!("cannot run git fetch: {error}")),
            Ok(Waited::TimedOut) => Err(format!(
                "git fetch got no answer within {} s",
                timeout.as_secs()
            )),
            Ok(Waited::Exited(finished)) if finished.status.success() => Ok(()),
            Ok(Waited::Exited(finished)) => Err(first_line(&finished.stderr)
                .unwrap_or_else(|| format!("git fetch failed: {}", finished.status))),
        }
    }
}

/// Sets `command`'s environment so that no prompt of git, ssh or a credential manager waits for an answer: a
/// question that needs one fails the run instead.
pub(crate) fn refuse_prompts(command: &mut Command) {
    command
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never");
    // OpenSSH 8.4+ asks SSH_ASKPASS instead of the terminal when SSH_ASKPASS_REQUIRE=force (ssh(1)
    // "ENVIRONMENT"); `false` refuses at once, so a passphrase or host-key question fails the run.
    #[cfg(unix)]
    command
        .env("SSH_ASKPASS_REQUIRE", "force")
        .env("SSH_ASKPASS", "false");
}

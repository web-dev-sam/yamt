use std::time::Duration;

use crate::Repo;
use crate::glab::first_line;
use crate::run::{Access, Waited, argv, run_with_deadline};

/// A fetch's deadline: it talks to a server over the network, and may never get an answer.
pub const FETCH_TIMEOUT: Duration = Duration::from_secs(120);
const FETCH_WITHOUT_REFS: [&str; 8] = [
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
        let mut command = self.command(Access::Write, &FETCH_WITHOUT_REFS);
        command.arg(remote).args(refspecs);
        command
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GCM_INTERACTIVE", "never");
        // OpenSSH 8.4+ asks SSH_ASKPASS instead of the terminal when SSH_ASKPASS_REQUIRE=force (ssh(1)
        // "ENVIRONMENT"); `false` refuses at once, so a passphrase or host-key question fails the fetch.
        #[cfg(unix)]
        command
            .env("SSH_ASKPASS_REQUIRE", "force")
            .env("SSH_ASKPASS", "false");
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

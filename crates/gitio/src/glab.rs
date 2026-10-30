use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use crate::program::program_in;
use crate::run::{Waited, argv, run_with_deadline};
use crate::{Error, Result};

/// One glab call's deadline: glab talks to a GitLab server over the network (plan §2 #118).
pub const GLAB_TIMEOUT: Duration = Duration::from_secs(20);
/// What a glab call that ran past its deadline came to.
pub const TIMED_OUT: &str = "glab timed out";
const GLAB: &str = "glab";

/// The glab program yamt runs, and how long each of its calls may take.
pub struct Glab {
    program: PathBuf,
    timeout: Duration,
}

/// How one glab call ended, with the bytes glab printed.
#[derive(Debug, PartialEq, Eq)]
pub enum GlabRun {
    Printed {
        stdout: Vec<u8>,
    },
    Failed {
        status: Option<i32>,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
    },
    TimedOut,
}

/// What `glab auth status` says about the instance of the folder it runs in.
#[derive(Debug, PartialEq, Eq)]
pub enum AuthStatus {
    LoggedIn,
    /// glab's first output line, which names the instance.
    LoggedOut {
        detail: String,
    },
    /// glab could not run or timed out.
    Failed {
        message: String,
    },
}

impl Glab {
    /// The first runnable `glab` on PATH; `None` when it is not installed.
    #[must_use]
    pub fn find() -> Option<Glab> {
        let search_path = std::env::var_os("PATH")?;
        program_in(&search_path, GLAB).map(Glab::at)
    }

    #[must_use]
    pub fn at(program: PathBuf) -> Glab {
        Glab {
            program,
            timeout: GLAB_TIMEOUT,
        }
    }

    #[must_use]
    pub fn with_timeout(self, timeout: Duration) -> Glab {
        Glab { timeout, ..self }
    }

    /// `glab <args>` in `cwd` with the user's environment plus `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0`; stdin is
    /// closed, or `stdin` written and closed.
    pub fn run(&self, cwd: &Path, args: &[&str], stdin: Option<Vec<u8>>) -> Result<GlabRun> {
        let mut command = Command::new(&self.program);
        command
            .current_dir(cwd)
            .args(args)
            .env("NO_COLOR", "1")
            .env("GIT_TERMINAL_PROMPT", "0");
        tracing::debug!(args = ?argv(&command), "running glab");
        let waited =
            run_with_deadline(command, stdin, self.timeout).map_err(|source| Error::GlabIo {
                program: self.program.clone(),
                source,
            })?;
        let finished = match waited {
            Waited::Exited(finished) => finished,
            Waited::TimedOut => return Ok(GlabRun::TimedOut),
        };
        if finished.status.success() {
            return Ok(GlabRun::Printed {
                stdout: finished.stdout,
            });
        }
        Ok(GlabRun::Failed {
            status: finished.status.code(),
            stdout: finished.stdout,
            stderr: finished.stderr,
        })
    }

    /// What `glab <args>` printed with stdin closed; `Err` holds what went wrong, glab's own line when it printed one.
    pub fn get(&self, cwd: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
        match self
            .run(cwd, args, None)
            .map_err(|error| error.to_string())?
        {
            GlabRun::Printed { stdout } => Ok(stdout),
            GlabRun::Failed { status, stderr, .. } => {
                Err(last_line(&stderr).unwrap_or_else(|| exit_words(status)))
            }
            GlabRun::TimedOut => Err(TIMED_OUT.to_owned()),
        }
    }

    #[must_use]
    pub fn auth_status(&self, cwd: &Path) -> AuthStatus {
        match self.run(cwd, &["auth", "status"], None) {
            Err(error) => AuthStatus::Failed {
                message: error.to_string(),
            },
            Ok(GlabRun::Printed { .. }) => AuthStatus::LoggedIn,
            Ok(GlabRun::Failed { stdout, stderr, .. }) => {
                let detail = first_line(&stderr).or_else(|| first_line(&stdout));
                AuthStatus::LoggedOut {
                    detail: detail.unwrap_or_default(),
                }
            }
            Ok(GlabRun::TimedOut) => AuthStatus::Failed {
                message: TIMED_OUT.to_owned(),
            },
        }
    }
}

fn exit_words(status: Option<i32>) -> String {
    match status {
        Some(code) => format!("glab exited with status {code}"),
        None => "glab was stopped by a signal".to_owned(),
    }
}

/// The first line of `output` that is not blank, trimmed.
#[must_use]
pub fn first_line(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let line = text.lines().map(str::trim).find(|line| !line.is_empty());
    line.map(str::to_owned)
}

/// glab prints its error last, after any notice such as a first run's "What's new".
#[must_use]
pub fn last_line(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let line = text.lines().map(str::trim).rfind(|line| !line.is_empty());
    line.map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_and_last_lines_skip_blank_lines_and_trim() {
        let printed = b"\n  What's new  \n\nglab: no route\n \n";
        assert_eq!(first_line(printed).as_deref(), Some("What's new"));
        assert_eq!(last_line(printed).as_deref(), Some("glab: no route"));
        assert_eq!(first_line(b" \n\n"), None);
        assert_eq!(last_line(b""), None);
    }

    #[test]
    fn an_exit_without_a_line_is_named_by_its_status_or_signal() {
        assert_eq!(exit_words(Some(2)), "glab exited with status 2");
        assert_eq!(exit_words(None), "glab was stopped by a signal");
    }
}

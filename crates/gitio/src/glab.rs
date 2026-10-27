use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use crate::program::program_in;
use crate::run::{Waited, argv, run_with_deadline};
use crate::{Error, Result};

/// One glab call's deadline: glab talks to a GitLab server over the network (plan §2 #118).
pub const GLAB_TIMEOUT: Duration = Duration::from_secs(20);
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
}

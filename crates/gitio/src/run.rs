use std::io::{self, Read, Write};
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use crate::{Error, Result};

pub(crate) const GIT_TIMEOUT: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_millis(5);

/// Whether a git call may write to the repository; read-only calls skip optional locks.
#[derive(Clone, Copy)]
pub(crate) enum Access {
    Read,
    Write,
}

pub(crate) fn git_command(git: &Path, cwd: &Path, access: Access, args: &[&str]) -> Command {
    let mut command = Command::new(git);
    command
        .current_dir(cwd)
        .env("LC_ALL", "C")
        .args(["-c", "core.quotepath=false"])
        .args(args);
    match access {
        Access::Read => {
            command.env("GIT_OPTIONAL_LOCKS", "0");
        }
        Access::Write => {}
    }
    command
}

pub(crate) fn argv(command: &Command) -> Vec<String> {
    let program = command.get_program().to_string_lossy().into_owned();
    let args = command
        .get_args()
        .map(|arg| arg.to_string_lossy().into_owned());
    std::iter::once(program).chain(args).collect()
}

/// Runs a one-shot git call to completion and returns its stdout.
pub(crate) fn run(command: Command, stdin: Option<Vec<u8>>, timeout: Duration) -> Result<Vec<u8>> {
    let args = argv(&command);
    tracing::debug!(?args, "running git");
    let mut child = spawn_piped(command, stdin.is_some())?;
    let writer = child
        .stdin
        .take()
        .zip(stdin)
        .map(|(mut pipe, bytes)| thread::spawn(move || pipe.write_all(&bytes)));
    let stdout = child.stdout.take().map(read_on_thread);
    let stderr = child.stderr.take().map(read_on_thread);
    let Some(status) = wait_or_kill(&mut child, timeout)? else {
        return Err(Error::Timeout {
            args,
            after: timeout,
        });
    };
    let stdout = join_reader(stdout)?;
    let stderr = join_reader(stderr)?;
    if !status.success() {
        return Err(Error::GitFailed {
            args,
            status: status.code(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
        });
    }
    if let Some(writer) = writer {
        let written = writer.join().map_err(|_| thread_panicked())?;
        written?;
    }
    Ok(stdout)
}

fn spawn_piped(mut command: Command, with_stdin: bool) -> io::Result<Child> {
    let stdin = if with_stdin {
        Stdio::piped()
    } else {
        Stdio::null()
    };
    command
        .stdin(stdin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}

fn read_on_thread(mut pipe: impl Read + Send + 'static) -> JoinHandle<io::Result<Vec<u8>>> {
    thread::spawn(move || {
        let mut bytes = Vec::new();
        pipe.read_to_end(&mut bytes).map(|_| bytes)
    })
}

fn join_reader(reader: Option<JoinHandle<io::Result<Vec<u8>>>>) -> io::Result<Vec<u8>> {
    match reader {
        Some(handle) => handle.join().map_err(|_| thread_panicked())?,
        None => Ok(Vec::new()),
    }
}

fn thread_panicked() -> io::Error {
    io::Error::other("git pipe thread panicked")
}

/// Returns `None` when the deadline passed; the child is then killed and reaped.
fn wait_or_kill(child: &mut Child, timeout: Duration) -> io::Result<Option<ExitStatus>> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(Some(status));
        }
        if Instant::now() >= deadline {
            child.kill()?;
            child.wait()?;
            return Ok(None);
        }
        thread::sleep(POLL_INTERVAL);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHORT_TIMEOUT: Duration = Duration::from_millis(300);
    const SLEEP_SECONDS: u64 = 5;

    fn child_pids_of_this_process() -> String {
        let mut pids = String::new();
        for task in std::fs::read_dir("/proc/self/task").unwrap() {
            let children = task.unwrap().path().join("children");
            pids.push_str(&std::fs::read_to_string(children).unwrap());
        }
        pids
    }

    #[test]
    fn hanging_git_call_times_out_and_child_is_reaped() {
        let git = Path::new("git");
        let alias = format!("alias.hang=!sleep {SLEEP_SECONDS}");
        let command = git_command(git, Path::new("/"), Access::Read, &["-c", &alias, "hang"]);
        let started = Instant::now();

        let error = run(command, None, SHORT_TIMEOUT).unwrap_err();

        assert!(started.elapsed() < Duration::from_secs(SLEEP_SECONDS));
        let Error::Timeout { args, after } = error else {
            panic!("expected Timeout, got {error:?}");
        };
        assert_eq!(after, SHORT_TIMEOUT);
        assert!(args.contains(&"hang".to_owned()));
        assert_eq!(child_pids_of_this_process().trim(), "");
    }
}

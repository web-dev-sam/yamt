use std::io::{self, Read, Write};
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use crate::{Error, Result};

pub(crate) const GIT_TIMEOUT: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_millis(5);

#[derive(Clone, Copy)]
pub(crate) enum Access {
    Read,
    Write,
}

enum Waited {
    Exited {
        status: ExitStatus,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
    },
    TimedOut,
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

/// A git command as a terminal would run it: the user's locale (hooks print in their language), no lock
/// option; only `core.quotepath=false`, so paths in its output read as the user wrote them.
pub(crate) fn git_command_as_user(git: &Path, cwd: &Path, args: &[&str]) -> Command {
    let mut command = Command::new(git);
    command
        .current_dir(cwd)
        .args(["-c", "core.quotepath=false"])
        .args(args);
    command
}

pub(crate) fn argv(command: &Command) -> Vec<String> {
    let program = command.get_program().to_string_lossy().into_owned();
    let args = command
        .get_args()
        .map(|arg| arg.to_string_lossy().into_owned());
    std::iter::once(program).chain(args).collect()
}

/// Runs `command` until it exits, however long that takes, with stdin closed; stdout then stderr.
pub(crate) fn run_to_end(mut command: Command) -> Result<(ExitStatus, Vec<u8>)> {
    let args = argv(&command);
    tracing::debug!(?args, "running git without a deadline");
    let finished = command.stdin(Stdio::null()).output()?;
    let mut output = finished.stdout;
    output.extend_from_slice(&finished.stderr);
    Ok((finished.status, output))
}

pub(crate) fn run(command: Command, stdin: Option<Vec<u8>>, timeout: Duration) -> Result<Vec<u8>> {
    run_accepting(command, stdin, timeout, |status| status.success())
}

pub(crate) fn run_accepting(
    command: Command,
    stdin: Option<Vec<u8>>,
    timeout: Duration,
    accepts: fn(ExitStatus) -> bool,
) -> Result<Vec<u8>> {
    let args = argv(&command);
    tracing::debug!(?args, "running git");
    let deadline = Instant::now() + timeout;
    let mut child = spawn_piped(command, stdin.is_some())?;
    let writer = if let (Some(mut pipe), Some(bytes)) = (child.stdin.take(), stdin) {
        Some(thread::spawn(move || pipe.write_all(&bytes)))
    } else {
        None
    };
    let (status, stdout, stderr) = match wait_with_deadline(&mut child, deadline)? {
        Waited::Exited {
            status,
            stdout,
            stderr,
        } => (status, stdout, stderr),
        Waited::TimedOut => {
            return Err(Error::Timeout {
                args,
                after: timeout,
            });
        }
    };
    if !accepts(status) {
        return Err(Error::GitFailed {
            args,
            status: status.code(),
            stderr: String::from_utf8_lossy(&stderr).trim_end().to_owned(),
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

fn wait_with_deadline(child: &mut Child, deadline: Instant) -> io::Result<Waited> {
    let stdout = read_on_thread(child.stdout.take().ok_or_else(closed_pipe)?);
    let stderr = read_on_thread(child.stderr.take().ok_or_else(closed_pipe)?);
    loop {
        if let Some(status) = child.try_wait()? {
            return receive_output(status, &stdout, &stderr, deadline);
        }
        if Instant::now() >= deadline {
            child.kill()?;
            child.wait()?;
            return Ok(Waited::TimedOut);
        }
        thread::sleep(POLL_INTERVAL);
    }
}

fn read_on_thread(mut pipe: impl Read + Send + 'static) -> Receiver<io::Result<Vec<u8>>> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let read = pipe.read_to_end(&mut bytes).map(|_| bytes);
        if sender.send(read).is_err() {
            tracing::debug!("git output arrived after the deadline");
        }
    });
    receiver
}

fn receive_output(
    status: ExitStatus,
    stdout: &Receiver<io::Result<Vec<u8>>>,
    stderr: &Receiver<io::Result<Vec<u8>>>,
    deadline: Instant,
) -> io::Result<Waited> {
    let stdout = match stdout.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
        Ok(read) => read?,
        Err(RecvTimeoutError::Timeout) => return Ok(Waited::TimedOut),
        Err(RecvTimeoutError::Disconnected) => return Err(thread_panicked()),
    };
    let stderr = match stderr.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
        Ok(read) => read?,
        Err(RecvTimeoutError::Timeout) => return Ok(Waited::TimedOut),
        Err(RecvTimeoutError::Disconnected) => return Err(thread_panicked()),
    };
    Ok(Waited::Exited {
        status,
        stdout,
        stderr,
    })
}

fn closed_pipe() -> io::Error {
    io::Error::from(io::ErrorKind::BrokenPipe)
}

fn thread_panicked() -> io::Error {
    io::Error::other("git pipe thread panicked")
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHORT_TIMEOUT: Duration = Duration::from_millis(300);
    const SLEEP_SECONDS: u64 = 5;

    #[cfg(target_os = "linux")]
    fn child_pids_of_this_process() -> String {
        let mut pids = String::new();
        for task in std::fs::read_dir("/proc/self/task").unwrap() {
            let children = task.unwrap().path().join("children");
            pids.push_str(&std::fs::read_to_string(children).unwrap());
        }
        pids
    }

    fn run_alias_with_short_timeout(alias_body: &str) -> (Error, Duration) {
        let alias = format!("alias.hang=!{alias_body}");
        let command = git_command(
            Path::new("git"),
            Path::new("/"),
            Access::Read,
            &["-c", &alias, "hang"],
        );
        let started = Instant::now();
        let error = run(command, None, SHORT_TIMEOUT).unwrap_err();
        (error, started.elapsed())
    }

    fn assert_is_short_timeout(error: Error, elapsed: Duration) {
        assert!(elapsed < Duration::from_secs(SLEEP_SECONDS), "{elapsed:?}");
        let Error::Timeout { args, after } = error else {
            panic!("expected Timeout, got {error:?}");
        };
        assert_eq!(after, SHORT_TIMEOUT);
        assert!(args.contains(&"hang".to_owned()));
    }

    #[test]
    fn hanging_git_call_times_out_and_child_is_reaped() {
        let (error, elapsed) = run_alias_with_short_timeout(&format!("sleep {SLEEP_SECONDS}"));

        assert_is_short_timeout(error, elapsed);
        #[cfg(target_os = "linux")]
        assert_eq!(child_pids_of_this_process().trim(), "");
    }

    #[test]
    fn background_process_holding_stderr_open_times_out() {
        let alias_body = format!("sleep {SLEEP_SECONDS} >/dev/null &");

        let (error, elapsed) = run_alias_with_short_timeout(&alias_body);

        assert_is_short_timeout(error, elapsed);
    }

    fn run_alias_to_end(alias_body: &str) -> (ExitStatus, Vec<u8>) {
        let alias = format!("alias.say=!{alias_body}");
        let command = git_command_as_user(Path::new("git"), Path::new("/"), &["-c", &alias, "say"]);
        run_to_end(command).unwrap()
    }

    #[test]
    fn a_run_to_the_end_gives_stdout_then_stderr_and_git_s_exit_status() {
        let (status, output) = run_alias_to_end("echo err >&2; echo out; exit 3");

        assert_eq!(status.code(), Some(3));
        assert_eq!(output, b"out\nerr\n");
    }

    // A hook or editor reading stdin would wait forever on an open pipe.
    #[test]
    fn a_run_to_the_end_closes_stdin() {
        let (status, output) = run_alias_to_end("cat; echo read");

        assert!(status.success());
        assert_eq!(output, b"read\n");
    }

    #[test]
    fn a_command_as_the_user_runs_it_keeps_the_user_s_locale_and_locks() {
        let command = git_command_as_user(Path::new("git"), Path::new("/"), &["status"]);

        assert_eq!(command.get_envs().count(), 0);
        assert_eq!(
            argv(&command),
            ["git", "-c", "core.quotepath=false", "status"]
        );
    }
}

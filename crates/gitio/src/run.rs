use std::io::{self, Read, Write};
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use crate::{Error, Result};

pub(crate) const GIT_TIMEOUT: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_millis(5);
const READER_GRACE: Duration = Duration::from_secs(1);
const READ_CHUNK_BYTES: usize = 8192;

#[derive(Clone, Copy)]
pub(crate) enum Access {
    Read,
    Write,
}

/// How a run with a deadline ended.
pub(crate) enum Waited {
    Exited(Finished),
    TimedOut,
}

/// What a run printed on each stream, and how it exited.
pub(crate) struct Finished {
    pub(crate) status: ExitStatus,
    pub(crate) stdout: Vec<u8>,
    pub(crate) stderr: Vec<u8>,
}

impl Finished {
    /// stdout, then stderr.
    pub(crate) fn combined(mut self) -> Vec<u8> {
        self.stdout.append(&mut self.stderr);
        self.stdout
    }
}

/// A pipe's bytes: all of them up to its end, or those that came before the deadline.
enum Collected {
    Whole(Vec<u8>),
    Cut(Vec<u8>),
}

pub(crate) fn git_command(git: &Path, cwd: &Path, access: Access, args: &[&str]) -> Command {
    let mut command = git_command_as_user(git, cwd, args);
    command.env("LC_ALL", "C");
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

/// Runs `command` until it exits, however long that takes, with stdin closed. A process it left in the
/// background (a hook's) may hold both pipes open: after the exit, its output is read for `READER_GRACE` only.
pub(crate) fn run_to_end(command: Command) -> Result<Finished> {
    let args = argv(&command);
    tracing::debug!(?args, "running git without a deadline");
    let mut child = spawn_piped(command, false)?;
    let stdout = read_on_thread(child.stdout.take().ok_or_else(closed_pipe)?);
    let stderr = read_on_thread(child.stderr.take().ok_or_else(closed_pipe)?);
    let status = child.wait()?;
    let grace_end = Instant::now() + READER_GRACE;
    Ok(Finished {
        status,
        stdout: output_until(&stdout, grace_end)?,
        stderr: output_until(&stderr, grace_end)?,
    })
}

fn output_until(chunks: &Receiver<io::Result<Vec<u8>>>, end: Instant) -> io::Result<Vec<u8>> {
    match collected(chunks, end)? {
        Collected::Whole(bytes) => Ok(bytes),
        Collected::Cut(bytes) => {
            tracing::debug!("a process git left running still holds its output pipe");
            Ok(bytes)
        }
    }
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
    let finished = match run_with_deadline(command, stdin, timeout)? {
        Waited::Exited(finished) => finished,
        Waited::TimedOut => {
            return Err(Error::Timeout {
                args,
                after: timeout,
            });
        }
    };
    if !accepts(finished.status) {
        return Err(Error::GitFailed {
            args,
            status: finished.status.code(),
            stderr: String::from_utf8_lossy(&finished.stderr)
                .trim_end()
                .to_owned(),
        });
    }
    Ok(finished.stdout)
}

/// Runs `command` with stdin closed, or given `stdin` written and closed, and kills it at `timeout`. A failed
/// write counts only after an exit 0: a program that failed may well have stopped reading.
pub(crate) fn run_with_deadline(
    command: Command,
    stdin: Option<Vec<u8>>,
    timeout: Duration,
) -> io::Result<Waited> {
    let deadline = Instant::now() + timeout;
    let mut child = spawn_piped(command, stdin.is_some())?;
    let writer = if let (Some(mut pipe), Some(bytes)) = (child.stdin.take(), stdin) {
        Some(thread::spawn(move || pipe.write_all(&bytes)))
    } else {
        None
    };
    let waited = wait_with_deadline(&mut child, deadline)?;
    if let (Waited::Exited(finished), Some(writer)) = (&waited, writer)
        && finished.status.success()
    {
        let written = writer.join().map_err(|_| thread_panicked())?;
        written?;
    }
    Ok(waited)
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

/// Sends each piece of the pipe as it is read, so a reader cut off at a deadline keeps what came before it;
/// the channel closes at the pipe's end.
fn read_on_thread(mut pipe: impl Read + Send + 'static) -> Receiver<io::Result<Vec<u8>>> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut buffer = [0; READ_CHUNK_BYTES];
        loop {
            let piece = match pipe.read(&mut buffer) {
                Ok(0) => return,
                Ok(read) => Ok(buffer[..read].to_vec()),
                Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                Err(error) => Err(error),
            };
            let failed = piece.is_err();
            if sender.send(piece).is_err() || failed {
                return;
            }
        }
    });
    receiver
}

fn collected(pieces: &Receiver<io::Result<Vec<u8>>>, deadline: Instant) -> io::Result<Collected> {
    let mut bytes = Vec::new();
    loop {
        match pieces.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
            Ok(piece) => bytes.extend_from_slice(&piece?),
            Err(RecvTimeoutError::Disconnected) => return Ok(Collected::Whole(bytes)),
            Err(RecvTimeoutError::Timeout) => return Ok(Collected::Cut(bytes)),
        }
    }
}

fn receive_output(
    status: ExitStatus,
    stdout: &Receiver<io::Result<Vec<u8>>>,
    stderr: &Receiver<io::Result<Vec<u8>>>,
    deadline: Instant,
) -> io::Result<Waited> {
    let Collected::Whole(stdout) = collected(stdout, deadline)? else {
        return Ok(Waited::TimedOut);
    };
    let Collected::Whole(stderr) = collected(stderr, deadline)? else {
        return Ok(Waited::TimedOut);
    };
    Ok(Waited::Exited(Finished {
        status,
        stdout,
        stderr,
    }))
}

fn closed_pipe() -> io::Error {
    io::Error::from(io::ErrorKind::BrokenPipe)
}

fn thread_panicked() -> io::Error {
    io::Error::other("pipe thread panicked")
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

    fn run_alias_to_end(alias_body: &str) -> Finished {
        let alias = format!("alias.say=!{alias_body}");
        let command = git_command_as_user(Path::new("git"), Path::new("/"), &["-c", &alias, "say"]);
        run_to_end(command).unwrap()
    }

    #[test]
    fn a_run_to_the_end_keeps_stdout_and_stderr_apart_and_gives_git_s_exit_status() {
        let finished = run_alias_to_end("echo err >&2; echo out; exit 3");

        assert_eq!(finished.status.code(), Some(3));
        assert_eq!(finished.stdout, b"out\n");
        assert_eq!(finished.stderr, b"err\n");
        assert_eq!(finished.combined(), b"out\nerr\n");
    }

    // A hook or editor reading stdin would wait forever on an open pipe.
    #[test]
    fn a_run_to_the_end_closes_stdin() {
        let finished = run_alias_to_end("cat; echo read");

        assert!(finished.status.success());
        assert_eq!(finished.stdout, b"read\n");
    }

    // `Command::output` reads both pipes to their end: a hook's background process holding them would keep
    // Continue running after git exited.
    #[test]
    fn a_run_to_the_end_returns_when_git_exits_while_a_background_process_holds_its_pipes() {
        let started = Instant::now();

        let finished = run_alias_to_end("echo out; echo err >&2; sleep 30 &");

        assert!(
            started.elapsed() < Duration::from_secs(SLEEP_SECONDS),
            "{:?}",
            started.elapsed()
        );
        assert!(finished.status.success());
        assert_eq!(
            (finished.stdout, finished.stderr),
            (b"out\n".to_vec(), b"err\n".to_vec())
        );
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

    #[test]
    fn yamt_s_own_command_is_the_user_s_with_the_c_locale_and_no_optional_locks_on_reads() {
        let (git, root) = (Path::new("git"), Path::new("/"));
        let envs = |command: &Command| -> Vec<(String, String)> {
            let envs = command.get_envs();
            envs.map(|(key, value)| {
                (
                    key.display().to_string(),
                    value.unwrap().display().to_string(),
                )
            })
            .collect()
        };
        let read = git_command(git, root, Access::Read, &["status"]);
        let write = git_command(git, root, Access::Write, &["add"]);

        assert_eq!(
            argv(&read),
            argv(&git_command_as_user(git, root, &["status"]))
        );
        let c_locale = ("LC_ALL".to_owned(), "C".to_owned());
        let no_locks = ("GIT_OPTIONAL_LOCKS".to_owned(), "0".to_owned());
        let mut read_envs = envs(&read);
        read_envs.sort();
        assert_eq!(read_envs, [no_locks, c_locale.clone()]);
        assert_eq!(envs(&write), [c_locale]);
    }
}

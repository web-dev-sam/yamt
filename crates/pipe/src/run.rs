use std::io::{self, BufReader};
use std::path::Path;
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, SendError, Sender};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::frame::{self, Frame, Framing, MAX_MESSAGE_BYTES};

const STOP_GRACE: Duration = Duration::from_secs(2);
const EXIT_POLL: Duration = Duration::from_millis(20);
const OUTPUT_DRAIN: Duration = Duration::from_secs(1);
/// `CREATE_NO_WINDOW` (Win32 process creation flags): a console program gets no console window.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// What a running server sends the window; `Exited` comes once, last.
#[expect(
    missing_docs,
    reason = "specta copies doc comments into the generated bindings.ts, whose shape is fixed"
)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum HostEvent {
    Message { text: String },
    Log { line: String },
    Exited { code: Option<i32> },
}

#[derive(Debug)]
enum StopReason {
    Asked,
    ExitedByItself,
    OutputClosed,
    OutputBroken,
    EventsGone,
}

enum ToServer {
    Message(String),
    Close,
}

/// One started program and the threads around it: a supervisor owning the `Child`, a writer
/// owning its stdin, a reader each for stdout and stderr.
pub struct Running {
    stop: Sender<StopReason>,
    writes: Sender<ToServer>,
    supervisor: JoinHandle<()>,
}

impl Running {
    /// Starts `program` in `folder`; `events` gets its messages and stderr lines, then one
    /// `Exited`. Once `events` is dropped, the run stops itself at its next output.
    pub fn start(
        program: &Path,
        args: &[String],
        folder: &Path,
        framing: Framing,
        events: Sender<HostEvent>,
    ) -> io::Result<Running> {
        let mut child = command(program, args, folder).spawn()?;
        let (Some(stdin), Some(stdout), Some(stderr)) =
            (child.stdin.take(), child.stdout.take(), child.stderr.take())
        else {
            stop_now(&mut child);
            return Err(io::Error::other("the program's pipes are missing"));
        };
        let (stop, stop_requests) = mpsc::channel();
        let (writes, queued) = mpsc::channel();
        thread::spawn(move || write_messages(stdin, framing, &queued));
        let readers = vec![
            spawn_message_reader(stdout, framing, &events, &stop),
            spawn_log_reader(stderr, &events, &stop),
        ];
        let close = writes.clone();
        let supervisor =
            thread::spawn(move || supervise(child, &stop_requests, &close, &events, &readers));
        Ok(Running {
            stop,
            writes,
            supervisor,
        })
    }

    /// Queues one message for the program's stdin; after the run ended it is ignored.
    pub fn send(&self, message: String) {
        let _ = self.writes.send(ToServer::Message(message));
    }

    /// Closes the program's stdin, gives it 2 s to exit, then kills it; returns at once.
    pub fn stop(&self) {
        let _ = self.stop.send(StopReason::Asked);
    }

    /// Whether the run has ended: the program reaped and `Exited` sent.
    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.supervisor.is_finished()
    }

    /// Returns once the run has ended: the program reaped and `Exited` sent.
    pub fn wait(self) {
        if self.supervisor.join().is_err() {
            tracing::error!("a program's supervisor thread panicked");
        }
    }
}

fn command(program: &Path, args: &[String], folder: &Path) -> Command {
    tracing::debug!(?program, ?args, ?folder, "starting a program");
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(folder)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut command, CREATE_NO_WINDOW);
    command
}

fn spawn_message_reader(
    stdout: ChildStdout,
    framing: Framing,
    events: &Sender<HostEvent>,
    stop: &Sender<StopReason>,
) -> JoinHandle<()> {
    let events = events.clone();
    let stop = stop.clone();
    thread::spawn(move || {
        let reason = read_messages(stdout, framing, &events);
        let _ = stop.send(reason);
    })
}

/// The end of stderr stops nothing: a server may close it and keep serving over stdout.
fn spawn_log_reader(
    stderr: ChildStderr,
    events: &Sender<HostEvent>,
    stop: &Sender<StopReason>,
) -> JoinHandle<()> {
    let events = events.clone();
    let stop = stop.clone();
    thread::spawn(move || {
        if read_log(stderr, &events).is_err() {
            let _ = stop.send(StopReason::EventsGone);
        }
    })
}

fn read_messages(stdout: ChildStdout, framing: Framing, events: &Sender<HostEvent>) -> StopReason {
    let mut reader = BufReader::new(stdout);
    loop {
        let event = match frame::read_message(&mut reader, framing) {
            Frame::Message(text) => HostEvent::Message { text },
            Frame::Dropped { reason } => HostEvent::Log {
                line: format!("yamt: dropped {reason}"),
            },
            Frame::End => return StopReason::OutputClosed,
            Frame::TooLarge { bytes } => {
                let line = format!(
                    "yamt: the server sent a message of {bytes} bytes, above the limit of {MAX_MESSAGE_BYTES}; stopping it"
                );
                return stop_with_log(events, line);
            }
            Frame::Broken { reason } => {
                let line = format!("yamt: cannot read the server's output: {reason}; stopping it");
                return stop_with_log(events, line);
            }
        };
        if events.send(event).is_err() {
            return StopReason::EventsGone;
        }
    }
}

fn stop_with_log(events: &Sender<HostEvent>, line: String) -> StopReason {
    let _ = events.send(HostEvent::Log { line });
    StopReason::OutputBroken
}

/// `Err` once nobody takes the events; `Ok` when stderr ends or cannot be read.
fn read_log(stderr: ChildStderr, events: &Sender<HostEvent>) -> Result<(), SendError<HostEvent>> {
    let mut reader = BufReader::new(stderr);
    while let Ok(Some(line)) = frame::log_line(&mut reader) {
        events.send(HostEvent::Log { line })?;
    }
    Ok(())
}

fn write_messages(mut stdin: ChildStdin, framing: Framing, queued: &Receiver<ToServer>) {
    for write in queued {
        match write {
            ToServer::Message(text) => {
                if frame::write_message(&mut stdin, framing, &text).is_err() {
                    return;
                }
            }
            ToServer::Close => return,
        }
    }
}

fn supervise(
    mut child: Child,
    stop_requests: &Receiver<StopReason>,
    writes: &Sender<ToServer>,
    events: &Sender<HostEvent>,
    readers: &[JoinHandle<()>],
) {
    let reason = wait_for_stop(&mut child, stop_requests);
    tracing::debug!(?reason, "stopping a program");
    let _ = writes.send(ToServer::Close);
    let code = exit_code(&mut child);
    let drained = Instant::now() + OUTPUT_DRAIN;
    while !readers.iter().all(JoinHandle::is_finished) && Instant::now() < drained {
        thread::sleep(EXIT_POLL);
    }
    let _ = events.send(HostEvent::Exited { code });
}

fn wait_for_stop(child: &mut Child, stop_requests: &Receiver<StopReason>) -> StopReason {
    loop {
        match stop_requests.recv_timeout(EXIT_POLL) {
            Ok(reason) => return reason,
            Err(RecvTimeoutError::Disconnected) => return StopReason::Asked,
            Err(RecvTimeoutError::Timeout) => {
                if !matches!(child.try_wait(), Ok(None)) {
                    return StopReason::ExitedByItself;
                }
            }
        }
    }
}

/// Waits `STOP_GRACE` for the program to exit, then kills it; `None` when a signal ended it.
fn exit_code(child: &mut Child) -> Option<i32> {
    let deadline = Instant::now() + STOP_GRACE;
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(status)) => return status.code(),
            Ok(None) => thread::sleep(EXIT_POLL),
            Err(_) => break,
        }
    }
    stop_now(child)
}

fn stop_now(child: &mut Child) -> Option<i32> {
    let _ = child.kill();
    child.wait().ok().and_then(|status| status.code())
}

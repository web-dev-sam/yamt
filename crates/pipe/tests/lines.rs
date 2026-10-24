#![cfg(test)]

use std::path::Path;
use std::process::Command;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use yamt_pipe::{Framing, HostEvent, Running};

const ECHO: &str = env!("CARGO_BIN_EXE_line-echo");
const WAIT: Duration = Duration::from_secs(10);
const STOP_GRACE: Duration = Duration::from_secs(2);
const IDLE: Duration = Duration::from_millis(300);
const POLL: Duration = Duration::from_millis(20);
const BURST_LINES: usize = 1000;
const BURST_PADDING: usize = 40;
const TOO_LONG: &str = "yamt: dropped a message of more than 64 MiB";
const NOT_UTF8: &str = "yamt: dropped a message that is not UTF-8";

struct Echo {
    running: Running,
    events: Receiver<HostEvent>,
    pid: u32,
}

fn start_echo(args: &[&str]) -> Echo {
    let (sender, events) = mpsc::channel();
    let args: Vec<String> = args.iter().map(|arg| (*arg).to_owned()).collect();
    let folder = Path::new(env!("CARGO_MANIFEST_DIR"));
    let running = Running::start(Path::new(ECHO), &args, folder, Framing::Lines, sender).unwrap();
    let pid = pid_of(&next_log(&events));
    Echo {
        running,
        events,
        pid,
    }
}

fn pid_of(first_line: &str) -> u32 {
    first_line
        .strip_prefix("line-echo pid ")
        .unwrap()
        .parse()
        .unwrap()
}

impl Echo {
    fn send(&self, message: &str) {
        self.running.send(message.to_owned());
    }
}

fn next_event(events: &Receiver<HostEvent>) -> HostEvent {
    events.recv_timeout(WAIT).unwrap()
}

fn next_message(events: &Receiver<HostEvent>) -> String {
    match next_event(events) {
        HostEvent::Message { text } => text,
        other @ (HostEvent::Log { .. } | HostEvent::Exited { .. }) => {
            panic!("{other:?} instead of a message")
        }
    }
}

fn next_log(events: &Receiver<HostEvent>) -> String {
    match next_event(events) {
        HostEvent::Log { line } => line,
        other @ (HostEvent::Message { .. } | HostEvent::Exited { .. }) => {
            panic!("{other:?} instead of a log line")
        }
    }
}

/// Every event before the one `Exited`, and its code, after checking nothing follows it.
fn events_until_exited(events: &Receiver<HostEvent>) -> (Vec<HostEvent>, Option<i32>) {
    let mut before = Vec::new();
    loop {
        match next_event(events) {
            HostEvent::Exited { code } => {
                assert_eq!(
                    events.recv_timeout(WAIT),
                    Err(RecvTimeoutError::Disconnected)
                );
                return (before, code);
            }
            event @ (HostEvent::Message { .. } | HostEvent::Log { .. }) => before.push(event),
        }
    }
}

fn exited_once(events: &Receiver<HostEvent>) -> Option<i32> {
    events_until_exited(events).1
}

#[cfg(unix)]
fn is_alive(pid: u32) -> bool {
    let status = Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .unwrap();
    status.success()
}

#[cfg(windows)]
fn is_alive(pid: u32) -> bool {
    let filter = format!("PID eq {pid}");
    let output = Command::new("tasklist")
        .args(["/FI", &filter, "/NH"])
        .output()
        .unwrap();
    String::from_utf8_lossy(&output.stdout).contains(&pid.to_string())
}

/// Catches a framing that loses or re-encodes bytes past ASCII.
#[test]
fn a_line_message_comes_back_whole_with_a_multi_byte_body() {
    let echo = start_echo(&[]);
    let text = "{\"text\":\"héllo → 世界 🦀\"}";
    echo.send(text);
    assert_eq!(next_message(&echo.events), text);
}

/// Catches a reader that takes whatever one read returned as a message.
#[test]
fn a_line_split_across_two_writes_arrives_as_one_message() {
    let echo = start_echo(&[]);
    echo.send("split ü→世界 split");
    assert_eq!(next_message(&echo.events), "ü→世界 split");
}

/// Catches a reader that takes one read as one message, or loses what follows the first line.
#[test]
fn two_lines_in_one_write_arrive_as_two_messages() {
    let echo = start_echo(&[]);
    echo.send("twice abc");
    echo.send("after");
    assert_eq!(next_message(&echo.events), "abc");
    assert_eq!(next_message(&echo.events), "abc");
    assert_eq!(next_message(&echo.events), "after");
}

/// Catches a reader that passes on the `\r` of a Windows line end.
#[test]
fn a_crlf_line_end_is_not_part_of_the_message() {
    let echo = start_echo(&[]);
    echo.send("crlf {\"a\":1}");
    assert_eq!(next_message(&echo.events), "{\"a\":1}");
}

/// Catches a reader without a cap, one that stops the program, or one that loses the next line.
#[test]
fn a_line_over_the_cap_is_dropped_with_a_log_line_and_the_next_one_arrives() {
    let echo = start_echo(&[]);
    echo.send("huge");
    assert_eq!(next_log(&echo.events), TOO_LONG);
    assert_eq!(next_message(&echo.events), "after");
    echo.send("still here");
    assert_eq!(next_message(&echo.events), "still here");
}

/// Catches a reader that passes on replacement characters or stops at a bad line.
#[test]
fn a_line_that_is_not_utf8_is_dropped_with_a_log_line() {
    let echo = start_echo(&[]);
    echo.send("bytes");
    assert_eq!(next_log(&echo.events), NOT_UTF8);
    assert_eq!(next_message(&echo.events), "after");
}

/// Catches stderr read with the message framing or lost.
#[test]
fn a_stderr_line_is_a_log_event() {
    let echo = start_echo(&[]);
    echo.send("stderr warming up é");
    assert_eq!(next_log(&echo.events), "warming up é");
    echo.send("next");
    assert_eq!(next_message(&echo.events), "next");
}

/// Catches a lost or doubled `Exited`, one before the program's last output, or a lost code.
#[test]
fn exited_comes_once_and_last_with_the_code() {
    let echo = start_echo(&[]);
    echo.send("before");
    echo.send("exit 7");
    let (before, code) = events_until_exited(&echo.events);
    let message = HostEvent::Message {
        text: "before".to_owned(),
    };
    assert_eq!((before, code), (vec![message], Some(7)));
}

#[test]
fn stop_closes_stdin_and_a_cooperative_program_exits_once_within_the_grace() {
    let echo = start_echo(&[]);
    let asked = Instant::now();
    echo.running.stop();
    assert_eq!(exited_once(&echo.events), Some(0));
    assert!(asked.elapsed() < STOP_GRACE, "{:?}", asked.elapsed());
    echo.running.stop();
    echo.send("ignored");
    assert!(!is_alive(echo.pid));
}

#[test]
fn stop_kills_a_program_that_ignores_it_after_the_grace() {
    let echo = start_echo(&["--ignore-stop"]);
    let asked = Instant::now();
    echo.running.stop();
    let code = exited_once(&echo.events);
    assert!(asked.elapsed() >= STOP_GRACE, "{:?}", asked.elapsed());
    if cfg!(unix) {
        assert_eq!(code, None);
    }
    assert!(!is_alive(echo.pid));
}

#[test]
fn an_idle_program_keeps_running_and_answers_later() {
    let echo = start_echo(&[]);
    thread::sleep(IDLE);
    assert!(is_alive(echo.pid));
    assert!(!echo.running.is_finished());
    echo.send("still here");
    assert_eq!(next_message(&echo.events), "still here");
}

#[test]
fn is_finished_turns_true_once_the_run_has_ended() {
    let echo = start_echo(&[]);
    echo.send("exit 0");
    exited_once(&echo.events);
    let deadline = Instant::now() + WAIT;
    while !echo.running.is_finished() && Instant::now() < deadline {
        thread::sleep(POLL);
    }
    assert!(echo.running.is_finished());
}

#[test]
fn wait_returns_after_exited_was_sent() {
    let echo = start_echo(&[]);
    echo.running.stop();
    echo.running.wait();
    let last = echo.events.try_iter().last();
    assert_eq!(last, Some(HostEvent::Exited { code: Some(0) }));
}

#[test]
fn a_dropped_event_receiver_stops_the_run_at_its_next_output() {
    let Echo {
        running,
        events,
        pid,
    } = start_echo(&[]);
    drop(events);
    running.send("anyone there".to_owned());
    let deadline = Instant::now() + WAIT;
    while is_alive(pid) && Instant::now() < deadline {
        thread::sleep(POLL);
    }
    assert!(!is_alive(pid));
}

#[test]
fn stderr_lines_written_after_the_program_exited_all_come_before_its_exited() {
    let echo = start_echo(&[]);
    echo.send(&format!("burst {BURST_LINES}"));
    let (before, code) = events_until_exited(&echo.events);
    assert_eq!(code, Some(0));
    let padding = "-".repeat(BURST_PADDING);
    let expected: Vec<HostEvent> = (0..BURST_LINES)
        .map(|line| HostEvent::Log {
            line: format!("line-echo burst {line} {padding}"),
        })
        .collect();
    assert_eq!(before, expected);
}

#[cfg(unix)]
#[test]
fn a_program_whose_child_holds_its_output_exits_after_at_most_the_drain() {
    const OUTPUT_DRAIN: Duration = Duration::from_secs(1);
    const DRAIN_SLACK: Duration = Duration::from_secs(1);
    let echo = start_echo(&[]);
    let asked = Instant::now();
    echo.send("orphan");
    let code = loop {
        if let HostEvent::Exited { code } = next_event(&echo.events) {
            break code;
        }
    };
    let took = asked.elapsed();
    assert_eq!(code, Some(3));
    assert!(took < OUTPUT_DRAIN + DRAIN_SLACK, "{took:?}");
}

#[cfg(unix)]
#[test]
fn a_program_that_closes_its_stderr_keeps_serving() {
    let echo = start_echo(&[]);
    echo.send("close-stderr");
    assert_eq!(next_message(&echo.events), "stderr closed");
    echo.send("still here");
    assert_eq!(next_message(&echo.events), "still here");
}

#[cfg(unix)]
#[test]
fn a_program_that_closes_its_stdout_is_stopped_through_its_stdin() {
    let echo = start_echo(&[]);
    let asked = Instant::now();
    echo.send("close-stdout");
    let (before, code) = events_until_exited(&echo.events);
    let pid_line = |event: &HostEvent| matches!(event, HostEvent::Log { line } if line.starts_with("line-echo pid "));
    assert!(before.iter().all(pid_line), "{before:?}");
    assert_eq!(code, Some(0));
    assert!(asked.elapsed() < STOP_GRACE, "{:?}", asked.elapsed());
}

#[test]
fn a_missing_folder_is_a_start_error() {
    let (sender, _events) = mpsc::channel();
    let folder = Path::new(env!("CARGO_MANIFEST_DIR")).join("missing");
    let started = Running::start(Path::new(ECHO), &[], &folder, Framing::Lines, sender);
    assert!(started.is_err());
}

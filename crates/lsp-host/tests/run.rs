#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use tempfile::TempDir;
use yamt_lsp_host::{Host, HostEvent, ProgramFolders, RunId, ServerCommand, StartReply};

const ECHO: &str = env!("CARGO_BIN_EXE_lsp-echo");
const WAIT: Duration = Duration::from_secs(10);
const STOP_GRACE: Duration = Duration::from_secs(2);
const LOG_LINE_BYTES: usize = 8 * 1024;
const IDLE: Duration = Duration::from_millis(300);
const BURST_LINES: usize = 1000;
const OUTPUT_DRAIN: Duration = Duration::from_secs(1);
const DRAIN_SLACK: Duration = Duration::from_secs(1);
const BURST_PADDING: usize = 40;

struct Echo {
    _repo: TempDir,
    host: Host,
    run: RunId,
    events: Receiver<HostEvent>,
    pid: u32,
}

fn echo_command(args: &[&str], project: &str) -> ServerCommand {
    ServerCommand {
        program: ECHO.to_owned(),
        args: args.iter().map(|arg| (*arg).to_owned()).collect(),
        project: project.to_owned(),
        folders: ProgramFolders::default(),
    }
}

fn start_echo(args: &[&str]) -> Echo {
    let repo = tempfile::tempdir().unwrap();
    let mut host = Host::new(repo.path());
    let (sender, events) = mpsc::channel();
    let StartReply::Started { run } = host.start(&echo_command(args, ""), sender) else {
        panic!("lsp-echo did not start");
    };
    let pid = pid_of(&next_log(&events));
    Echo {
        _repo: repo,
        host,
        run,
        events,
        pid,
    }
}

fn pid_of(first_line: &str) -> u32 {
    first_line
        .strip_prefix("lsp-echo pid ")
        .unwrap()
        .parse()
        .unwrap()
}

fn next_event(events: &Receiver<HostEvent>) -> HostEvent {
    events.recv_timeout(WAIT).unwrap()
}

fn next_message(events: &Receiver<HostEvent>) -> String {
    loop {
        match next_event(events) {
            HostEvent::Message { text } => return text,
            HostEvent::Log { .. } => {}
            HostEvent::Exited { code } => panic!("exited with {code:?} before a message"),
        }
    }
}

fn next_log(events: &Receiver<HostEvent>) -> String {
    loop {
        match next_event(events) {
            HostEvent::Log { line } => return line,
            HostEvent::Message { .. } => {}
            HostEvent::Exited { code } => panic!("exited with {code:?} before a log line"),
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

#[test]
fn a_message_comes_back_whole_with_a_multi_byte_body() {
    let echo = start_echo(&[]);
    let text = "{\"text\":\"héllo → 世界 🦀\"}";
    echo.host.send(echo.run, text.to_owned());
    assert_eq!(next_message(&echo.events), text);
}

#[test]
fn a_frame_split_across_two_writes_arrives_as_one_message() {
    let echo = start_echo(&[]);
    echo.host.send(echo.run, "split ü→世界 split".to_owned());
    assert_eq!(next_message(&echo.events), "ü→世界 split");
}

#[test]
fn two_frames_in_one_write_arrive_as_two_messages() {
    let echo = start_echo(&[]);
    echo.host.send(echo.run, "twice abc".to_owned());
    echo.host.send(echo.run, "after".to_owned());
    assert_eq!(next_message(&echo.events), "abc");
    assert_eq!(next_message(&echo.events), "abc");
    assert_eq!(next_message(&echo.events), "after");
}

#[test]
fn stderr_lines_arrive_as_log_lines_and_a_long_one_is_cut_at_8_kib() {
    let echo = start_echo(&[]);
    echo.host.send(echo.run, "short".to_owned());
    assert_eq!(next_log(&echo.events), "lsp-echo got short");
    let long = "x".repeat(LOG_LINE_BYTES * 2);
    echo.host.send(echo.run, long.clone());
    let line = next_log(&echo.events);
    assert_eq!(line.len(), LOG_LINE_BYTES);
    assert_eq!(line, format!("lsp-echo got {long}")[..LOG_LINE_BYTES]);
    echo.host.send(echo.run, "next".to_owned());
    assert_eq!(next_log(&echo.events), "lsp-echo got next");
}

#[test]
fn stop_closes_the_input_and_a_cooperative_server_exits_once_within_the_grace() {
    let echo = start_echo(&[]);
    let asked = Instant::now();
    echo.host.stop(echo.run);
    assert_eq!(exited_once(&echo.events), Some(0));
    assert!(asked.elapsed() < STOP_GRACE, "{:?}", asked.elapsed());
    echo.host.stop(echo.run);
    echo.host.send(echo.run, "ignored".to_owned());
    assert!(!is_alive(echo.pid));
}

#[test]
fn stop_kills_a_server_that_ignores_it_after_the_grace_and_exits_once() {
    let echo = start_echo(&["--ignore-stop"]);
    let asked = Instant::now();
    echo.host.stop(echo.run);
    let code = exited_once(&echo.events);
    assert!(asked.elapsed() >= STOP_GRACE, "{:?}", asked.elapsed());
    if cfg!(unix) {
        assert_eq!(code, None);
    }
    assert!(!is_alive(echo.pid));
}

#[test]
fn a_server_exiting_by_itself_reports_its_code() {
    let echo = start_echo(&[]);
    echo.host.send(echo.run, "exit 7".to_owned());
    assert_eq!(exited_once(&echo.events), Some(7));
}

#[test]
fn an_idle_server_keeps_running_and_answers_later() {
    let echo = start_echo(&[]);
    thread::sleep(IDLE);
    assert!(is_alive(echo.pid));
    echo.host.send(echo.run, "still here".to_owned());
    assert_eq!(next_message(&echo.events), "still here");
}

#[test]
fn stderr_lines_written_after_the_server_exited_all_come_before_its_exited() {
    let echo = start_echo(&[]);
    echo.host.send(echo.run, format!("burst {BURST_LINES}"));
    let (before, code) = events_until_exited(&echo.events);
    assert_eq!(code, Some(0));
    let burst: Vec<HostEvent> = before
        .into_iter()
        .filter(
            |event| matches!(event, HostEvent::Log { line } if line.starts_with("lsp-echo burst ")),
        )
        .collect();
    let padding = "-".repeat(BURST_PADDING);
    let expected: Vec<HostEvent> = (0..BURST_LINES)
        .map(|line| HostEvent::Log {
            line: format!("lsp-echo burst {line} {padding}"),
        })
        .collect();
    assert_eq!(burst, expected);
}

#[cfg(unix)]
#[test]
fn a_server_whose_child_holds_its_output_exits_after_at_most_the_drain() {
    let echo = start_echo(&[]);
    let asked = Instant::now();
    echo.host.send(echo.run, "orphan".to_owned());
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
fn a_server_that_closes_its_stderr_keeps_serving() {
    let echo = start_echo(&[]);
    echo.host.send(echo.run, "close-stderr".to_owned());
    assert_eq!(next_message(&echo.events), "stderr closed");
    echo.host.send(echo.run, "still here".to_owned());
    assert_eq!(next_message(&echo.events), "still here");
}

#[test]
fn a_dropped_event_receiver_stops_the_run_at_its_next_output() {
    let Echo {
        _repo,
        host,
        run,
        events,
        pid,
    } = start_echo(&[]);
    drop(events);
    host.send(run, "anyone there".to_owned());
    let deadline = Instant::now() + WAIT;
    while is_alive(pid) && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(50));
    }
    assert!(!is_alive(pid));
}

#[test]
fn stop_all_returns_with_no_child_left_also_one_that_ignores_stop() {
    let repo = tempfile::tempdir().unwrap();
    let mut host = Host::new(repo.path());
    let mut pids = Vec::new();
    let mut receivers = Vec::new();
    for args in [&[][..], &["--ignore-stop"][..]] {
        let (sender, events) = mpsc::channel();
        let reply = host.start(&echo_command(args, ""), sender);
        assert!(matches!(reply, StartReply::Started { .. }), "{reply:?}");
        pids.push(pid_of(&next_log(&events)));
        receivers.push(events);
    }
    host.stop_all();
    for pid in pids {
        assert!(!is_alive(pid), "{pid} is still running");
    }
    for events in &receivers {
        exited_once(events);
    }
}

#[test]
fn stop_every_signals_each_run_and_returns_before_they_exit() {
    let repo = tempfile::tempdir().unwrap();
    let mut host = Host::new(repo.path());
    let mut runs = Vec::new();
    for args in [&[][..], &["--ignore-stop"][..]] {
        let (sender, events) = mpsc::channel();
        let reply = host.start(&echo_command(args, ""), sender);
        assert!(matches!(reply, StartReply::Started { .. }), "{reply:?}");
        runs.push((pid_of(&next_log(&events)), events));
    }
    host.stop_every();
    let (ignoring, _) = &runs[1];
    assert!(is_alive(*ignoring));
    for (pid, events) in &runs {
        exited_once(events);
        assert!(!is_alive(*pid), "{pid} is still running");
    }
}

#[test]
fn a_project_outside_the_repository_is_refused() {
    let repo = tempfile::tempdir().unwrap();
    let mut host = Host::new(&repo.path().join("inner"));
    fs::create_dir_all(repo.path().join("inner")).unwrap();
    fs::create_dir_all(repo.path().join("outer")).unwrap();
    for project in ["../outer", "a/../../outer", "./x"] {
        let (sender, _events) = mpsc::channel();
        assert_eq!(
            host.start(&echo_command(&[], project), sender),
            StartReply::OutsideRepository {
                project: project.to_owned()
            }
        );
    }
}

#[cfg(unix)]
#[test]
fn a_project_reached_through_a_link_out_of_the_repository_is_refused() {
    let repo = tempfile::tempdir().unwrap();
    let root = repo.path().join("inner");
    fs::create_dir_all(&root).unwrap();
    fs::create_dir_all(repo.path().join("outer")).unwrap();
    std::os::unix::fs::symlink("../outer", root.join("link")).unwrap();
    let mut host = Host::new(&root);
    let (sender, _events) = mpsc::channel();
    let outside = StartReply::OutsideRepository {
        project: "link".to_owned(),
    };
    assert_eq!(host.start(&echo_command(&[], "link"), sender), outside);
}

#[test]
fn a_missing_project_folder_is_a_spawn_failure_and_a_missing_program_lists_the_search() {
    let repo = tempfile::tempdir().unwrap();
    let mut host = Host::new(repo.path());
    let (sender, _events) = mpsc::channel();
    let reply = host.start(&echo_command(&[], "missing"), sender.clone());
    let StartReply::SpawnFailed { program, message } = reply else {
        panic!("{reply:?}");
    };
    assert_eq!((program.as_str(), message.is_empty()), (ECHO, false));
    let missing = ServerCommand {
        program: "sub/not-there".to_owned(),
        args: Vec::new(),
        project: String::new(),
        folders: ProgramFolders::default(),
    };
    let searched = vec![repo.path().join("sub").display().to_string()];
    assert_eq!(
        host.start(&missing, sender),
        StartReply::NotFound {
            program: "sub/not-there".to_owned(),
            searched
        }
    );
}

/// A copy written here can still be open for writing in another test's forked child when the start
/// execs it, which fails with ETXTBSY (execve(2)); a link leaves no write handle in this process.
#[cfg(unix)]
fn place_echo(at: &Path) {
    std::os::unix::fs::symlink(ECHO, at).unwrap();
}

#[cfg(windows)]
fn place_echo(at: &Path) {
    fs::copy(ECHO, at).unwrap();
}

#[test]
fn a_bare_program_name_is_found_in_a_project_folder_and_not_without_it() {
    let repo = tempfile::tempdir().unwrap();
    let tools = repo.path().join("tools");
    fs::create_dir_all(&tools).unwrap();
    let name = Path::new(ECHO)
        .file_name()
        .unwrap()
        .to_str()
        .unwrap()
        .to_owned();
    place_echo(&tools.join(&name));
    let mut host = Host::new(repo.path());
    let command = |project: Vec<String>| ServerCommand {
        program: name.clone(),
        args: Vec::new(),
        project: String::new(),
        folders: ProgramFolders {
            project,
            home: Vec::new(),
        },
    };
    let (sender, _events) = mpsc::channel();
    let reply = host.start(&command(vec!["tools".to_owned()]), sender.clone());
    assert!(matches!(reply, StartReply::Started { .. }), "{reply:?}");
    host.stop_all();
    let reply = host.start(&command(Vec::new()), sender);
    let StartReply::NotFound { searched, .. } = reply else {
        panic!("{reply:?}");
    };
    let in_repo = |folder: &String| Path::new(folder).starts_with(repo.path());
    assert!(!searched.iter().any(in_repo), "{searched:?}");
}

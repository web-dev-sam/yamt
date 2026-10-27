#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::Duration;

use tempfile::TempDir;
use yamt_lsp_host::{Host, HostEvent, ProgramFolders, RunId, ServerCommand, StartReply};

const ECHO: &str = env!("CARGO_BIN_EXE_lsp-echo");
const WAIT: Duration = Duration::from_secs(10);
const LOG_LINE_BYTES: usize = 8 * 1024;

struct Echo {
    _repo: TempDir,
    host: Host,
    run: RunId,
    events: Receiver<HostEvent>,
}

fn echo_command(args: &[&str], project: &str) -> ServerCommand {
    ServerCommand {
        program: ECHO.to_owned(),
        args: args.iter().map(|arg| (*arg).to_owned()).collect(),
        project: project.to_owned(),
        folders: ProgramFolders::default(),
    }
}

fn start_echo() -> Echo {
    let repo = tempfile::tempdir().unwrap();
    let mut host = Host::new(repo.path());
    let (sender, events) = mpsc::channel();
    let StartReply::Started { run } = host.start(&echo_command(&[], ""), sender) else {
        panic!("lsp-echo did not start");
    };
    pid_of(&next_log(&events));
    Echo {
        _repo: repo,
        host,
        run,
        events,
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

/// Waits for the one `Exited` and checks nothing follows it.
fn exited_once(events: &Receiver<HostEvent>) {
    while !matches!(next_event(events), HostEvent::Exited { .. }) {}
    assert_eq!(
        events.recv_timeout(WAIT),
        Err(RecvTimeoutError::Disconnected)
    );
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

/// Catches a host that starts its runs with another framing than `Content-Length`.
#[test]
fn a_message_comes_back_whole_with_a_multi_byte_body() {
    let echo = start_echo();
    let text = "{\"text\":\"héllo → 世界 🦀\"}";
    echo.host.send(echo.run, text.to_owned());
    assert_eq!(next_message(&echo.events), text);
}

#[test]
fn stderr_lines_arrive_as_log_lines_and_a_long_one_is_cut_at_8_kib() {
    let echo = start_echo();
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
    let name = format!("yamt-echo-in-tools{}", std::env::consts::EXE_SUFFIX);
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

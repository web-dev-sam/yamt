#![cfg(test)]

mod common;

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::thread;
use std::time::Duration;

use yamt_agent::{AgentCommand, AgentRun, AgentStartReply, HostEvent, Workspace};
use yamt_range::pair_folders;

use common::{Fixture, commit_of};

const ECHO: &str = env!("CARGO_BIN_EXE_agent-echo");
const WAIT: Duration = Duration::from_secs(10);
const HOLD_RELEASE_AND_MORE: Duration = Duration::from_millis(800);
const MISSING_PROGRAM: &str = "yamt-agent-test-no-such-program";
const CRASH_CODE: i32 = 3;

/// A workspace and the folders it lives in.
struct Prepared {
    fixture: Fixture,
    checkout: PathBuf,
    workspace: Workspace,
}

fn prepared() -> Prepared {
    let mut unprepared = unprepared();
    unprepared.workspace.prepare();
    unprepared
}

fn unprepared() -> Prepared {
    let fixture = Fixture::new();
    Prepared {
        checkout: fixture.checkout(),
        workspace: fixture.workspace(),
        fixture,
    }
}

fn echo_command() -> AgentCommand {
    command(ECHO, &[])
}

fn command(program: &str, args: &[&str]) -> AgentCommand {
    AgentCommand {
        program: program.to_owned(),
        args: args.iter().map(|&arg| arg.to_owned()).collect(),
        home_folders: Vec::new(),
    }
}

fn start_echo(workspace: &mut Workspace) -> (AgentRun, Receiver<HostEvent>) {
    started(workspace, &echo_command())
}

fn started(workspace: &mut Workspace, command: &AgentCommand) -> (AgentRun, Receiver<HostEvent>) {
    let (sender, events) = mpsc::channel();
    match workspace.start(command, sender) {
        AgentStartReply::Started { run } => (run, events),
        other @ (AgentStartReply::NotFound { .. }
        | AgentStartReply::SpawnFailed { .. }
        | AgentStartReply::NoCheckout) => panic!("{other:?} instead of Started"),
    }
}

fn next_message(events: &Receiver<HostEvent>) -> String {
    match events.recv_timeout(WAIT).unwrap() {
        HostEvent::Message { text } => text,
        other @ (HostEvent::Log { .. } | HostEvent::Exited { .. }) => {
            panic!("{other:?} instead of a message")
        }
    }
}

/// The run's last event, already sent: `Exited`, with nothing after it.
fn exited_code(events: &Receiver<HostEvent>) -> Option<i32> {
    let code = match events.try_recv() {
        Ok(HostEvent::Exited { code }) => code,
        other => panic!("{other:?} instead of Exited"),
    };
    assert_eq!(events.try_recv(), Err(TryRecvError::Disconnected));
    code
}

fn same_folder(left: &Path, right: &Path) -> bool {
    fs::canonicalize(left).unwrap() == fs::canonicalize(right).unwrap()
}

#[test]
fn the_agent_runs_in_the_checkout() {
    let mut prepared = prepared();
    let (run, events) = start_echo(&mut prepared.workspace);

    prepared.workspace.send(run, "pwd".to_owned());
    let folder = next_message(&events);
    prepared.workspace.send(run, "edit a.txt".to_owned());
    assert_eq!(next_message(&events), "edited a.txt");

    assert!(same_folder(Path::new(&folder), &prepared.checkout));
    assert_eq!(
        commit_of(&prepared.checkout, "HEAD"),
        prepared.fixture.pair.new_commit
    );
    assert_eq!(
        fs::read(prepared.checkout.join("a.txt")).unwrap(),
        b"remote\nedited by agent-echo\n"
    );
}

#[test]
fn start_without_a_checkout_answers_no_checkout() {
    let mut unprepared = unprepared();
    let (sender, _events) = mpsc::channel();

    let reply = unprepared.workspace.start(&echo_command(), sender);

    assert_eq!(reply, AgentStartReply::NoCheckout);
}

#[test]
fn a_crashed_agent_reports_exited_once_with_its_code() {
    let mut prepared = prepared();
    let (run, events) = start_echo(&mut prepared.workspace);

    prepared.workspace.send(run, format!("exit {CRASH_CODE}"));

    assert_eq!(
        events.recv_timeout(WAIT).unwrap(),
        HostEvent::Exited {
            code: Some(CRASH_CODE)
        }
    );
    prepared.workspace.discard().unwrap();
    assert_eq!(events.try_recv(), Err(TryRecvError::Disconnected));
}

#[test]
fn start_while_an_agent_runs_stops_the_old_one_first() {
    let mut prepared = prepared();
    let (old_run, old_events) = start_echo(&mut prepared.workspace);

    let (new_run, new_events) = start_echo(&mut prepared.workspace);

    assert_ne!(old_run, new_run);
    assert_eq!(exited_code(&old_events), Some(0));
    prepared
        .workspace
        .send(old_run, "to the old run".to_owned());
    prepared.workspace.stop(old_run);
    prepared
        .workspace
        .send(new_run, "to the new run".to_owned());
    assert_eq!(next_message(&new_events), "to the new run");
}

#[test]
fn stop_ends_the_agent_of_its_run_and_keeps_the_checkout() {
    let mut prepared = prepared();
    let (run, events) = start_echo(&mut prepared.workspace);

    prepared.workspace.stop(run);

    assert_eq!(
        events.recv_timeout(WAIT).unwrap(),
        HostEvent::Exited { code: Some(0) }
    );
    assert!(prepared.checkout.join("a.txt").exists());
}

#[test]
fn stop_agent_ends_the_running_agent_and_keeps_the_checkout() {
    let mut prepared = prepared();
    let (_run, events) = start_echo(&mut prepared.workspace);

    prepared.workspace.stop_agent();

    assert_eq!(
        events.recv_timeout(WAIT).unwrap(),
        HostEvent::Exited { code: Some(0) }
    );
    assert!(prepared.checkout.join("a.txt").exists());
}

#[test]
fn a_missing_program_lists_path_and_the_home_entries() {
    let mut prepared = prepared();
    let command = AgentCommand {
        program: MISSING_PROGRAM.to_owned(),
        args: Vec::new(),
        home_folders: vec!["agents/bin".to_owned(), ".local/bin".to_owned()],
    };
    let (sender, _events) = mpsc::channel();

    let reply = prepared.workspace.start(&command, sender);

    let path_variable = env::var_os("PATH").unwrap_or_default();
    let home = env::home_dir().unwrap();
    let mut searched: Vec<PathBuf> = env::split_paths(&path_variable).collect();
    searched.push(home.join("agents").join("bin"));
    searched.push(home.join(".local").join("bin"));
    assert_eq!(
        reply,
        AgentStartReply::NotFound {
            program: MISSING_PROGRAM.to_owned(),
            searched: searched
                .iter()
                .map(|folder| folder.to_string_lossy().into_owned())
                .collect(),
        }
    );
}

#[test]
fn a_relative_program_path_is_never_taken_from_the_reviewed_commit() {
    let mut prepared = prepared();
    let bin = prepared.checkout.join("bin");
    fs::create_dir(&bin).unwrap();
    fs::copy(ECHO, bin.join("agent")).unwrap();
    let (sender, _events) = mpsc::channel();

    let reply = prepared.workspace.start(&command("bin/agent", &[]), sender);

    assert_eq!(
        reply,
        AgentStartReply::NotFound {
            program: "bin/agent".to_owned(),
            searched: Vec::new(),
        }
    );
}

#[test]
fn discard_stops_the_agent_before_removing_the_checkout() {
    let mut prepared = prepared();
    let (run, events) = start_echo(&mut prepared.workspace);
    prepared.workspace.send(run, "hold a.txt".to_owned());
    assert_eq!(next_message(&events), "holding a.txt");

    prepared.workspace.discard().unwrap();

    assert_eq!(exited_code(&events), Some(0));
    thread::sleep(HOLD_RELEASE_AND_MORE);
    assert!(!prepared.checkout.exists());
    assert_eq!(
        pair_folders(prepared.fixture.range_dir.path()),
        [prepared.fixture.pair.folder.clone()]
    );
    let (sender, _later) = mpsc::channel();
    assert_eq!(
        prepared.workspace.start(&echo_command(), sender),
        AgentStartReply::NoCheckout
    );
}

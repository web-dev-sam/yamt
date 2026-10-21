#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_TWO_FILE, TempDir, git, git_ok, install_hook, operation_repo,
};
use yamt_session::{
    Continued, DiskVersion, Error, FileStatus, MergeSession, OperationKind, OperationView,
    ProgressView, Refreshed, SideName, StopList,
};

const CART: &str = "cart.ts";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: CART,
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];
/// `STEP_TWO_FILE` conflicts at step 1 too, so git rewrites it for the next stop.
const BOTH_STEPS: [ConflictFile<'static>; 1] = [ConflictFile {
    path: STEP_TWO_FILE,
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local-1\n"),
    remote: Some(b"remote-1\n"),
}];
const STEP_ONE_MESSAGE: &str = "step 1\n\nThe first step's body.";
const HOOK_LINE: &str = "hook: refused";
const USER_LOCALE: &str = "C.UTF-8";
const LOCALE_HOOK_TEST: &str =
    "a_refusing_pre_commit_hook_seen_in_the_user_s_locale_is_git_refused";

fn text(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

fn opened(run: Run, files: &[ConflictFile]) -> (TempDir, MergeSession) {
    let dir = operation_repo(run, files).unwrap();
    let session = MergeSession::open(dir.path()).unwrap();
    (dir, session)
}

fn listed(session: &mut MergeSession) -> StopList {
    match session.refresh_stop().unwrap() {
        Refreshed::Files(list) => list,
        Refreshed::MovedOn => panic!("moved on"),
    }
}

fn finished_every_file(session: &mut MergeSession) {
    for file in session.files() {
        session
            .finish(&file.path, "resolved\n", DiskVersion(0))
            .unwrap();
    }
}

fn commit(root: &Path, revision: &str) -> SideName {
    let field = |format: &str| {
        let field = text(
            root,
            &["log", "-1", &format!("--format={format}"), revision],
        );
        field.trim_end().to_owned()
    };
    SideName::Commit {
        short_id: field("%h"),
        subject: field("%s"),
        message: field("%B"),
    }
}

fn branch(name: &str) -> SideName {
    SideName::Branch {
        name: name.to_owned(),
    }
}

const ONE_OF_THREE: Option<ProgressView> = Some(ProgressView { step: 1, total: 3 });

type ExpectedView = fn(&Path) -> OperationView;

fn unmerged(root: &Path) -> String {
    text(root, &["ls-files", "-u"])
}

/// Resolves `STEP_TWO_FILE` at step 1 and continues in a terminal; git stops at step 2.
fn continued_in_a_terminal(root: &Path) {
    fs::write(root.join(STEP_TWO_FILE), "resolved\n").unwrap();
    git_ok(root, &["add", "--", STEP_TWO_FILE]).unwrap();
    let next = git(root, &["rebase", "--continue"]).unwrap();
    assert!(!next.status.success(), "rebase --continue finished");
}

// Settling the old stop's files after a move stages a file the user left unresolved at the next stop.
#[test]
fn a_list_after_a_terminal_continue_is_moved_on_and_stages_nothing_into_the_next_stop() {
    let (dir, mut session) = opened(Run::Rebase, &BOTH_STEPS);
    let root = dir.path();
    let files_before = session.files();
    continued_in_a_terminal(root);
    fs::write(root.join(STEP_TWO_FILE), "fixed by hand\n").unwrap();
    let unmerged_at_step_two = unmerged(root);
    assert!(unmerged_at_step_two.contains(STEP_TWO_FILE));

    let refreshed = session.refresh_stop().unwrap();

    assert_eq!(refreshed, Refreshed::MovedOn);
    assert_eq!(unmerged(root), unmerged_at_step_two);
    assert_eq!(session.files(), files_before);
    assert!(matches!(session.abort_operation(), Err(Error::StopMovedOn)));
    assert!(matches!(
        session.continue_operation(),
        Err(Error::StopMovedOn)
    ));
    assert_eq!(unmerged(root), unmerged_at_step_two);
}

// A progress change alone read as a move would drop the user's edits at a stop that did not change.
#[test]
fn a_list_at_the_same_stop_has_the_rebase_with_its_names_and_progress() {
    let (dir, mut session) = opened(Run::Rebase, &FILES);
    let root = dir.path();

    let list = listed(&mut session);

    let expected = OperationView::Rebase {
        branch: Some("remote".to_owned()),
        onto: Some(branch("local")),
        replaying: Some(commit(root, "remote~2")),
        progress: ONE_OF_THREE,
        editor_steps_ahead: false,
    };
    assert_eq!(list.operation, Some(expected));
    assert_eq!(list.files.len(), 1);
    assert_eq!(&list.sides, session.side_names());
    let Some(SideName::Commit { message, .. }) = &list.sides.local else {
        panic!("{:?}", list.sides);
    };
    assert_eq!(message, STEP_ONE_MESSAGE);
}

#[test]
fn a_stash_pop_lists_no_operation_and_has_nothing_to_abort_or_continue() {
    let (_dir, mut session) = opened(Run::StashPop, &FILES);

    assert_eq!(listed(&mut session).operation, None);
    assert!(matches!(session.abort_operation(), Err(Error::NoOperation)));
    assert!(matches!(
        session.continue_operation(),
        Err(Error::NoOperation)
    ));
}

// Abort and Continue name what git does while it runs; a kind read again later could be another stop's.
#[test]
fn the_operation_kind_is_the_one_read_at_open() {
    let (dir, rebase) = opened(Run::Rebase, &FILES);
    git_ok(dir.path(), &["rebase", "--abort"]).unwrap();
    let (_stash_dir, stash_pop) = opened(Run::StashPop, &FILES);

    assert_eq!(rebase.operation_kind(), Some(OperationKind::Rebase));
    assert_eq!(stash_pop.operation_kind(), None);
}

// An operation aborted outside is git's view, not a move: the list goes on, without the operation.
#[test]
fn a_rebase_aborted_in_a_terminal_lists_git_s_view_without_an_operation() {
    let (dir, mut session) = opened(Run::Rebase, &FILES);
    git_ok(dir.path(), &["rebase", "--abort"]).unwrap();

    let list = listed(&mut session);

    assert_eq!(list.operation, None);
    assert_eq!(list.files[0].status, FileStatus::Resolved);
}

fn commit_fields(root: &Path, revision: &str) -> (String, String, String) {
    let SideName::Commit {
        short_id,
        subject,
        message,
    } = commit(root, revision)
    else {
        panic!("not a commit");
    };
    (short_id, subject, message)
}

#[test]
fn each_operation_s_view_names_what_it_applies() {
    let cases: [(Run, ExpectedView); 6] = [
        (Run::Merge, |_| OperationView::Merge {
            merging: Some(branch("remote")),
            into: Some(branch("local")),
        }),
        (Run::SquashMerge, |_| OperationView::SquashMerge {
            merging: Some(branch("remote")),
            into: Some(branch("local")),
        }),
        (Run::CherryPick, |root| OperationView::CherryPick {
            picking: Some(commit(root, "remote~2")),
            progress: None,
        }),
        (Run::CherryPickRange, |root| OperationView::CherryPick {
            picking: Some(commit(root, "remote~2")),
            progress: ONE_OF_THREE,
        }),
        (Run::RevertRange, |root| {
            let (short_id, subject, message) = commit_fields(root, "HEAD~1");
            let reverting = SideName::Revert {
                short_id,
                subject,
                message,
            };
            OperationView::Revert {
                reverting: Some(reverting),
                progress: ONE_OF_THREE,
            }
        }),
        (Run::Am, |_| OperationView::Am {
            subject: "step 1".to_owned(),
            message: STEP_ONE_MESSAGE.to_owned(),
            progress: ONE_OF_THREE,
        }),
    ];
    for (run, expected) in cases {
        let (dir, mut session) = opened(run, &FILES);

        let operation = listed(&mut session).operation;

        assert_eq!(operation, Some(expected(dir.path())), "{run:?}");
    }
}

#[test]
fn a_sequence_continued_stops_at_step_two_then_finishes() {
    for (run, kind) in [
        (Run::Rebase, OperationKind::Rebase),
        (Run::CherryPickRange, OperationKind::CherryPick),
    ] {
        let (dir, mut session) = opened(run, &FILES);
        finished_every_file(&mut session);

        let stopped = session.continue_operation().unwrap();

        assert!(
            matches!(stopped, Continued::Stopped { .. }),
            "{run:?} {stopped:?}"
        );
        let mut next = MergeSession::open(dir.path()).unwrap();
        let files = next.files();
        assert_eq!(files.len(), 1, "{run:?}");
        assert_eq!(files[0].path, STEP_TWO_FILE, "{run:?}");
        finished_every_file(&mut next);
        let finished = next.continue_operation().unwrap();
        assert!(
            matches!(&finished, Continued::Finished { kind: found, .. } if *found == kind),
            "{run:?} {finished:?}"
        );
    }
}

#[test]
fn a_merge_continued_is_finished_as_a_merge() {
    let (dir, mut session) = opened(Run::Merge, &FILES);
    finished_every_file(&mut session);

    let finished = session.continue_operation().unwrap();

    assert!(
        matches!(
            finished,
            Continued::Finished {
                kind: OperationKind::Merge,
                ..
            }
        ),
        "{finished:?}"
    );
    let message = text(dir.path(), &["log", "-1", "--format=%s"]);
    assert_eq!(message.trim_end(), "Merge branch 'remote' into local");
}

#[test]
fn continuing_with_a_file_unmerged_is_git_refused_with_git_s_message() {
    let (dir, mut session) = opened(Run::Rebase, &FILES);
    let head = text(dir.path(), &["rev-parse", "HEAD"]);

    let refused = session.continue_operation();

    let Err(Error::GitRefused { message }) = refused else {
        panic!("{refused:?}");
    };
    assert!(message.contains(CART), "{message}");
    assert_eq!(text(dir.path(), &["rev-parse", "HEAD"]), head);
    assert_eq!(session.files()[0].status, FileStatus::Unresolved);
}

#[test]
fn abort_returns_the_operation_it_aborted_and_leaves_none() {
    let (_dir, mut session) = opened(Run::Rebase, &FILES);

    assert_eq!(session.abort_operation().unwrap(), OperationKind::Rebase);
    assert_eq!(listed(&mut session).operation, None);
}

// `LC_ALL=C` on Continue would show a hook's words in another language than the user's terminal does.
#[test]
fn a_hook_sees_the_user_s_locale() {
    let child = Command::new(std::env::current_exe().unwrap())
        .args(["--ignored", "--exact", LOCALE_HOOK_TEST])
        .env("LC_ALL", USER_LOCALE)
        .env("LANG", USER_LOCALE)
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&child.stdout);
    assert!(
        child.status.success() && stdout.contains("test result: ok. 1 passed"),
        "{stdout}{}",
        String::from_utf8_lossy(&child.stderr)
    );
}

#[test]
#[ignore = "run by a_hook_sees_the_user_s_locale"]
fn a_refusing_pre_commit_hook_seen_in_the_user_s_locale_is_git_refused() {
    let (dir, mut session) = opened(Run::Merge, &FILES);
    let root = dir.path();
    let script = format!("#!/bin/sh\necho \"{HOOK_LINE} LC_ALL=$LC_ALL LANG=$LANG\" >&2\nexit 1\n");
    install_hook(root, "pre-commit", &script).unwrap();
    finished_every_file(&mut session);
    let before = (
        text(root, &["rev-parse", "HEAD"]),
        text(root, &["ls-files", "-s"]),
        session.files(),
    );

    let refused = session.continue_operation();

    let Err(Error::GitRefused { message }) = refused else {
        panic!("{refused:?}");
    };
    let seen = format!("{HOOK_LINE} LC_ALL={USER_LOCALE} LANG={USER_LOCALE}");
    assert!(message.contains(&seen), "{message}");
    let after = (
        text(root, &["rev-parse", "HEAD"]),
        text(root, &["ls-files", "-s"]),
        session.files(),
    );
    assert_eq!(after, before);
}

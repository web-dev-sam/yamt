use std::path::Path;
use std::process::ExitCode;

use yamt_session::{MergeSession, OperationKind, Refreshed};

use crate::merge::{Merge, MergeState, lock_when_git_is_done};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Exit {
    Success = 0,
    Unresolved = 1,
    Failure = 2,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Ending {
    pub(crate) exit: Exit,
    pub(crate) message: Option<String>,
}

impl Ending {
    pub(crate) fn failure(message: String) -> Ending {
        Ending {
            exit: Exit::Failure,
            message: Some(message),
        }
    }

    pub(crate) fn report(self) -> ExitCode {
        if let Some(message) = self.message {
            eprintln!("yamt: {message}");
        }
        ExitCode::from(self.exit as u8)
    }
}

pub(crate) enum Startup {
    Merge(Box<MergeSession>),
    Done(Ending),
}

pub(crate) fn startup(repo: &Path) -> Startup {
    match MergeSession::open(repo) {
        Err(error) => Startup::Done(Ending::failure(error.to_string())),
        Ok(session) if session.files().is_empty() => Startup::Done(Ending {
            exit: Exit::Success,
            message: Some(format!("nothing to merge in {}", session.root().display())),
        }),
        Ok(session) => Startup::Merge(Box::new(session)),
    }
}

/// The ending when the window closes: once no worker runs git.
pub(crate) fn ending_when_git_is_done(state: &MergeState) -> Ending {
    ending_on_close(&mut lock_when_git_is_done(state))
}

/// The ending of a merge no worker runs git for; see `merge::lock_when_git_is_done`.
pub(crate) fn ending_on_close(merge: &mut Merge) -> Ending {
    match merge {
        Merge::Held(session) => held_merge_ending(session),
        Merge::MovedOn { root, .. } => moved_on_ending(root),
        Merge::Aborted(kind) => Ending {
            exit: Exit::Unresolved,
            message: Some(format!("{} aborted", operation_name(*kind))),
        },
        Merge::Finished(kind) => Ending {
            exit: Exit::Success,
            message: Some(format!("{} finished", operation_name(*kind))),
        },
        Merge::Running(kind) => Ending::failure(format!(
            "closed while git ran the {}",
            operation_name(*kind)
        )),
    }
}

fn operation_name(kind: OperationKind) -> &'static str {
    match kind {
        OperationKind::Merge => "merge",
        OperationKind::SquashMerge => "squash merge",
        OperationKind::Rebase => "rebase",
        OperationKind::CherryPick => "cherry-pick",
        OperationKind::Revert => "revert",
        OperationKind::Am => "patch application",
    }
}

/// git's view at close: the stop's list, or the stop git moved on to (plan §2 #41).
fn held_merge_ending(session: &mut MergeSession) -> Ending {
    match session.refresh_stop() {
        Ok(Refreshed::Files(_)) => unresolved_ending(session),
        Ok(Refreshed::MovedOn) => moved_on_ending(session.root()),
        Err(error) => {
            tracing::warn!(%error, "exit status from the session's statuses: git could not list the unmerged files");
            unresolved_ending(session)
        }
    }
}

/// The stop git moved on to, as git lists it: opened only to count, nothing settled or staged.
fn moved_on_ending(root: &Path) -> Ending {
    match MergeSession::open(root) {
        Ok(session) => unresolved_ending(&session),
        Err(error) => Ending::failure(error.to_string()),
    }
}

fn unresolved_ending(session: &MergeSession) -> Ending {
    let unresolved = session.remaining();
    if unresolved == 0 {
        return Ending {
            exit: Exit::Success,
            message: None,
        };
    }
    Ending {
        exit: Exit::Unresolved,
        message: Some(format!(
            "{unresolved} of {} files still unresolved",
            session.files().len()
        )),
    }
}

#[cfg(test)]
mod tests {
    use yamt_conflict_repo::{
        ConflictFile, FileKind, Run, STEP_TWO_FILE, TempDir, conflict_repo, git, git_ok,
        operation_repo,
    };
    use yamt_session::DiskVersion;

    use super::*;
    use crate::frontend_log::tests::logged;

    fn text_conflict(path: &str) -> ConflictFile<'_> {
        ConflictFile {
            path,
            kind: FileKind::Regular,
            base: Some(b"one\n"),
            local: Some(b"local\n"),
            remote: Some(b"remote\n"),
        }
    }

    fn ending(startup: Startup) -> Ending {
        match startup {
            Startup::Merge(session) => {
                panic!("expected an ending, got a merge in {:?}", session.root())
            }
            Startup::Done(ending) => ending,
        }
    }

    fn closed(mut merge: Merge) -> (Exit, String) {
        let ending = ending_on_close(&mut merge);
        (ending.exit, ending.message.unwrap_or_default())
    }

    #[test]
    fn a_finished_operation_ends_with_zero_and_an_aborted_one_with_one_each_named() {
        let finished = closed(Merge::Finished(OperationKind::Rebase));
        let aborted = closed(Merge::Aborted(OperationKind::Rebase));
        let merge_aborted = closed(Merge::Aborted(OperationKind::Merge));

        assert_eq!(finished, (Exit::Success, "rebase finished".to_owned()));
        assert_eq!(aborted, (Exit::Unresolved, "rebase aborted".to_owned()));
        assert_eq!(
            merge_aborted,
            (Exit::Unresolved, "merge aborted".to_owned())
        );
        let names = [
            OperationKind::SquashMerge,
            OperationKind::CherryPick,
            OperationKind::Revert,
            OperationKind::Am,
        ]
        .map(|kind| closed(Merge::Finished(kind)).1);
        let expected = [
            "squash merge finished",
            "cherry-pick finished",
            "revert finished",
            "patch application finished",
        ];
        assert_eq!(names, expected);
    }

    const STEP_ONE: ConflictFile<'static> = ConflictFile {
        path: STEP_TWO_FILE,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"local-1\n"),
        remote: Some(b"remote-1\n"),
    };

    /// Continues the rebase in a terminal to step 2 and edits its file by hand; git's unmerged list then.
    fn continued_in_a_terminal(root: &Path) -> Vec<u8> {
        std::fs::write(root.join(STEP_TWO_FILE), "resolved\n").unwrap();
        git_ok(root, &["add", "--", STEP_TWO_FILE]).unwrap();
        let continued = git(root, &["rebase", "--continue"]).unwrap();
        assert!(!continued.status.success());
        std::fs::write(root.join(STEP_TWO_FILE), "edited by hand\n").unwrap();
        git_ok(root, &["ls-files", "-u"]).unwrap()
    }

    // Settling the old stop's files at close would stage a file the user never saw at the new stop.
    #[test]
    fn closing_after_a_move_counts_the_new_stop_s_unmerged_files_and_stages_nothing() {
        let repo = operation_repo(Run::Rebase, &[STEP_ONE]).unwrap();
        let root = repo.path();
        let unmerged = continued_in_a_terminal(root);

        let ending = closed(Merge::MovedOn {
            root: root.to_path_buf(),
            highest_disk_version: DiskVersion(0),
        });

        assert_eq!(
            ending,
            (Exit::Unresolved, "1 of 1 files still unresolved".to_owned())
        );
        assert_eq!(git_ok(root, &["ls-files", "-u"]).unwrap(), unmerged);
    }

    #[test]
    fn closing_a_session_git_moved_on_from_counts_the_new_stop_s_files_and_stages_nothing() {
        let repo = operation_repo(Run::Rebase, &[STEP_ONE]).unwrap();
        let root = repo.path();
        let mut session = MergeSession::open(root).unwrap();
        let unmerged = continued_in_a_terminal(root);

        let ending = held_merge_ending(&mut session);

        assert_eq!(
            ending.message.as_deref(),
            Some("1 of 1 files still unresolved")
        );
        assert_eq!(git_ok(root, &["ls-files", "-u"]).unwrap(), unmerged);
    }

    #[test]
    fn conflict_repository_opens_a_merge_of_its_files() {
        let repo = conflict_repo(&[
            text_conflict("a.ts"),
            text_conflict("b.ts"),
            text_conflict("c.ts"),
        ])
        .unwrap();
        let inside = repo.path().join("inside");
        std::fs::create_dir(&inside).unwrap();
        let Startup::Merge(session) = startup(&inside) else {
            panic!("expected a merge");
        };
        assert_eq!(
            std::fs::canonicalize(session.root()).unwrap(),
            std::fs::canonicalize(repo.path()).unwrap()
        );
        let paths: Vec<String> = session.files().into_iter().map(|file| file.path).collect();
        assert_eq!(paths, ["a.ts", "b.ts", "c.ts"]);
    }

    #[test]
    fn repository_without_conflicts_has_nothing_to_merge() {
        let dir = TempDir::new().unwrap();
        git_ok(dir.path(), &["init", "--quiet"]).unwrap();
        let ending = ending(startup(dir.path()));
        assert_eq!(ending.exit, Exit::Success);
        let message = ending.message.unwrap();
        let Some(named) = message.strip_prefix("nothing to merge in ") else {
            panic!("{message}");
        };
        assert_eq!(
            std::fs::canonicalize(named).unwrap(),
            std::fs::canonicalize(dir.path()).unwrap()
        );
    }

    #[test]
    fn plain_directory_fails_with_status_two() {
        let dir = TempDir::new().unwrap();
        let ending = ending(startup(dir.path()));
        assert_eq!(ending.exit, Exit::Failure);
        assert_eq!(Exit::Failure as u8, 2);
        let message = ending.message.unwrap();
        assert!(message.contains("not a git repository"), "{message}");
    }

    #[test]
    fn closing_reports_the_unresolved_files_until_all_are_finished() {
        let repo = conflict_repo(&[text_conflict("a.ts"), text_conflict("b.ts")]).unwrap();
        let mut session = MergeSession::open(repo.path()).unwrap();
        assert_eq!(
            held_merge_ending(&mut session),
            Ending {
                exit: Exit::Unresolved,
                message: Some("2 of 2 files still unresolved".to_owned()),
            }
        );
        session.finish("a.ts", "done\n", DiskVersion(0)).unwrap();
        assert_eq!(
            held_merge_ending(&mut session).message.as_deref(),
            Some("1 of 2 files still unresolved")
        );
        session.finish("b.ts", "done\n", DiskVersion(0)).unwrap();
        assert_eq!(
            held_merge_ending(&mut session),
            Ending {
                exit: Exit::Success,
                message: None,
            }
        );
        assert_eq!((Exit::Success as u8, Exit::Unresolved as u8), (0, 1));
    }

    #[test]
    fn closing_counts_the_files_git_still_has_unmerged() {
        let repo = conflict_repo(&[text_conflict("a.ts"), text_conflict("b.ts")]).unwrap();
        let mut session = MergeSession::open(repo.path()).unwrap();
        git_ok(repo.path(), &["add", "a.ts"]).unwrap();
        assert_eq!(
            held_merge_ending(&mut session),
            Ending {
                exit: Exit::Unresolved,
                message: Some("1 of 2 files still unresolved".to_owned()),
            }
        );
        git_ok(repo.path(), &["add", "b.ts"]).unwrap();
        assert_eq!(held_merge_ending(&mut session).exit, Exit::Success);
        git_ok(repo.path(), &["checkout", "-m", "b.ts"]).unwrap();
        assert_eq!(held_merge_ending(&mut session).exit, Exit::Unresolved);
    }

    #[test]
    fn closing_stages_a_file_regenerated_on_disk_and_keeps_one_with_markers_unresolved() {
        let repo = conflict_repo(&[text_conflict("a.ts"), text_conflict("b.ts")]).unwrap();
        let mut session = MergeSession::open(repo.path()).unwrap();
        std::fs::write(repo.path().join("a.ts"), "regenerated\n").unwrap();
        let with_markers = "<<<<<<< ours\nlocal\n=======\nremote, edited\n>>>>>>> theirs\n";
        std::fs::write(repo.path().join("b.ts"), with_markers).unwrap();

        let ending = held_merge_ending(&mut session);

        assert_eq!(
            ending.message.as_deref(),
            Some("1 of 2 files still unresolved")
        );
        let unmerged = git_ok(repo.path(), &["ls-files", "-u"]).unwrap();
        let unmerged = String::from_utf8(unmerged).unwrap();
        assert!(
            !unmerged.contains("a.ts") && unmerged.contains("b.ts"),
            "{unmerged}"
        );
    }

    #[test]
    fn closing_with_a_broken_index_uses_the_session_statuses_and_warns() {
        let repo = conflict_repo(&[text_conflict("a.ts"), text_conflict("b.ts")]).unwrap();
        let mut session = MergeSession::open(repo.path()).unwrap();
        session.finish("a.ts", "done\n", DiskVersion(0)).unwrap();
        std::fs::write(repo.path().join(".git/index"), "not an index").unwrap();

        let (ending, logged) = logged(|| held_merge_ending(&mut session));

        assert_eq!(
            ending.message.as_deref(),
            Some("1 of 2 files still unresolved")
        );
        assert!(
            logged.contains("WARN") && logged.contains("git could not list the unmerged files"),
            "{logged}"
        );
    }
}

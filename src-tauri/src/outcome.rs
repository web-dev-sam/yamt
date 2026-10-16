use std::path::Path;
use std::process::ExitCode;

use yamt_session::MergeSession;

use crate::merge::Merge;

const MERGE_ABORTED: &str = "merge aborted";

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
    Merge(MergeSession),
    Done(Ending),
}

pub(crate) fn startup(repo: &Path) -> Startup {
    match MergeSession::open(repo) {
        Err(error) => Startup::Done(Ending::failure(error.to_string())),
        Ok(session) if session.files().is_empty() => Startup::Done(Ending {
            exit: Exit::Success,
            message: Some(format!("nothing to merge in {}", session.root().display())),
        }),
        Ok(session) => Startup::Merge(session),
    }
}

pub(crate) fn ending_on_close(merge: &mut Merge) -> Ending {
    match merge {
        Merge::Held(session) => held_merge_ending(session),
        Merge::Aborted => Ending {
            exit: Exit::Unresolved,
            message: Some(MERGE_ABORTED.to_owned()),
        },
    }
}

fn held_merge_ending(session: &mut MergeSession) -> Ending {
    if let Err(error) = session.refresh() {
        tracing::warn!(%error, "exit status from the session's statuses: git could not list the unmerged files");
    }
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
    use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};
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

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use yamt_gitio::Repo;
use yamt_session::MergeSession;

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
    Merge {
        root: PathBuf,
        session: MergeSession,
    },
    Done(Ending),
}

pub(crate) fn startup(repo: &Path) -> Startup {
    match open(repo) {
        Err(error) => Startup::Done(Ending::failure(error.to_string())),
        Ok((root, session)) if session.files().is_empty() => Startup::Done(Ending {
            exit: Exit::Success,
            message: Some(format!("nothing to merge in {}", root.display())),
        }),
        Ok((root, session)) => Startup::Merge { root, session },
    }
}

fn open(repo: &Path) -> yamt_session::Result<(PathBuf, MergeSession)> {
    let root = Repo::discover(repo)?.root().to_owned();
    let session = MergeSession::open(&root)?;
    Ok((root, session))
}

pub(crate) fn ending_on_close(session: &MergeSession) -> Ending {
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

    use super::*;

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
            Startup::Merge { root, .. } => panic!("expected an ending, got a merge in {root:?}"),
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
        let Startup::Merge { root, session } = startup(&inside) else {
            panic!("expected a merge");
        };
        assert_eq!(root, repo.path().canonicalize().unwrap());
        let paths: Vec<String> = session.files().into_iter().map(|file| file.path).collect();
        assert_eq!(paths, ["a.ts", "b.ts", "c.ts"]);
    }

    #[test]
    fn repository_without_conflicts_has_nothing_to_merge() {
        let dir = TempDir::new().unwrap();
        git_ok(dir.path(), &["init", "--quiet"]).unwrap();
        let root = dir.path().canonicalize().unwrap();
        assert_eq!(
            ending(startup(dir.path())),
            Ending {
                exit: Exit::Success,
                message: Some(format!("nothing to merge in {}", root.display())),
            }
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
            ending_on_close(&session),
            Ending {
                exit: Exit::Unresolved,
                message: Some("2 of 2 files still unresolved".to_owned()),
            }
        );
        session.finish("a.ts", "done\n").unwrap();
        assert_eq!(
            ending_on_close(&session).message.as_deref(),
            Some("1 of 2 files still unresolved")
        );
        session.finish("b.ts", "done\n").unwrap();
        assert_eq!(
            ending_on_close(&session),
            Ending {
                exit: Exit::Success,
                message: None,
            }
        );
        assert_eq!((Exit::Success as u8, Exit::Unresolved as u8), (0, 1));
    }
}

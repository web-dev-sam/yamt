#![cfg(test)]

use yamt_session::{MergeSession, SideContent, UnsupportedReason};

mod every_kind;
use every_kind::{
    BINARY, LATIN1, LOCAL_COMMIT, LOCAL_DELETED, REMOTE_COMMIT, REMOTE_DELETED, SUBMODULE, TEXT,
    every_kind_of_conflict,
};
#[cfg(unix)]
use every_kind::{FILE_OR_LINK, FILE_OR_LINK_RENAMED, SYMLINK, file_against_link};

fn described_sides(session: &mut MergeSession, path: &str) -> (SideContent, SideContent) {
    let sides = session.describe(path).unwrap();
    assert_eq!(sides.path, path);
    (sides.local, sides.remote)
}

#[test]
fn describe_counts_the_lines_of_text_sides_and_names_a_deleted_side_missing() {
    use SideContent::{Missing, Text};
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let mut described = |path| described_sides(&mut session, path);
    assert_eq!(described(TEXT), (Text { lines: 3 }, Text { lines: 4 }));
    assert_eq!(described(LOCAL_DELETED), (Missing, Text { lines: 2 }));
    assert_eq!(described(REMOTE_DELETED), (Text { lines: 3 }, Missing));
}

#[test]
fn describe_gives_sizes_of_unreadable_sides_link_targets_and_commit_ids() {
    use SideContent::{Binary, Commit, NonUtf8};
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let mut described = |path| described_sides(&mut session, path);
    let commit = |id: &str| Commit { id: id.to_owned() };
    assert_eq!(
        described(BINARY),
        (Binary { bytes: 6 }, Binary { bytes: 8 })
    );
    assert_eq!(
        described(LATIN1),
        (NonUtf8 { bytes: 6 }, NonUtf8 { bytes: 12 })
    );
    #[cfg(unix)]
    assert_eq!(
        described(SYMLINK),
        (
            SideContent::Link {
                target: "local-target".to_owned()
            },
            SideContent::Link {
                target: "remote-target".to_owned()
            }
        )
    );
    assert_eq!(
        described(SUBMODULE),
        (commit(LOCAL_COMMIT), commit(REMOTE_COMMIT))
    );
}

#[test]
fn describe_reports_the_file_reason_and_none_for_a_text_file() {
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let reasons = [
        (TEXT, None),
        (LOCAL_DELETED, None),
        (REMOTE_DELETED, None),
        (BINARY, Some(UnsupportedReason::Binary)),
        (LATIN1, Some(UnsupportedReason::NonUtf8)),
        #[cfg(unix)]
        (SYMLINK, Some(UnsupportedReason::Symlink)),
        (SUBMODULE, Some(UnsupportedReason::Submodule)),
    ];
    for (path, reason) in reasons {
        assert_eq!(session.describe(path).unwrap().reason, reason, "{path}");
    }
}

#[cfg(unix)]
#[test]
fn describe_a_file_against_a_link_shows_the_file_and_the_link_target() {
    use SideContent::{Link, Missing, Text};
    let dir = file_against_link();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let link = Link {
        target: "docs/README.md".to_owned(),
    };

    assert_eq!(described_sides(&mut session, FILE_OR_LINK), (Missing, link));
    let renamed = described_sides(&mut session, FILE_OR_LINK_RENAMED);
    assert_eq!(renamed, (Text { lines: 2 }, Missing));
    let reason = session.describe(FILE_OR_LINK).unwrap().reason;
    assert_eq!(reason, Some(UnsupportedReason::Symlink));
}

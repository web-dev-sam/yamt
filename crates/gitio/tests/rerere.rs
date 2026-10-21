#![cfg(test)]

use std::path::PathBuf;

use yamt_conflict_repo::{ConflictFile, FileKind, Remembered, Replay, conflict_repo, rerere_repo};
use yamt_gitio::Repo;

const REPLAYED: &str = "replayed.txt";
const FRESH: &str = "fresh.txt";

// rerere identifies a conflict by its text, not its path: each file needs its own sides.
fn conflict(
    path: &'static str,
    local: &'static [u8],
    remote: &'static [u8],
) -> ConflictFile<'static> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(local),
        remote: Some(remote),
    }
}

// Catches a replayed path read as one rerere still tracks, which would open it as a normal conflict
// and stage rerere's text at the first list.
#[test]
fn rerere_tracked_lists_a_path_rerere_recorded_a_preimage_for_and_omits_one_it_replayed() {
    let remembered = [Remembered {
        file: conflict(REPLAYED, b"local\n", b"remote\n"),
        resolution: b"resolved\n",
    }];
    let fresh = conflict(FRESH, b"mine\n", b"theirs\n");
    let dir = rerere_repo(&remembered, &[fresh], Replay::Review).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();

    assert_eq!(
        repo.rerere_tracked().unwrap(),
        Some(vec![PathBuf::from(FRESH)])
    );
}

// Catches rerere switched off read as "rerere tracks nothing", which would take every hand fix
// for a replayed resolution.
#[test]
fn rerere_tracked_is_none_when_rerere_is_off() {
    let dir = conflict_repo(&[conflict(FRESH, b"local\n", b"remote\n")]).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();

    assert_eq!(repo.rerere_tracked().unwrap(), None);
}

#![cfg(test)]

use std::path::PathBuf;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Remembered, Replay, conflict_repo, git_ok, rerere_repo,
    run_ignored_in_child,
};
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

fn switched_off_repo() -> yamt_conflict_repo::TempDir {
    let remembered = [Remembered {
        file: conflict(REPLAYED, b"local\n", b"remote\n"),
        resolution: b"resolved\n",
    }];
    let fresh = conflict(FRESH, b"mine\n", b"theirs\n");
    rerere_repo(&remembered, &[fresh], Replay::Off).unwrap()
}

// Catches the empty `MERGE_RR` a commit made with rerere on leaves behind, read once rerere is off as
// "rerere replayed every path".
#[test]
fn rerere_tracked_is_none_when_rerere_was_switched_off_after_a_committed_rerere_merge() {
    let dir = switched_off_repo();
    let repo = Repo::discover(dir.path()).unwrap();

    assert!(dir.path().join(".git/MERGE_RR").is_file());
    assert_eq!(repo.rerere_tracked().unwrap(), None);
}

const UNSET_IN_CHILD: [&str; 1] =
    ["with_rerere_enabled_unset_rerere_tracked_reads_merge_rr_only_while_rr_cache_exists"];

// Without the user's and the system's config, so that `rerere.enabled` is unset for yamt's git too.
#[test]
fn rerere_enabled_unset_without_user_config() {
    let ran = run_ignored_in_child(&UNSET_IN_CHILD, |child| {
        child
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1");
    });

    ran.unwrap_or_else(|error| panic!("{error}"));
}

// Catches `rerere.enabled` unset read as off, or as on without `rr-cache` (rerere.c
// `is_rerere_enabled`).
#[test]
#[ignore = "run by rerere_enabled_unset_without_user_config"]
fn with_rerere_enabled_unset_rerere_tracked_reads_merge_rr_only_while_rr_cache_exists() {
    let dir = switched_off_repo();
    git_ok(dir.path(), &["config", "--unset", "rerere.enabled"]).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();

    assert_eq!(repo.rerere_tracked().unwrap(), Some(Vec::new()));
    std::fs::remove_dir_all(dir.path().join(".git/rr-cache")).unwrap();
    assert_eq!(repo.rerere_tracked().unwrap(), None);
}

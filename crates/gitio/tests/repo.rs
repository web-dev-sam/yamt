#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, TempDir, conflict_repo, git_ok, hash_object};
use yamt_gitio::{Error, Oid, Repo, Stage, StageEntry};

const FILE: &str = "cart.ts";
const BASE: &[u8] = b"one\ntwo\nthree\n";
const LOCAL: &[u8] = b"one\nlocal\nthree\n";
const REMOTE: &[u8] = b"one\nremote\nthree\n";
const REGULAR_FILE_MODE: u32 = 0o100_644;

fn stages_of(entries: &[StageEntry]) -> Vec<Stage> {
    entries.iter().map(|entry| entry.stage).collect()
}

fn one_file_repo(
    path: &str,
    base: Option<&[u8]>,
    local: Option<&[u8]>,
    remote: Option<&[u8]>,
) -> TempDir {
    let file = ConflictFile {
        path,
        base,
        local,
        remote,
    };
    conflict_repo(&[file]).unwrap()
}

#[test]
fn modify_modify_conflict_lists_three_stages_with_hashed_oids() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();

    let entries = repo.unmerged().unwrap();

    let expected_stages = [Stage::Base, Stage::Local, Stage::Remote];
    assert_eq!(stages_of(&entries), expected_stages);
    for (entry, text) in entries.iter().zip([BASE, LOCAL, REMOTE]) {
        assert_eq!(entry.path, Path::new(FILE));
        assert_eq!(entry.mode, REGULAR_FILE_MODE);
        assert_eq!(entry.oid.as_str(), hash_object(dir.path(), text).unwrap());
    }
}

#[test]
fn add_add_conflict_has_only_local_and_remote_stages() {
    let dir = one_file_repo(FILE, None, Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();

    let entries = repo.unmerged().unwrap();

    assert_eq!(stages_of(&entries), [Stage::Local, Stage::Remote]);
}

#[test]
fn delete_modify_conflict_has_base_and_the_modifying_side() {
    let dir = one_file_repo(FILE, Some(BASE), None, Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();

    let entries = repo.unmerged().unwrap();

    assert_eq!(stages_of(&entries), [Stage::Base, Stage::Remote]);
}

#[test]
fn crlf_blobs_without_final_newline_read_back_byte_for_byte() {
    let sides: [&[u8]; 3] = [b"a\r\nb\r\nc", b"a\r\nlocal\r\nc", b"a\r\nremote\r\nc"];
    let dir = one_file_repo(FILE, Some(sides[0]), Some(sides[1]), Some(sides[2]));
    let repo = Repo::discover(dir.path()).unwrap();
    let mut reader = repo.blob_reader().unwrap();

    for (entry, text) in repo.unmerged().unwrap().iter().zip(sides) {
        assert_eq!(reader.read(&entry.oid).unwrap(), text);
    }
}

#[test]
fn one_reader_serves_many_reads_and_survives_missing_and_non_blob_oids() {
    const ROUNDS: usize = 3;
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let entries = repo.unmerged().unwrap();
    let mut reader = repo.blob_reader().unwrap();

    for _ in 0..ROUNDS {
        for (entry, text) in entries.iter().zip([BASE, LOCAL, REMOTE]) {
            assert_eq!(reader.read(&entry.oid).unwrap(), text);
        }
    }
    let missing = Oid::parse(&"ab".repeat(20)).unwrap();
    let error = reader.read(&missing).unwrap_err();
    assert!(matches!(error, Error::BlobMissing { oid } if oid == missing));
    assert_eq!(reader.read(&entries[0].oid).unwrap(), BASE);
    let head = String::from_utf8(git_ok(dir.path(), &["rev-parse", "HEAD"]).unwrap()).unwrap();
    let commit = Oid::parse(head.trim_end()).unwrap();
    let error = reader.read(&commit).unwrap_err();
    assert!(
        matches!(
            error,
            Error::UnexpectedOutput {
                command: "cat-file",
                ..
            }
        ),
        "{error:?}"
    );
    assert_eq!(reader.read(&entries[0].oid).unwrap(), BASE);
}

fn assert_add_then_restore_round_trips(base: Option<&[u8]>, path: &str) {
    let dir = one_file_repo(path, base, Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let captured = repo.unmerged().unwrap();
    assert!(captured.iter().all(|entry| entry.path == Path::new(path)));

    repo.add(Path::new(path)).unwrap();
    assert_eq!(repo.unmerged().unwrap(), []);
    repo.restore_stages(&captured).unwrap();

    assert_eq!(repo.unmerged().unwrap(), captured);
}

#[test]
fn restore_stages_after_add_brings_back_modify_modify_stages() {
    assert_add_then_restore_round_trips(Some(BASE), FILE);
}

#[test]
fn restore_stages_after_add_brings_back_add_add_stages() {
    assert_add_then_restore_round_trips(None, FILE);
}

#[test]
fn path_with_space_and_non_ascii_round_trips_through_restore() {
    assert_add_then_restore_round_trips(Some(BASE), "dir with space/ünïcødé cart.ts");
}

#[test]
fn restore_stages_replaces_every_existing_stage_of_the_path() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let without_base: Vec<StageEntry> = repo.unmerged().unwrap().into_iter().skip(1).collect();

    repo.restore_stages(&without_base).unwrap();

    assert_eq!(repo.unmerged().unwrap(), without_base);
}

#[test]
fn checkout_merge_after_restore_rewrites_conflict_markers() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let captured = repo.unmerged().unwrap();
    repo.add(Path::new(FILE)).unwrap();
    repo.restore_stages(&captured).unwrap();
    fs::write(dir.path().join(FILE), "resolved\n").unwrap();

    repo.checkout_merge(Path::new(FILE)).unwrap();

    let worktree = fs::read_to_string(dir.path().join(FILE)).unwrap();
    assert!(worktree.contains("<<<<<<<"), "no markers in {worktree:?}");
}

#[test]
fn failing_git_call_reports_argv_status_and_stderr() {
    const NO_SUCH_FILE: &str = "no-such-file.txt";
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();

    let error = repo.checkout_merge(Path::new(NO_SUCH_FILE)).unwrap_err();

    let Error::GitFailed {
        args,
        status,
        stderr,
    } = error
    else {
        panic!("expected GitFailed, got {error:?}");
    };
    assert!(args.contains(&"checkout".to_owned()));
    assert!(args.contains(&NO_SUCH_FILE.to_owned()));
    assert!(status.is_some_and(|code| code != 0));
    assert_ne!(stderr, "");
}

#[test]
fn discover_from_a_subdirectory_returns_the_top_level() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let nested = dir.path().join("nested/deeper");
    fs::create_dir_all(&nested).unwrap();

    let repo = Repo::discover(&nested).unwrap();

    assert_eq!(repo.root(), dir.path().canonicalize().unwrap());
}

#[test]
fn discover_outside_any_repo_is_git_failed() {
    let dir = tempfile::tempdir().unwrap();

    let error = Repo::discover(dir.path()).err().unwrap();

    assert!(matches!(error, Error::GitFailed { .. }), "{error:?}");
}

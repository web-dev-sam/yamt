#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok, hash_object};
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
        kind: FileKind::Regular,
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

fn staged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-s"]).unwrap()).unwrap()
}

#[test]
fn resolve_with_replaces_every_stage_by_one_stage_zero_entry_of_the_chosen_side() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let remote = repo.unmerged().unwrap().remove(2);

    repo.resolve_with(&remote).unwrap();

    assert_eq!(repo.unmerged().unwrap(), []);
    let oid = remote.oid.as_str();
    assert_eq!(
        staged(&dir),
        format!("{REGULAR_FILE_MODE:o} {oid} 0\t{FILE}\n")
    );
    require_conflict_markers(&dir);
}

fn worktree(dir: &TempDir) -> Vec<u8> {
    fs::read(dir.path().join(FILE)).unwrap()
}

fn require_conflict_markers(dir: &TempDir) {
    let worktree = worktree(dir);
    assert!(worktree.starts_with(b"one\n<<<<<<<"), "{worktree:?}");
}

#[test]
fn remove_from_index_drops_every_stage_and_leaves_the_worktree_file() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    require_conflict_markers(&dir);
    let before = worktree(&dir);

    repo.remove_from_index(Path::new(FILE)).unwrap();

    assert_eq!(staged(&dir), "");
    assert_eq!(worktree(&dir), before);
}

#[test]
fn restore_index_records_puts_back_the_stage_zero_entry_read_before() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let entries = repo.unmerged().unwrap();
    let (local, remote) = (&entries[1], &entries[2]);
    repo.resolve_with(local).unwrap();
    let records = repo.index_records(Path::new(FILE)).unwrap();
    let oid = local.oid.as_str();
    let record = format!("{REGULAR_FILE_MODE:o} {oid} 0\t{FILE}");
    assert_eq!(records, format!("{record}\0").into_bytes());
    repo.resolve_with(remote).unwrap();

    repo.restore_index_records(Path::new(FILE), records)
        .unwrap();

    assert_eq!(staged(&dir), format!("{record}\n"));
}

#[test]
fn restore_index_records_without_records_removes_the_path_again() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let remote = repo.unmerged().unwrap().remove(2);
    repo.remove_from_index(Path::new(FILE)).unwrap();
    let records = repo.index_records(Path::new(FILE)).unwrap();
    assert_eq!(records, b"");
    repo.resolve_with(&remote).unwrap();

    repo.restore_index_records(Path::new(FILE), records)
        .unwrap();

    assert_eq!(staged(&dir), "");
}

#[test]
fn index_records_of_a_conflicted_path_list_every_stage() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();

    let records = repo.index_records(Path::new(FILE)).unwrap();

    let listed = String::from_utf8(records).unwrap().replace('\0', "\n");
    assert_eq!(listed, staged(&dir));
    assert_eq!(listed.lines().count(), 3);
}

#[test]
fn checkout_from_index_overwrites_the_worktree_with_the_stage_zero_blob() {
    let dir = one_file_repo(FILE, Some(BASE), Some(LOCAL), Some(REMOTE));
    let repo = Repo::discover(dir.path()).unwrap();
    let local = repo.unmerged().unwrap().remove(1);
    repo.resolve_with(&local).unwrap();

    repo.checkout_from_index(Path::new(FILE)).unwrap();

    assert_eq!(fs::read(dir.path().join(FILE)).unwrap(), LOCAL);
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

#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_merge_core::{MAX_TEXT_BYTES, compare};
use yamt_range::{
    Error, PairLock, Range, RangeChange, RangeEntryKind, RangeFile, RangeFileId, RangeModeChange,
    RangeSide, RangeSideLabel, RangeSides, RangeSpec, Resolved,
};

const FIRST_COMMIT: &str = "1111111111111111111111111111111111111111";
const SECOND_COMMIT: &str = "2222222222222222222222222222222222222222";
const LINK_MODE: &str = "120000";
const LOCK_FILE: &str = "lock";

/// A file of the scripted repository: `base` on `main`, `local` on the checked-out branch `local`, `remote` on `remote`.
fn file<'a>(
    path: &'a str,
    base: Option<&'a [u8]>,
    local: Option<&'a [u8]>,
    remote: Option<&'a [u8]>,
) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote,
    }
}

/// A file only `local` changes.
fn changed<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    file(path, base, local, base)
}

fn repo_with(files: &[ConflictFile]) -> TempDir {
    diverged_repo(files).unwrap()
}

fn rev_parse(root: &Path, revision: &str) -> String {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn short_id(root: &Path, revision: &str) -> String {
    let output = git_ok(root, &["log", "-1", "--format=%h", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn resolved(root: &Path, text: &str) -> Resolved {
    Resolved::resolve(root, &RangeSpec::parse(text).unwrap()).unwrap()
}

fn range(root: &Path, text: &str) -> Range {
    resolved(root, text).list().unwrap()
}

fn refusal(root: &Path, text: &str) -> Error {
    match Resolved::resolve(root, &RangeSpec::parse(text).unwrap()) {
        Ok(_) => panic!("{text} resolved"),
        Err(error) => error,
    }
}

fn paths(range: &Range) -> Vec<String> {
    range
        .start()
        .files
        .into_iter()
        .map(|entry| entry.path)
        .collect()
}

fn load(range: &Range, path: &str) -> RangeFile {
    let start = range.start();
    let entry = start.files.iter().find(|entry| entry.path == path).unwrap();
    range.load(entry.id).unwrap()
}

fn texts(left: &str, right: &str, mode: RangeModeChange) -> RangeFile {
    RangeFile::Texts {
        left: left.to_owned(),
        right: right.to_owned(),
        differences: compare(left, right),
        mode,
    }
}

fn named(name: &str) -> RangeSideLabel {
    RangeSideLabel::Named {
        name: name.to_owned(),
    }
}

fn side(root: &Path, label: RangeSideLabel, revision: &str, subject: &str) -> RangeSide {
    RangeSide {
        label,
        short_id: short_id(root, revision),
        subject: subject.to_owned(),
    }
}

fn commit(root: &Path, message: &str) {
    git_ok(root, &["commit", "--quiet", "-m", message]).unwrap();
}

fn write_and_add(root: &Path, path: &str, text: &str) {
    fs::write(root.join(path), text).unwrap();
    git_ok(root, &["add", "--", path]).unwrap();
}

/// Stages `path` as a symbolic link to `target` without making one on disk (Windows needs a right for that).
fn stage_link(root: &Path, path: &str, target: &str) {
    let scratch = root.join(".git").join("link-target");
    fs::write(&scratch, target).unwrap();
    let scratch_arg = scratch.to_str().unwrap();
    let output = git_ok(root, &["hash-object", "-w", "--", scratch_arg]).unwrap();
    let oid = String::from_utf8(output).unwrap().trim_end().to_owned();
    let cacheinfo = format!("{LINK_MODE},{oid},{path}");
    git_ok(root, &["update-index", "--add", "--cacheinfo", &cacheinfo]).unwrap();
}

/// Removes a loose object, so any read of it fails: what the listing answers is never read.
fn drop_object(root: &Path, revision: &str) {
    let oid = rev_parse(root, revision);
    let (folder, name) = oid.split_at(2);
    fs::remove_file(root.join(".git").join("objects").join(folder).join(name)).unwrap();
}

#[test]
fn three_dots_compares_the_merge_base_and_two_dots_the_tips() {
    let dir = repo_with(&[
        file("a.txt", Some(b"a\n"), Some(b"a local\n"), Some(b"a\n")),
        file("b.txt", Some(b"b\n"), Some(b"b\n"), Some(b"b remote\n")),
    ]);
    let root = dir.path();

    let three = range(root, "remote...local");
    let two = range(root, "remote..local");

    assert_eq!(paths(&three), ["a.txt"]);
    let base_label = RangeSideLabel::MergeBase {
        left: "remote".to_owned(),
        right: "local".to_owned(),
    };
    let start = three.start();
    assert_eq!(start.range, "remote...local");
    assert_eq!(start.left, side(root, base_label, "main", "base"));
    assert_eq!(start.right, side(root, named("local"), "local", "local"));

    assert_eq!(paths(&two), ["a.txt", "b.txt"]);
    let start = two.start();
    assert_eq!(start.range, "remote..local");
    assert_eq!(start.left, side(root, named("remote"), "remote", "remote"));
    assert_eq!(start.right, side(root, named("local"), "local", "local"));
}

#[test]
fn a_criss_cross_range_lists_what_git_diff_three_dots_lists() {
    let dir = repo_with(&[changed("f.txt", Some(b"f\n"), Some(b"f\n"))]);
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "-b", "x", "main"]).unwrap();
    write_and_add(root, "x.txt", "x1\n");
    commit(root, "x1");
    let x1 = rev_parse(root, "HEAD");
    git_ok(root, &["checkout", "--quiet", "-b", "y", "main"]).unwrap();
    write_and_add(root, "y.txt", "y1\n");
    commit(root, "y1");
    let y1 = rev_parse(root, "HEAD");
    git_ok(root, &["merge", "--quiet", "--no-edit", &x1]).unwrap();
    write_and_add(root, "y.txt", "y2\n");
    write_and_add(root, "w.txt", "from y\n");
    commit(root, "y2");
    git_ok(root, &["checkout", "--quiet", "x"]).unwrap();
    git_ok(root, &["merge", "--quiet", "--no-edit", &y1]).unwrap();
    write_and_add(root, "x.txt", "x2\n");
    write_and_add(root, "f.txt", "f from x\n");
    commit(root, "x2");
    let bases = git_ok(root, &["merge-base", "--all", "x", "y"]).unwrap();
    assert_eq!(String::from_utf8(bases).unwrap().lines().count(), 2);

    let listed = paths(&range(root, "x...y"));

    let output = git_ok(root, &["diff", "--name-only", "x...y"]).unwrap();
    let mut by_git: Vec<String> = String::from_utf8(output)
        .unwrap()
        .lines()
        .map(str::to_owned)
        .collect();
    by_git.sort();
    assert_eq!(listed, by_git);
    assert_ne!(listed.len(), 0);
}

#[test]
fn an_empty_side_is_head() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"b\n"))]);
    let root = dir.path();

    let to_head = range(root, "main..");
    let nothing = range(root, "..");

    assert_eq!(paths(&to_head), paths(&range(root, "main..local")));
    assert_eq!(paths(&to_head), ["a.txt"]);
    assert_eq!(
        to_head.start().right,
        side(root, named("HEAD"), "local", "local")
    );
    assert_eq!(paths(&nothing), Vec::<String>::new());
    assert_eq!(
        nothing.start().left,
        side(root, named("HEAD"), "local", "local")
    );
}

#[test]
fn unknown_name_not_a_repository_and_no_merge_base_are_their_errors() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"b\n"))]);
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "--orphan", "unrelated"]).unwrap();
    commit(root, "unrelated");
    let outside = tempfile::tempdir().unwrap();

    let unknown_left = refusal(root, "nope..main");
    let unknown_right = refusal(root, "main...nope");
    let no_base = refusal(root, "main...unrelated");
    let not_a_repository = refusal(outside.path(), "main..dev");

    assert!(matches!(&unknown_left, Error::UnknownName { name } if name == "nope"));
    assert_eq!(unknown_left.to_string(), "git names no commit \"nope\"");
    assert!(matches!(&unknown_right, Error::UnknownName { name } if name == "nope"));
    assert!(
        matches!(&no_base, Error::NoMergeBase { left, right } if left == "main" && right == "unrelated")
    );
    assert_eq!(no_base.to_string(), "main and unrelated have no merge base");
    let Error::NotARepository { path, message } = &not_a_repository else {
        panic!("{not_a_repository:?}");
    };
    assert_eq!(path, outside.path());
    assert!(
        message.starts_with("fatal: not a git repository"),
        "{message}"
    );
    assert!(!message.contains('\n'), "{message}");
    let line = format!(
        "{} is not inside a git repository: {message}",
        outside.path().display()
    );
    assert_eq!(not_a_repository.to_string(), line);
    assert_eq!(paths(&range(root, "main..unrelated")), ["a.txt"]);
}

#[test]
fn added_has_an_empty_left_and_deleted_an_empty_right() {
    let dir = repo_with(&[
        changed("new.txt", None, Some(b"new\n")),
        changed("old.txt", Some(b"old\n"), None),
    ]);
    let range = range(dir.path(), "main..local");

    let changes: Vec<RangeChange> = range
        .start()
        .files
        .into_iter()
        .map(|entry| entry.change)
        .collect();
    assert_eq!(changes, [RangeChange::Added, RangeChange::Deleted]);
    assert_eq!(
        load(&range, "new.txt"),
        texts("", "new\n", RangeModeChange::Same)
    );
    assert_eq!(
        load(&range, "old.txt"),
        texts("old\n", "", RangeModeChange::Same)
    );
}

#[test]
fn renamed_shows_the_old_text_left() {
    let old = "one\ntwo\nthree\nfour\nfive\nsix\n";
    let new = "one\ntwo\nthree\nfour\nfive\nsix and more\n";
    let dir = repo_with(&[
        changed("old/name.txt", Some(old.as_bytes()), None),
        changed("new/name.txt", None, Some(new.as_bytes())),
    ]);
    let range = range(dir.path(), "main..local");

    let start = range.start();
    assert_eq!(paths(&range), ["new/name.txt"]);
    let renamed = RangeChange::Renamed {
        old_path: "old/name.txt".to_owned(),
    };
    assert_eq!(start.files[0].change, renamed);
    assert_eq!(
        load(&range, "new/name.txt"),
        texts(old, new, RangeModeChange::Same)
    );
}

#[test]
fn binary_is_answered_before_size_and_without_reading() {
    let large_binary = vec![0_u8; MAX_TEXT_BYTES + 1];
    let dir = repo_with(&[changed("big.bin", None, Some(&large_binary))]);
    let root = dir.path();
    let range = range(root, "main..local");
    drop_object(root, "local:big.bin");

    assert_eq!(load(&range, "big.bin"), RangeFile::Binary);
}

#[test]
fn exactly_8_mib_loads_and_one_byte_more_is_too_large() {
    let exact = "a\n".repeat(MAX_TEXT_BYTES / 2);
    let over = format!("{exact}a");
    let dir = repo_with(&[
        changed("exact.txt", None, Some(exact.as_bytes())),
        changed("over.txt", None, Some(over.as_bytes())),
    ]);
    let root = dir.path();
    let range = range(root, "main..local");
    drop_object(root, "local:over.txt");

    let loaded = load(&range, "exact.txt");
    let RangeFile::Texts { left, right, .. } = &loaded else {
        panic!("{loaded:?}");
    };
    assert_eq!((left.len(), right.len()), (0, MAX_TEXT_BYTES));
    let limit = u32::try_from(MAX_TEXT_BYTES).unwrap();
    assert_eq!(load(&range, "over.txt"), RangeFile::TooLarge { limit });
}

#[test]
fn non_utf8_names_the_sides() {
    let dir = repo_with(&[
        changed("both.txt", Some(b"caf\xe9\n"), Some(b"th\xe9\n")),
        changed("left.txt", Some(b"caf\xe9\n"), Some(b"cafe\n")),
        changed("right.txt", Some(b"cafe\n"), Some(b"caf\xe9\n")),
    ]);
    let range = range(dir.path(), "main..local");

    let not_utf8 = |sides| RangeFile::NotUtf8 { sides };
    assert_eq!(load(&range, "left.txt"), not_utf8(RangeSides::Left));
    assert_eq!(load(&range, "right.txt"), not_utf8(RangeSides::Right));
    assert_eq!(load(&range, "both.txt"), not_utf8(RangeSides::Both));
}

/// A submodule at `SECOND_COMMIT` on `local`, at `base` on `main` and `remote`.
fn submodule(path: &'static str, base: Option<&'static str>) -> ConflictFile<'static> {
    ConflictFile {
        path,
        kind: FileKind::Submodule,
        base: base.map(str::as_bytes),
        local: Some(SECOND_COMMIT.as_bytes()),
        remote: base.map(str::as_bytes),
    }
}

#[test]
fn mode_only_kind_changed_and_submodule_are_sentences() {
    let dir = repo_with(&[
        changed("entry", Some(b"text\n"), Some(b"text\n")),
        changed("run.sh", Some(b"echo hi\n"), Some(b"echo hi\n")),
        submodule("vendor/lib", Some(FIRST_COMMIT)),
        submodule("vendor/new", None),
    ]);
    let root = dir.path();
    git_ok(root, &["update-index", "--chmod=+x", "run.sh"]).unwrap();
    stage_link(root, "entry", "target.txt");
    commit(root, "modes");
    let range = range(root, "main..local");
    drop_object(root, "local:run.sh");
    drop_object(root, "local:entry");
    drop_object(root, "main:entry");

    let mode_only = RangeFile::ModeOnly {
        old: RangeEntryKind::File,
        new: RangeEntryKind::Executable,
    };
    let kind_changed = RangeFile::KindChanged {
        old: RangeEntryKind::File,
        new: RangeEntryKind::Link,
    };
    let changed_submodule = RangeFile::Submodule {
        old: Some(FIRST_COMMIT.to_owned()),
        new: Some(SECOND_COMMIT.to_owned()),
    };
    let added_submodule = RangeFile::Submodule {
        old: None,
        new: Some(SECOND_COMMIT.to_owned()),
    };
    assert_eq!(load(&range, "run.sh"), mode_only);
    assert_eq!(load(&range, "entry"), kind_changed);
    assert_eq!(load(&range, "vendor/lib"), changed_submodule);
    assert_eq!(load(&range, "vendor/new"), added_submodule);
}

#[test]
fn a_link_is_shown_as_its_target_text() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"a\n"))]);
    let root = dir.path();
    stage_link(root, "link", "old/target");
    commit(root, "link");
    stage_link(root, "link", "new/target");
    commit(root, "retarget");

    let range = range(root, "HEAD~1..HEAD");

    let expected = texts("old/target", "new/target", RangeModeChange::Same);
    assert_eq!(load(&range, "link"), expected);
}

#[test]
fn texts_carry_merge_core_compare_s_differences() {
    let (old, new) = ("one\ntwo\nthree\n", "one\n2\nthree\nfour\n");
    let dir = repo_with(&[
        changed("lines.txt", Some(old.as_bytes()), Some(new.as_bytes())),
        changed("tool.sh", Some(b"echo 1\n"), Some(b"echo 1\n")),
    ]);
    let root = dir.path();
    write_and_add(root, "tool.sh", "echo 2\n");
    git_ok(root, &["update-index", "--chmod=+x", "tool.sh"]).unwrap();
    commit(root, "tool");

    let range = range(root, "main..local");

    let loaded = load(&range, "lines.txt");
    assert_eq!(loaded, texts(old, new, RangeModeChange::Same));
    let RangeFile::Texts { differences, .. } = loaded else {
        panic!("{loaded:?}");
    };
    assert_eq!(differences.len(), 2);
    let executable = RangeModeChange::Changed {
        old: RangeEntryKind::File,
        new: RangeEntryKind::Executable,
    };
    assert_eq!(
        load(&range, "tool.sh"),
        texts("echo 1\n", "echo 2\n", executable)
    );
}

#[test]
fn an_unknown_id_is_unknown_file() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"b\n"))]);
    let range = range(dir.path(), "main..local");

    let error = range.load(RangeFileId(1)).unwrap_err();

    assert!(matches!(
        error,
        Error::UnknownFile {
            file: RangeFileId(1)
        }
    ));
    assert_eq!(error.to_string(), "no file 1 in this range");
    assert!(range.load(RangeFileId(0)).is_ok());
}

#[test]
fn a_range_is_shared_between_threads() {
    fn require_send_and_sync<T: Send + Sync>() {}
    require_send_and_sync::<Range>();
}

fn pair_folder(range_dir: &Path, root: &Path, left: &str, right: &str) -> PathBuf {
    let lock = PairLock::take(range_dir, &resolved(root, &format!("{left}..{right}"))).unwrap();
    lock.folder().to_owned()
}

#[test]
fn the_same_pair_twice_is_locked_naming_both_short_ids() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"b\n"))]);
    let root = dir.path();
    let range_dir = tempfile::tempdir().unwrap();
    let first = resolved(root, "main..local");
    let held = PairLock::take(range_dir.path(), &first).unwrap();
    let main_id = rev_parse(root, "main");
    let typed_otherwise = resolved(root, &format!("{main_id}..HEAD"));

    let error = PairLock::take(range_dir.path(), &typed_otherwise).unwrap_err();

    let (left, right) = (short_id(root, "main"), short_id(root, "local"));
    let line = format!(
        "another yamt window shows {left}..{right} of {}",
        typed_otherwise.root().display()
    );
    assert_eq!(error.to_string(), line);
    assert!(matches!(&error, Error::Locked { root: shown, .. } if shown == typed_otherwise.root()));
    let pair = format!("{main_id}-{}", rev_parse(root, "local"));
    assert_eq!(held.folder().file_name().unwrap(), pair.as_str());
    let repo_folder = held.folder().parent().unwrap();
    assert_eq!(repo_folder.parent().unwrap(), range_dir.path());
    assert!(held.folder().join(LOCK_FILE).is_file());
    drop(held);
    assert!(PairLock::take(range_dir.path(), &typed_otherwise).is_ok());
}

#[test]
fn another_worktree_of_the_same_repository_shares_the_lock() {
    let dir = repo_with(&[file("a.txt", Some(b"a\n"), Some(b"b\n"), Some(b"c\n"))]);
    let root = dir.path();
    let linked_dir = tempfile::tempdir().unwrap();
    let linked = linked_dir.path().join("elsewhere");
    let linked_arg = linked.to_str().unwrap();
    git_ok(
        root,
        &[
            "worktree", "add", "--quiet", "--detach", linked_arg, "remote",
        ],
    )
    .unwrap();
    let range_dir = tempfile::tempdir().unwrap();
    let _held = PairLock::take(range_dir.path(), &resolved(root, "main..remote")).unwrap();
    let from_linked = resolved(&linked, "main..remote");

    let error = PairLock::take(range_dir.path(), &from_linked).unwrap_err();

    assert!(matches!(&error, Error::Locked { root: shown, .. } if shown == from_linked.root()));
    assert_ne!(from_linked.root(), resolved(root, "main..remote").root());
}

#[test]
fn a_different_pair_is_not_locked() {
    let dir = repo_with(&[file("a.txt", Some(b"a\n"), Some(b"b\n"), Some(b"c\n"))]);
    let root = dir.path();
    let range_dir = tempfile::tempdir().unwrap();
    let to_local = PairLock::take(range_dir.path(), &resolved(root, "main..local")).unwrap();

    let to_remote = PairLock::take(range_dir.path(), &resolved(root, "main..remote")).unwrap();
    let reversed = PairLock::take(range_dir.path(), &resolved(root, "local..main")).unwrap();

    assert_ne!(to_local.folder(), to_remote.folder());
    assert_ne!(to_local.folder(), reversed.folder());
    assert_eq!(to_local.folder().parent(), to_remote.folder().parent());
    let other_dir = repo_with(&[file("a.txt", Some(b"a\n"), Some(b"b\n"), Some(b"c\n"))]);
    let other = pair_folder(range_dir.path(), other_dir.path(), "main", "local");
    assert_ne!(other.parent(), to_local.folder().parent());
}

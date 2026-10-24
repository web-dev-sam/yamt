#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_agent::{CheckoutLook, CheckoutReply, Pair, Workspace, sweep_leftovers};
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git, git_ok};

const IGNORE_RULES: &[u8] = b"ignored/\n";

/// The source repository, the data folder standing for `<data_dir>/yamt/range`, and the pair inside it
/// whose right commit is the source's `remote`.
struct Fixture {
    _source: TempDir,
    range_dir: TempDir,
    pair: Pair,
}

impl Fixture {
    fn new() -> Fixture {
        let files = [
            same_on_every_side(".gitignore", IGNORE_RULES),
            ConflictFile {
                path: "a.txt",
                kind: FileKind::Regular,
                base: Some(b"base\n"),
                local: Some(b"local\n"),
                remote: Some(b"remote\n"),
            },
        ];
        let source = diverged_repo(&files).unwrap();
        let range_dir = tempfile::tempdir().unwrap();
        let left = commit_of(source.path(), "main");
        let right = commit_of(source.path(), "remote");
        let folder = range_dir
            .path()
            .join("source-0123456789abcdef")
            .join(format!("{left}-{right}"));
        fs::create_dir_all(&folder).unwrap();
        let pair = Pair {
            repo: source.path().to_owned(),
            folder,
            new_commit: right,
        };
        Fixture {
            _source: source,
            range_dir,
            pair,
        }
    }

    fn workspace(&self) -> Workspace {
        Workspace::new(self.pair.clone())
    }

    fn checkout(&self) -> PathBuf {
        self.pair.folder.join("checkout")
    }

    fn ready(&self) -> CheckoutReply {
        CheckoutReply::Ready {
            folder: self.checkout().to_string_lossy().into_owned(),
        }
    }

    fn changed(&self, files: &[&str], head_moved: bool) -> CheckoutLook {
        CheckoutLook::Changed {
            folder: self.checkout().to_string_lossy().into_owned(),
            files: files.iter().map(|file| (*file).to_owned()).collect(),
            head_moved,
        }
    }
}

fn same_on_every_side<'a>(path: &'a str, text: &'a [u8]) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(text),
        local: Some(text),
        remote: Some(text),
    }
}

fn commit_of(root: &Path, revision: &str) -> String {
    text_of(root, &["rev-parse", revision])
        .trim_end()
        .to_owned()
}

fn text_of(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

fn commit_everything(root: &Path, message: &str) {
    git_ok(root, &["add", "--all"]).unwrap();
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", message]).unwrap();
}

#[test]
fn prepare_makes_the_checkout_in_the_pair_folder_and_reuses_it_the_second_time() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();

    assert_eq!(workspace.prepare(), fixture.ready());

    let checkout = fixture.checkout();
    assert_eq!(fs::read(checkout.join("a.txt")).unwrap(), b"remote\n");
    assert_eq!(commit_of(&checkout, "HEAD"), fixture.pair.new_commit);
    assert!(
        !git(&checkout, &["symbolic-ref", "-q", "HEAD"])
            .unwrap()
            .status
            .success()
    );
    assert_eq!(text_of(&checkout, &["remote"]), "");
    assert!(!fixture.pair.folder.join("checkout.partial").exists());
    let marker = checkout.join(".git").join("yamt-test-marker");
    fs::write(&marker, b"").unwrap();

    assert_eq!(workspace.prepare(), fixture.ready());
    assert!(marker.exists());
}

#[test]
fn prepare_reuses_a_kept_checkout_with_its_changes_and_commits() {
    let fixture = Fixture::new();
    let mut first = fixture.workspace();
    first.prepare();
    let checkout = fixture.checkout();
    fs::write(checkout.join("a.txt"), b"the AI's line\n").unwrap();
    commit_everything(&checkout, "the AI's commit");
    let commit = commit_of(&checkout, "HEAD");
    fs::write(checkout.join("new.txt"), b"not committed\n").unwrap();
    first.end();

    let mut next = fixture.workspace();
    assert_eq!(next.prepare(), fixture.ready());

    assert_eq!(commit_of(&checkout, "HEAD"), commit);
    assert_eq!(
        fs::read(checkout.join("new.txt")).unwrap(),
        b"not committed\n"
    );
    assert_eq!(next.look_job().look(), fixture.changed(&["new.txt"], true));
}

#[test]
fn a_partial_checkout_left_by_a_crash_is_removed_before_prepare() {
    let fixture = Fixture::new();
    let partial = fixture.pair.folder.join("checkout.partial");
    let removing = fixture.pair.folder.join("checkout.removing");
    fs::create_dir_all(&partial).unwrap();
    fs::write(partial.join("stale.txt"), b"half a clone\n").unwrap();
    fs::create_dir_all(&removing).unwrap();

    assert_eq!(fixture.workspace().prepare(), fixture.ready());

    assert!(!partial.exists());
    assert!(!removing.exists());
    assert!(!fixture.checkout().join("stale.txt").exists());
    assert_eq!(
        fs::read(fixture.checkout().join("a.txt")).unwrap(),
        b"remote\n"
    );
}

#[test]
fn a_failed_prepare_leaves_no_partial_checkout() {
    let mut fixture = Fixture::new();
    fixture.pair.new_commit = "0".repeat(40);
    let mut workspace = fixture.workspace();

    let reply = workspace.prepare();

    assert!(matches!(reply, CheckoutReply::Failed { message } if !message.is_empty()));
    assert!(!fixture.pair.folder.join("checkout.partial").exists());
    assert!(!fixture.checkout().exists());
}

#[test]
fn look_is_missing_before_prepare_and_clean_after() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    assert_eq!(workspace.look_job().look(), CheckoutLook::Missing);

    workspace.prepare();

    assert_eq!(workspace.look_job().look(), CheckoutLook::Clean);
}

#[test]
fn an_edited_file_an_untracked_file_and_a_moved_head_each_count_as_changed() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let checkout = fixture.checkout();

    fs::write(checkout.join("a.txt"), b"edited\n").unwrap();
    assert_eq!(
        workspace.look_job().look(),
        fixture.changed(&["a.txt"], false)
    );
    git_ok(&checkout, &["checkout", "--", "a.txt"]).unwrap();

    fs::write(checkout.join("untracked.txt"), b"new\n").unwrap();
    assert_eq!(
        workspace.look_job().look(),
        fixture.changed(&["untracked.txt"], false)
    );
    fs::remove_file(checkout.join("untracked.txt")).unwrap();

    commit_everything(&checkout, "an empty commit");
    assert_eq!(workspace.look_job().look(), fixture.changed(&[], true));
}

#[test]
fn an_ignored_file_alone_counts_as_clean() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let ignored = fixture.checkout().join("ignored");
    fs::create_dir_all(&ignored).unwrap();
    fs::write(ignored.join("build.out"), b"output\n").unwrap();

    assert_eq!(workspace.look_job().look(), CheckoutLook::Clean);

    workspace.end();
    assert!(!fixture.checkout().exists());
}

#[test]
fn a_checkout_git_cannot_read_is_unreadable_and_never_removed_by_end_or_sweep() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    let checkout = fixture.checkout();
    let borrowed = checkout
        .join(".git")
        .join("objects")
        .join("info")
        .join("alternates");
    fs::remove_file(borrowed).unwrap();

    let look = workspace.look_job().look();
    let CheckoutLook::Unreadable { folder, message } = look else {
        panic!("{look:?} instead of Unreadable");
    };
    assert_eq!(folder, checkout.to_string_lossy());
    assert_ne!(message, "");

    sweep_leftovers(
        fixture.range_dir.path(),
        &fixture.range_dir.path().join("other"),
    );
    assert!(checkout.join("a.txt").exists());
    workspace.end();
    assert!(checkout.join("a.txt").exists());
}

#[test]
fn a_checkout_without_its_own_git_folder_is_unreadable_inside_another_repository() {
    let fixture = Fixture::new();
    let outer = fixture.range_dir.path();
    git_ok(outer, &["init", "--quiet"]).unwrap();
    commit_everything(outer, "a repository around the data folder");
    let mut workspace = fixture.workspace();
    workspace.prepare();
    fs::remove_dir_all(fixture.checkout().join(".git")).unwrap();

    let look = workspace.look_job().look();

    assert!(matches!(look, CheckoutLook::Unreadable { .. }), "{look:?}");
    workspace.end();
    assert!(fixture.checkout().join("a.txt").exists());
}

#[test]
fn end_removes_a_clean_checkout_and_keeps_a_changed_one() {
    let fixture = Fixture::new();
    let mut clean = fixture.workspace();
    clean.prepare();
    clean.end();
    assert!(!fixture.checkout().exists());
    assert!(!fixture.pair.folder.join("checkout.removing").exists());

    let mut changed = fixture.workspace();
    changed.prepare();
    fs::write(fixture.checkout().join("a.txt"), b"edited\n").unwrap();
    changed.end();
    assert_eq!(
        fs::read(fixture.checkout().join("a.txt")).unwrap(),
        b"edited\n"
    );
}

#[test]
fn discard_removes_a_changed_checkout() {
    let fixture = Fixture::new();
    let mut workspace = fixture.workspace();
    workspace.prepare();
    fs::write(fixture.checkout().join("a.txt"), b"edited\n").unwrap();

    workspace.discard().unwrap();

    assert!(!fixture.checkout().exists());
    assert!(!fixture.pair.folder.join("checkout.removing").exists());
    assert_eq!(workspace.look_job().look(), CheckoutLook::Missing);
}

#[test]
fn a_checkout_left_after_a_kill_is_reused_by_the_next_window() {
    let fixture = Fixture::new();
    let mut killed = fixture.workspace();
    killed.prepare();
    fs::write(fixture.checkout().join("untracked.txt"), b"kept\n").unwrap();
    drop(killed);

    let mut next = fixture.workspace();
    assert_eq!(next.prepare(), fixture.ready());

    assert_eq!(
        fs::read(fixture.checkout().join("untracked.txt")).unwrap(),
        b"kept\n"
    );
    assert_eq!(
        next.look_job().look(),
        fixture.changed(&["untracked.txt"], false)
    );
}

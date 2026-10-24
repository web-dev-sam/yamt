#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_agent::{Pair, Workspace, sweep_leftovers};
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_range::PairLock;

/// A pair folder `<left>-<right>` in a range folder whose checkout a window made and then lost
/// (dropped without `end`), with a `checkout.partial` and a `checkout.removing` beside it.
struct Leftover {
    _source: TempDir,
    range_dir: TempDir,
    folder: PathBuf,
}

impl Leftover {
    fn new() -> Leftover {
        let file = ConflictFile {
            path: "a.txt",
            kind: FileKind::Regular,
            base: Some(b"base\n"),
            local: Some(b"local\n"),
            remote: Some(b"remote\n"),
        };
        let source = diverged_repo(&[file]).unwrap();
        let range_dir = tempfile::tempdir().unwrap();
        let left = commit_of(source.path(), "main");
        let right = commit_of(source.path(), "remote");
        let folder = range_dir
            .path()
            .join("source-0123456789abcdef")
            .join(format!("{left}-{right}"));
        fs::create_dir_all(&folder).unwrap();
        let mut workspace = Workspace::new(Pair {
            repo: source.path().to_owned(),
            folder: folder.clone(),
            new_commit: right,
        });
        workspace.prepare();
        drop(workspace);
        for leftover in ["checkout.partial", "checkout.removing"] {
            fs::create_dir_all(folder.join(leftover).join("inside")).unwrap();
        }
        Leftover {
            _source: source,
            range_dir,
            folder,
        }
    }

    fn sweep_from(&self, own: &Path) {
        sweep_leftovers(self.range_dir.path(), own);
    }

    fn other_pair(&self) -> PathBuf {
        self.range_dir
            .path()
            .join("other-0123456789abcdef")
            .join("a-b")
    }

    fn has(&self, name: &str) -> bool {
        self.folder.join(name).exists()
    }
}

fn commit_of(root: &Path, revision: &str) -> String {
    String::from_utf8(git_ok(root, &["rev-parse", revision]).unwrap())
        .unwrap()
        .trim_end()
        .to_owned()
}

#[test]
fn a_clean_leftover_of_an_unheld_pair_is_removed() {
    let leftover = Leftover::new();

    leftover.sweep_from(&leftover.other_pair());

    assert!(!leftover.has("checkout"));
    assert!(!leftover.has("checkout.partial"));
    assert!(!leftover.has("checkout.removing"));
}

#[test]
fn a_changed_leftover_is_kept() {
    let leftover = Leftover::new();
    fs::write(leftover.folder.join("checkout").join("a.txt"), b"edited\n").unwrap();

    leftover.sweep_from(&leftover.other_pair());

    assert_eq!(
        fs::read(leftover.folder.join("checkout").join("a.txt")).unwrap(),
        b"edited\n"
    );
    assert!(!leftover.has("checkout.partial"));
    assert!(!leftover.has("checkout.removing"));
}

#[test]
fn a_leftover_of_a_held_pair_is_untouched() {
    let leftover = Leftover::new();
    let _window = PairLock::try_hold(&leftover.folder).unwrap().unwrap();

    leftover.sweep_from(&leftover.other_pair());

    assert!(leftover.has("checkout"));
    assert!(leftover.has("checkout.partial"));
    assert!(leftover.has("checkout.removing"));
}

#[test]
fn the_own_pair_keeps_its_checkout_and_loses_partial_and_removing_folders() {
    let leftover = Leftover::new();
    let _own = PairLock::try_hold(&leftover.folder).unwrap().unwrap();

    leftover.sweep_from(&leftover.folder);

    assert!(leftover.has("checkout"));
    assert!(!leftover.has("checkout.partial"));
    assert!(!leftover.has("checkout.removing"));
}

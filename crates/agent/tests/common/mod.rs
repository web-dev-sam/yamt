use std::path::{Path, PathBuf};

use yamt_agent::{Pair, Workspace};
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_range::{PairLock, RangeSpec, Resolved};

const IGNORE_RULES: &[u8] = b"ignored/\n";

/// The source repository (`a.txt` differs on every side; `ignored/` is ignored), the data folder standing for
/// `<data_dir>/yamt/range`, and the pair `main..remote` inside it, its folder made by `PairLock::take`.
pub struct Fixture {
    _source: TempDir,
    pub range_dir: TempDir,
    pub pair: Pair,
}

impl Fixture {
    pub fn new() -> Fixture {
        let source = diverged_repo(&[
            same_on_every_side(".gitignore", IGNORE_RULES),
            ConflictFile {
                path: "a.txt",
                kind: FileKind::Regular,
                base: Some(b"base\n"),
                local: Some(b"local\n"),
                remote: Some(b"remote\n"),
            },
        ])
        .unwrap();
        let (range_dir, pair) = pair_in(source.path());
        Fixture {
            _source: source,
            range_dir,
            pair,
        }
    }

    pub fn workspace(&self) -> Workspace {
        Workspace::new(self.pair.clone())
    }

    pub fn checkout(&self) -> PathBuf {
        self.pair.folder.join("checkout")
    }
}

/// A new data folder and the pair `main..remote` of `source` in it; no lock is held on it.
pub fn pair_in(source: &Path) -> (TempDir, Pair) {
    let range_dir = tempfile::tempdir().unwrap();
    let spec = RangeSpec::parse("main..remote").unwrap();
    let resolved = Resolved::resolve(source, &spec).unwrap();
    let folder = PairLock::take(range_dir.path(), &resolved)
        .unwrap()
        .folder()
        .to_owned();
    let pair = Pair {
        repo: source.to_owned(),
        folder,
        new_commit: commit_of(source, "remote"),
    };
    (range_dir, pair)
}

pub fn commit_of(root: &Path, revision: &str) -> String {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
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

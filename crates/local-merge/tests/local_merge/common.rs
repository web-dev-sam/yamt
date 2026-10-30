use std::path::{Path, PathBuf};
use std::process::Command;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_gitio::{Operation, Repo};
use yamt_local_merge::MergeRequestBranches;

/// `scripts/mr-conflict-repo.sh`'s names.
pub const IID: u32 = 21;
pub const ORIGIN: &str = "origin";
pub const MAIN: &str = "main";
pub const DEVELOP: &str = "develop";
pub const DUE_DATES: &str = "feature/due-dates";
pub const CLEAN: &str = "feature/clean";
pub const MERGED: &str = "feature/merged";
const RECORD: &str = ".git/yamt-merge-request.json";
const START_LOCK: &str = ".git/yamt-merge-request.lock";
const GITLAB: &str = ".git/fake-gitlab.git";

/// `scripts/mr-conflict-repo.sh`'s repository in a temporary folder, on `develop`.
pub struct Fixture {
    _dir: TempDir,
    root: PathBuf,
}

/// What a refusal must leave as it was.
#[derive(Debug, PartialEq, Eq)]
pub struct Checkout {
    head: String,
    branches: String,
    status: String,
    has_record: bool,
}

impl Fixture {
    pub fn new() -> Fixture {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("mrc");
        let script =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/mr-conflict-repo.sh");
        let built = Command::new(script).arg(&root).output().unwrap();
        assert!(built.status.success(), "{built:?}");
        Fixture { _dir: dir, root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// git's output in the checkout, without its final newline.
    pub fn git(&self, args: &[&str]) -> String {
        output_line(git_ok(&self.root, args).unwrap())
    }

    /// git's output in the fake GitLab, without its final newline.
    pub fn gitlab(&self, args: &[&str]) -> String {
        output_line(git_ok(&self.root.join(GITLAB), args).unwrap())
    }

    pub fn record_path(&self) -> PathBuf {
        self.root.join(RECORD)
    }

    pub fn start_lock_path(&self) -> PathBuf {
        self.root.join(START_LOCK)
    }

    pub fn checkout(&self) -> Checkout {
        Checkout {
            head: self.head(),
            branches: self.git(&["for-each-ref", "refs/heads"]),
            status: self.git(&["status", "--porcelain=v1"]),
            has_record: self.record_path().exists(),
        }
    }

    /// HEAD's ref (`HEAD` when detached) and commit.
    pub fn head(&self) -> String {
        let name = self.git(&["rev-parse", "--symbolic-full-name", "HEAD"]);
        format!("{name} {}", self.git(&["rev-parse", "HEAD"]))
    }

    pub fn tip(&self, branch: &str) -> String {
        self.git(&["rev-parse", &format!("refs/heads/{branch}")])
    }

    pub fn has_branch(&self, branch: &str) -> bool {
        let name = format!("refs/heads/{branch}");
        let found =
            yamt_conflict_repo::git(&self.root, &["rev-parse", "--verify", "--quiet", &name]);
        found.unwrap().status.success()
    }

    pub fn gitlab_tip(&self, branch: &str) -> String {
        self.gitlab(&["rev-parse", &format!("refs/heads/{branch}")])
    }

    /// What the merge window runs before `LiveMerge::restore`: git's own merge abort.
    pub fn abort_git_merge(&self) {
        let repo = Repo::discover(&self.root).unwrap();
        let operation = repo.stop().unwrap().operation.unwrap();
        assert!(matches!(operation, Operation::Merge { .. }));
        repo.abort(&operation).unwrap();
    }

    pub fn write(&self, path: &str, content: &str) {
        std::fs::write(self.root.join(path), content).unwrap();
    }

    /// A config value of the checkout; `None` when it is not set.
    pub fn config(&self, key: &str) -> Option<String> {
        let read = yamt_conflict_repo::git(&self.root, &["config", key]).unwrap();
        read.status.success().then(|| output_line(read.stdout))
    }
}

/// Merge request !21 of `branch` into `main`, on `origin`.
pub fn branches(branch: &str) -> MergeRequestBranches {
    MergeRequestBranches {
        iid: IID,
        remote: ORIGIN.to_owned(),
        branch: branch.to_owned(),
        target: MAIN.to_owned(),
    }
}

fn output_line(output: Vec<u8>) -> String {
    let text = String::from_utf8(output).unwrap();
    text.strip_suffix('\n').unwrap_or(&text).to_owned()
}

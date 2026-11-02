#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    BlockedReason, CheckSummary, CheckedRow, GitLabRepository, ListEnd, MergeRequestIid,
    MergedPairs, Readiness, check_conflicts, gitlab_repository, list_merge_requests,
};

use fake_glab::{Fake, in_this_repository};

const BARE: &str = ".git/fake-gitlab.git";
const FEATURE_CLEAN: &str = "refs/heads/feature/clean";

/// `scripts/local-conflicts-repo.sh`'s repository with the fake glab on the `local-conflicts/` scenario.
struct Setup {
    repo: TempDir,
    fake: Fake,
}

impl Setup {
    fn new() -> Setup {
        let repo = tempfile::tempdir().unwrap();
        let built = Command::new(in_this_repository("scripts/local-conflicts-repo.sh"))
            .arg(repo.path().join("lc"))
            .output()
            .unwrap();
        assert!(built.status.success(), "{built:?}");
        Setup {
            repo,
            fake: Fake::new("local-conflicts"),
        }
    }

    fn root(&self) -> PathBuf {
        self.repo.path().join("lc")
    }

    fn repository(&self) -> GitLabRepository {
        gitlab_repository(&self.root()).unwrap()
    }

    /// One load: the list, then the check with `memory`; the rows the check sent, by iid, and its summary.
    fn load(&self, memory: &mut MergedPairs) -> (Vec<CheckedRow>, CheckSummary) {
        self.load_with(memory, || {})
    }

    /// As `load`, with `between` run after the list and before the check.
    fn load_with(
        &self,
        memory: &mut MergedPairs,
        between: impl FnOnce(),
    ) -> (Vec<CheckedRow>, CheckSummary) {
        let repository = self.repository();
        let listed = list_merge_requests(&repository, Some(&self.fake.glab), &|_| {});
        assert_eq!(listed.end, ListEnd::Loaded);
        between();
        let (sender, sent) = mpsc::channel();
        let on_checked = |row| sender.send(row).unwrap();
        let summary = check_conflicts(&repository, &listed.to_check.unwrap(), memory, &on_checked);
        let mut rows: Vec<CheckedRow> = sent.try_iter().collect();
        rows.sort_by_key(|row| row.iid);
        (rows, summary)
    }

    /// What the check must leave as it was: every ref, the status, HEAD's bytes and whether `FETCH_HEAD` exists.
    fn untouched(&self) -> (Vec<u8>, Vec<u8>, Vec<u8>, bool) {
        let root = self.root();
        (
            git_ok(&root, &["for-each-ref"]).unwrap(),
            git_ok(&root, &["status", "--porcelain"]).unwrap(),
            fs::read(root.join(".git/HEAD")).unwrap(),
            root.join(".git/FETCH_HEAD").exists(),
        )
    }

    /// Points the fake GitLab's `refs/merge-requests/<iid>/head` at `target`.
    fn move_head_ref(&self, iid: u32, target: &str) {
        let bare = format!("--git-dir={}", self.root().join(BARE).display());
        let head_ref = format!("refs/merge-requests/{iid}/head");
        git_ok(&self.root(), &[&bare, "update-ref", &head_ref, target]).unwrap();
    }

    /// Deletes the object of the commit the fake GitLab's `refs/merge-requests/<iid>/head` names; the ref stays.
    fn remove_head_commit(&self, iid: u32) {
        let bare = self.root().join(BARE);
        let git_dir = format!("--git-dir={}", bare.display());
        let head_ref = format!("refs/merge-requests/{iid}/head");
        let id = git_ok(&self.root(), &[&git_dir, "rev-parse", &head_ref]).unwrap();
        let id = String::from_utf8(id).unwrap();
        let (directory, file) = id.trim().split_at(2);
        fs::remove_file(bare.join("objects").join(directory).join(file)).unwrap();
    }
}

fn checked(iid: u32, readiness: Readiness) -> CheckedRow {
    CheckedRow {
        iid: MergeRequestIid(iid),
        readiness,
    }
}

fn conflicts(also: &[BlockedReason]) -> Readiness {
    Readiness::Conflicts {
        also: also.to_vec(),
    }
}

/// The scenario table's "sent after the check" column (`tests/glab/README.md`), by iid.
fn table_rows() -> Vec<CheckedRow> {
    use BlockedReason::{Discussions, Draft};
    vec![
        checked(41, Readiness::MergesCleanly),
        checked(42, conflicts(&[])),
        checked(43, Readiness::MergesCleanly),
        checked(45, Readiness::MergesCleanly),
        checked(47, conflicts(&[Discussions, Draft])),
        checked(48, Readiness::MergesCleanly),
    ]
}

#[test]
fn the_local_merge_decides_conflicts_and_gitlab_the_rest() {
    let setup = Setup::new();

    let (rows, summary) = setup.load(&mut MergedPairs::default());

    assert_eq!(rows, table_rows());
    let expected = CheckSummary {
        rows: 9,
        merges: 5,
        fetched_refs: 1,
        remembered: 0,
        moving: 1,
        kept: 1,
        problem: None,
    };
    assert_eq!(summary, expected);
    let argv = setup.fake.logged("argv: ");
    let calls = "the list's three glab calls, none of the check's";
    assert_eq!(argv.len(), 3, "{calls}: {argv:?}");
}

#[test]
fn a_head_ref_ahead_of_gitlabs_head_keeps_gitlabs_answer() {
    let setup = Setup::new();
    let mut memory = MergedPairs::default();

    let (rows, summary) = setup.load(&mut memory);

    assert!(
        rows.iter().all(|row| row.iid != MergeRequestIid(44)),
        "{rows:?}"
    );
    assert_eq!(summary.moving, 1);

    setup.move_head_ref(44, FEATURE_CLEAN);
    let (rows, summary) = setup.load(&mut memory);

    assert_eq!(rows, table_rows());
    assert_eq!((summary.moving, summary.remembered), (0, 8));
}

#[test]
fn a_second_load_with_the_same_pairs_merges_and_fetches_nothing() {
    let setup = Setup::new();
    let mut memory = MergedPairs::default();
    setup.load(&mut memory);

    let (rows, summary) = setup.load(&mut memory);

    assert_eq!(rows, table_rows());
    let expected = CheckSummary {
        rows: 9,
        merges: 0,
        fetched_refs: 0,
        remembered: 7,
        moving: 1,
        kept: 1,
        problem: None,
    };
    assert_eq!(summary, expected);
}

#[test]
fn the_check_leaves_refs_status_head_and_fetch_head_byte_identical() {
    let setup = Setup::new();
    let before = setup.untouched();
    let mut memory = MergedPairs::default();

    setup.load(&mut memory);
    setup.load(&mut memory);

    assert_eq!(setup.untouched(), before);
    assert!(!before.3, "FETCH_HEAD before the first load");
}

#[test]
fn an_unreachable_remote_keeps_every_gitlab_answer() {
    let setup = Setup::new();
    let bare = setup.root().join(BARE);
    let move_bare_away = || fs::rename(&bare, setup.root().join(".git/moved.git")).unwrap();

    let (rows, summary) = setup.load_with(&mut MergedPairs::default(), move_bare_away);

    assert_eq!(rows, []);
    assert_eq!((summary.merges, summary.kept), (0, 9));
    let problem = summary.problem.unwrap();
    let ls_remote_line = format!(
        "ls-remote: fatal: '{}' does not appear to be a git repository",
        bare.display()
    );
    assert_eq!(problem, ls_remote_line);
}

#[test]
fn a_failed_fetch_keeps_only_the_rows_that_needed_it() {
    let setup = Setup::new();
    let lose_the_fork_commit = || setup.remove_head_commit(45);

    let (rows, summary) = setup.load_with(&mut MergedPairs::default(), lose_the_fork_commit);

    let without_45: Vec<CheckedRow> = table_rows()
        .into_iter()
        .filter(|row| row.iid != MergeRequestIid(45))
        .collect();
    assert_eq!(rows, without_45);
    assert_eq!((summary.merges, summary.kept), (4, 2));
    let problem = summary.problem.unwrap();
    assert!(problem.starts_with("fetch: "), "{problem}");
}

#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    GitLabRepository, MergeRequestIid, OpenReply, RangeToOpen, gitlab_repository, prepare_open,
};
use yamt_range::{PairLock, RangeSpec, Resolved};
use yamt_review::{GitLabCheck, check_gitlab};

use fake_glab::{Fake, in_this_repository};

/// `scripts/range-repo.sh`'s commits, fixed by its names and dates; !13's head is only in its fake GitLab.
const MERGE_BASE: &str = "531ea52dfb892e20206010fb6cd6161d9c88964a";
const FEATURE: &str = "9c1ba3fc606a3776061d23006b83e2af2a357112";
const MR13_HEAD: &str = "6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19";
const GITLAB_URL: &str = "https://gitlab.example/taskboard/taskboard.git";
const DETAILS_START: &str = "argv: api graphql -f query=query MergeRequestDetails(";

/// `scripts/range-repo.sh`'s repository with its fake GitLab, a folder for pair locks, and the fake glab.
struct Setup {
    repo: TempDir,
    range_dir: TempDir,
    fake: Fake,
}

impl Setup {
    fn new() -> Setup {
        let repo = tempfile::tempdir().unwrap();
        let built = Command::new(in_this_repository("scripts/range-repo.sh"))
            .arg(repo.path().join("rr"))
            .output()
            .unwrap();
        assert!(built.status.success(), "{built:?}");
        Setup {
            repo,
            range_dir: tempfile::tempdir().unwrap(),
            fake: Fake::new("merge-requests"),
        }
    }

    fn root(&self) -> PathBuf {
        self.repo.path().join("rr")
    }

    fn git(&self, args: &[&str]) -> String {
        String::from_utf8(git_ok(&self.root(), args).unwrap()).unwrap()
    }

    fn repository(&self) -> GitLabRepository {
        gitlab_repository(&self.root()).unwrap()
    }

    fn open(&self, iid: u32) -> Result<RangeToOpen, OpenReply> {
        let repository = self.repository();
        let iid = MergeRequestIid(iid);
        prepare_open(
            &repository,
            Some(&self.fake.glab),
            iid,
            self.range_dir.path(),
        )
    }

    fn has_commit(&self, id: &str) -> bool {
        let object = format!("{id}^{{commit}}");
        let found = yamt_conflict_repo::git(&self.root(), &["cat-file", "-e", &object]).unwrap();
        found.status.success()
    }

    /// Points `origin`'s address at `url` instead of the fake GitLab.
    fn set_instead_of(&self, url: &str) {
        let bare = self.root().join(".git/fake-gitlab.git");
        self.git(&[
            "config",
            "--unset-all",
            &format!("url.{}.insteadOf", bare.display()),
        ]);
        self.git(&["config", &format!("url.{url}.insteadOf"), GITLAB_URL]);
    }

    /// What opening must leave as it was: every ref, the status and HEAD.
    fn untouched(&self) -> [String; 3] {
        [
            self.git(&["for-each-ref"]),
            self.git(&["status", "--porcelain=v1"]),
            self.git(&["rev-parse", "HEAD"]),
        ]
    }
}

fn resolved(root: &Path, spec: &str) -> Resolved {
    Resolved::resolve(root, &RangeSpec::parse(spec).unwrap()).unwrap()
}

#[test]
fn a_merge_request_whose_head_is_only_on_gitlab_is_fetched_and_its_range_lines_up() {
    let setup = Setup::new();
    let before = setup.untouched();
    assert!(!setup.has_commit(MR13_HEAD));

    let opened = setup.open(13).unwrap();

    assert_eq!(opened.spec, format!("{MERGE_BASE}..{MR13_HEAD}"));
    assert_eq!(
        fs::canonicalize(&opened.root).unwrap(),
        fs::canonicalize(setup.root()).unwrap()
    );
    assert!(setup.has_commit(MR13_HEAD));
    assert_eq!(setup.untouched(), before);
    assert!(!setup.root().join(".git/FETCH_HEAD").exists());
    let details = setup.fake.logged(DETAILS_START);
    assert!(
        details[0].ends_with(" -f fullPath=taskboard/taskboard -f iid=13"),
        "{details:?}"
    );
    let range = resolved(&opened.root, &opened.spec).list().unwrap();
    let GitLabCheck::LinedUp { merge_request } = check_gitlab(&range, Some(&setup.fake.glab))
    else {
        panic!("!13's range does not line up");
    };
    assert_eq!(merge_request.reference, "!13");
}

#[test]
fn a_merge_request_whose_commits_are_local_opens_without_fetching() {
    let setup = Setup::new();
    setup.set_instead_of("/nonexistent/gitlab.git");

    let opened = setup.open(12);

    assert_eq!(
        opened.map(|range| range.spec),
        Ok(format!("{MERGE_BASE}..{FEATURE}"))
    );
}

#[test]
fn a_range_another_window_shows_is_already_open() {
    let setup = Setup::new();
    let spec = format!("{MERGE_BASE}..{FEATURE}");
    let lock = PairLock::take(setup.range_dir.path(), &resolved(&setup.root(), &spec)).unwrap();

    assert_eq!(setup.open(12), Err(OpenReply::AlreadyOpen));

    drop(lock);
    assert!(setup.open(12).is_ok());
}

#[test]
fn a_diff_gitlab_still_prepares_or_a_merge_request_no_longer_open_is_refused() {
    let setup = Setup::new();

    assert_eq!(setup.open(14), Err(OpenReply::Preparing));
    assert_eq!(setup.open(15), Err(OpenReply::NotOpen));
}

#[test]
fn without_a_remote_of_the_project_nothing_is_fetched() {
    let setup = Setup::new();
    let other = "https://gitlab.example/other/project.git";
    setup.git(&["remote", "set-url", "origin", other]);

    assert_eq!(
        setup.open(13),
        Err(OpenReply::NoRemote {
            project: "taskboard/taskboard".to_owned()
        })
    );
    assert!(!setup.has_commit(MR13_HEAD));
}

#[test]
fn a_mirror_off_gitlab_listed_first_is_not_fetched_from() {
    let setup = Setup::new();
    let mirror = "https://github.com/taskboard/taskboard.git";
    setup.git(&["remote", "remove", "origin"]);
    setup.git(&["remote", "add", "github", mirror]);
    setup.git(&["config", "url./nonexistent/github.git.insteadOf", mirror]);
    setup.git(&["remote", "add", "origin", GITLAB_URL]);

    let opened = setup.open(13);

    assert_eq!(
        opened.map(|range| range.spec),
        Ok(format!("{MERGE_BASE}..{MR13_HEAD}"))
    );
}

#[test]
fn a_target_branch_naming_a_ref_to_write_is_refused_before_any_fetch() {
    let setup = Setup::new();
    let bare = setup.root().join(".git/fake-gitlab.git");
    git_ok(
        &bare,
        &["update-ref", "refs/merge-requests/17/head", MR13_HEAD],
    )
    .unwrap();
    let before = setup.untouched();

    let opened = setup.open(17);

    let message = r#"GitLab sent "main:refs/heads/x" as a branch name"#.to_owned();
    assert_eq!(opened, Err(OpenReply::Failed { message }));
    assert_eq!(setup.untouched(), before);
    assert!(!setup.has_commit(MR13_HEAD));
}

#[test]
fn a_failed_fetch_and_a_base_gone_from_gitlab_are_their_own_answers() {
    let setup = Setup::new();
    let bare = setup.root().join(".git/fake-gitlab.git");
    git_ok(
        &bare,
        &["update-ref", "refs/merge-requests/16/head", FEATURE],
    )
    .unwrap();

    assert_eq!(
        setup.open(16),
        Err(OpenReply::MissingCommit {
            short_id: "deadbee".to_owned()
        })
    );

    setup.set_instead_of("/nonexistent/gitlab.git");
    let Err(OpenReply::FetchFailed { message }) = setup.open(13) else {
        panic!("not a failed fetch");
    };
    assert!(message.starts_with("fatal: "), "{message}");
}

#[test]
fn glab_missing_or_logged_out_is_answered_before_gitlab_is_asked() {
    let setup = Setup::new();
    let repository = setup.repository();
    let range_dir = setup.range_dir.path();
    let logged_out = Fake::new("logged-out");

    let missing = prepare_open(&repository, None, MergeRequestIid(13), range_dir);
    let refused = prepare_open(
        &repository,
        Some(&logged_out.glab),
        MergeRequestIid(13),
        range_dir,
    );

    assert_eq!(missing, Err(OpenReply::GlabMissing));
    assert!(
        matches!(refused, Err(OpenReply::NotLoggedIn { .. })),
        "{refused:?}"
    );
    assert_eq!(logged_out.logged("argv: "), ["argv: auth status"]);
}

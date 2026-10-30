#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    GitLabRepository, MergeRequestIid, ResolveRefusal, ResolveTarget, gitlab_repository,
    prepare_resolve,
};

use fake_glab::{Fake, in_this_repository};

const BRANCHES_START: &str = "argv: api graphql -f query=query MergeRequestBranches(";

/// `scripts/range-repo.sh`'s repository, whose `origin` is the project `taskboard/taskboard`, with the fake glab on
/// the `mr-conflicts/` scenario.
struct Setup {
    repo: TempDir,
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
            fake: Fake::new("mr-conflicts"),
        }
    }

    fn root(&self) -> PathBuf {
        self.repo.path().join("rr")
    }

    fn repository(&self) -> GitLabRepository {
        gitlab_repository(&self.root()).unwrap()
    }

    fn resolve(&self, iid: u32) -> Result<ResolveTarget, ResolveRefusal> {
        prepare_resolve(
            &self.repository(),
            Some(&self.fake.glab),
            MergeRequestIid(iid),
        )
    }

    /// What asking must leave as it was: every ref, the status and HEAD.
    fn untouched(&self) -> Vec<u8> {
        let mut seen = git_ok(&self.root(), &["for-each-ref"]).unwrap();
        seen.extend(git_ok(&self.root(), &["status", "--porcelain=v1"]).unwrap());
        seen.extend(git_ok(&self.root(), &["rev-parse", "HEAD"]).unwrap());
        seen
    }
}

#[test]
fn an_open_merge_request_names_its_branches_and_the_project_s_remote_and_changes_nothing() {
    let setup = Setup::new();
    let before = setup.untouched();

    let target = setup.resolve(21).unwrap();

    assert_eq!(
        fs::canonicalize(&target.root).unwrap(),
        fs::canonicalize(setup.root()).unwrap()
    );
    let expected = ResolveTarget {
        root: target.root.clone(),
        iid: MergeRequestIid(21),
        remote: "origin".to_owned(),
        branch: "feature/due-dates".to_owned(),
        target: "main".to_owned(),
    };
    assert_eq!(target, expected);
    assert_eq!(setup.untouched(), before);
    let asked = setup.fake.logged(BRANCHES_START);
    assert_eq!(asked.len(), 1, "{asked:?}");
    assert!(
        asked[0].ends_with(" -f fullPath=taskboard/taskboard -f iid=21"),
        "{asked:?}"
    );
}

#[test]
fn a_fork_s_merge_request_and_one_no_longer_open_are_refused() {
    let setup = Setup::new();

    assert_eq!(setup.resolve(22), Err(ResolveRefusal::FromFork));
    assert_eq!(setup.resolve(30), Err(ResolveRefusal::NotOpen));
}

#[test]
fn without_a_remote_of_the_project_there_is_nothing_to_resolve_in() {
    let setup = Setup::new();
    let other = "https://gitlab.example/other/project.git";
    git_ok(&setup.root(), &["remote", "set-url", "origin", other]).unwrap();

    let refused = setup.resolve(21);

    let project = "taskboard/taskboard".to_owned();
    assert_eq!(refused, Err(ResolveRefusal::NoRemote { project }));
}

#[test]
fn a_branch_name_naming_a_ref_to_write_is_refused() {
    let setup = Setup::new();

    let refused = setup.resolve(33);

    let message = r#"GitLab sent "feature/x:refs/heads/main" as a branch name"#.to_owned();
    assert_eq!(refused, Err(ResolveRefusal::Failed { message }));
}

#[test]
fn glab_missing_or_logged_out_is_answered_before_gitlab_is_asked() {
    let setup = Setup::new();
    let repository = setup.repository();
    let logged_out = Fake::new("logged-out");

    let missing = prepare_resolve(&repository, None, MergeRequestIid(21));
    let refused = prepare_resolve(&repository, Some(&logged_out.glab), MergeRequestIid(21));

    assert_eq!(missing, Err(ResolveRefusal::GlabMissing));
    assert!(
        matches!(refused, Err(ResolveRefusal::NotLoggedIn { .. })),
        "{refused:?}"
    );
    assert_eq!(logged_out.logged("argv: "), ["argv: auth status"]);
}

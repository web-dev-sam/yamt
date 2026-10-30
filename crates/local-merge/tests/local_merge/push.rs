use yamt_local_merge::{PushOffer, PushReply, find_live, push, start};

use crate::common::{CLEAN, Fixture, branches};

/// A clean merge yamt started, committed with git's default message, and its push offer.
fn committed_merge(fixture: &Fixture) -> PushOffer {
    start(fixture.root(), &branches(CLEAN)).unwrap();
    let live = find_live(fixture.root()).unwrap().unwrap();
    fixture.git(&["commit", "-q", "--no-edit"]);
    live.committed()
}

#[test]
fn committed_removes_the_record_and_push_sends_only_the_branch() {
    let fixture = Fixture::new();
    let gitlab_before = fixture.gitlab(&["for-each-ref"]);
    let offer = committed_merge(&fixture);
    assert_eq!(offer.branch(), CLEAN);
    assert!(!fixture.record_path().exists());
    let merge_commit = fixture.tip(CLEAN);

    let pushed = push(fixture.root(), &offer);

    assert_eq!(pushed, PushReply::Pushed);
    assert_eq!(fixture.gitlab_tip(CLEAN), merge_commit);
    let subject = fixture.gitlab(&["log", "-1", "--format=%s", CLEAN]);
    assert_eq!(
        subject,
        "Merge remote-tracking branch 'origin/main' into feature/clean"
    );
    let gitlab_after = fixture.gitlab(&["for-each-ref"]);
    let changed: Vec<&str> = gitlab_after
        .lines()
        .filter(|line| !gitlab_before.contains(line))
        .collect();
    assert_eq!(
        changed,
        [format!("{merge_commit} commit\trefs/heads/{CLEAN}")]
    );
    assert_eq!(fixture.git(&["branch", "--show-current"]), CLEAN);
}

#[test]
fn a_rejected_push_leaves_gitlab_and_the_commit() {
    let fixture = Fixture::new();
    let offer = committed_merge(&fixture);
    let merge_commit = fixture.tip(CLEAN);
    let theirs_tree = format!("{CLEAN}^{{tree}}");
    let theirs = fixture.gitlab(&["commit-tree", "-p", CLEAN, "-m", "Theirs", &theirs_tree]);
    fixture.gitlab(&["update-ref", &format!("refs/heads/{CLEAN}"), &theirs]);

    let pushed = push(fixture.root(), &offer);

    let PushReply::Failed { message } = pushed else {
        panic!("{pushed:?}");
    };
    assert!(message.starts_with("[rejected]"), "{message}");
    assert_eq!(fixture.gitlab_tip(CLEAN), theirs);
    assert_eq!(fixture.tip(CLEAN), merge_commit);
    assert_eq!(fixture.git(&["branch", "--show-current"]), CLEAN);
}

use yamt_local_merge::{BranchBefore, Leftover, ReturnTo, find_live, start};

use crate::common::{DEVELOP, DUE_DATES, Fixture, MAIN, branches};

fn started(fixture: &Fixture) {
    start(fixture.root(), &branches(DUE_DATES)).unwrap();
}

fn develop() -> ReturnTo {
    ReturnTo::Branch {
        name: DEVELOP.to_owned(),
    }
}

#[test]
fn abort_after_a_restart_returns_to_develop_and_deletes_the_created_branch() {
    let fixture = Fixture::new();
    let before = fixture.checkout();
    started(&fixture);

    let live = find_live(fixture.root()).unwrap().unwrap();
    fixture.abort_git_merge();
    let left = live.restore();

    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
    assert!(!fixture.has_branch(DUE_DATES));
    assert_eq!(fixture.config(&format!("branch.{DUE_DATES}.remote")), None);
    assert_eq!(fixture.git(&["status", "--porcelain=v1"]), "");
}

#[test]
fn abort_moves_a_fast_forwarded_branch_back() {
    let fixture = Fixture::new();
    let behind = fixture.gitlab(&["rev-parse", &format!("{DUE_DATES}~1")]);
    fixture.git(&["branch", DUE_DATES, &behind]);
    let before = fixture.checkout();
    started(&fixture);

    let live = find_live(fixture.root()).unwrap().unwrap();
    fixture.abort_git_merge();
    let left = live.restore();

    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
    assert_eq!(fixture.tip(DUE_DATES), behind);
}

#[test]
fn abort_on_the_branch_itself_resets_it_back() {
    let fixture = Fixture::new();
    let behind = fixture.gitlab(&["rev-parse", &format!("{DUE_DATES}~1")]);
    fixture.git(&["checkout", "-q", "-b", DUE_DATES, &behind]);
    let before = fixture.checkout();
    started(&fixture);

    let live = find_live(fixture.root()).unwrap().unwrap();
    assert_eq!(live.view().return_to, None);
    fixture.abort_git_merge();
    let left = live.restore();

    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
}

#[test]
fn abort_from_a_detached_head_returns_to_the_commit() {
    let fixture = Fixture::new();
    let develop_tip = fixture.tip(DEVELOP);
    fixture.git(&["checkout", "-q", "--detach", DEVELOP]);
    let before = fixture.checkout();
    started(&fixture);

    let live = find_live(fixture.root()).unwrap().unwrap();
    let id = develop_tip[..7].to_owned();
    assert_eq!(live.view().return_to, Some(ReturnTo::Commit { id }));
    fixture.abort_git_merge();
    let left = live.restore();

    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
    assert_eq!(fixture.head(), format!("HEAD {develop_tip}"));
}

#[test]
fn abort_keeps_a_branch_that_moved_after_the_merge_started() {
    let fixture = Fixture::new();
    started(&fixture);
    let live = find_live(fixture.root()).unwrap().unwrap();
    fixture.abort_git_merge();
    fixture.git(&["commit", "-q", "--allow-empty", "-m", "Mine"]);
    let mine = fixture.tip(DUE_DATES);

    let left = live.restore();

    let branch = DUE_DATES.to_owned();
    let to = develop();
    let expected = [
        Leftover::NotReturned { to },
        Leftover::BranchKept { branch },
    ];
    assert_eq!(left, expected);
    assert_eq!(fixture.head(), format!("refs/heads/{DUE_DATES} {mine}"));
    assert!(!fixture.record_path().exists());
}

#[test]
fn abort_leaves_head_where_the_user_moved_it() {
    let fixture = Fixture::new();
    started(&fixture);
    let live = find_live(fixture.root()).unwrap().unwrap();
    fixture.abort_git_merge();
    fixture.git(&["checkout", "-q", MAIN]);
    let main = fixture.tip(MAIN);

    let left = live.restore();

    assert_eq!(left, [Leftover::NotReturned { to: develop() }]);
    assert_eq!(fixture.head(), format!("refs/heads/{MAIN} {main}"));
    assert!(!fixture.has_branch(DUE_DATES));
    assert!(!fixture.record_path().exists());
}

#[test]
fn a_refused_return_is_listed_and_the_created_branch_kept_checked_out() {
    let fixture = Fixture::new();
    started(&fixture);
    let live = find_live(fixture.root()).unwrap().unwrap();
    fixture.abort_git_merge();
    fixture.write("src/board/card.ts", "mine\n");

    let left = live.restore();

    let [
        Leftover::ReturnRefused { to, message },
        Leftover::BranchCheckedOut { branch },
    ] = left.as_slice()
    else {
        panic!("{left:?}");
    };
    assert_eq!(*to, develop());
    assert!(
        message.starts_with("error: Your local changes"),
        "{message}"
    );
    assert_eq!(branch, DUE_DATES);
    assert_eq!(fixture.git(&["branch", "--show-current"]), DUE_DATES);
    assert!(!fixture.record_path().exists());
}

#[test]
fn a_refused_move_back_is_listed() {
    let fixture = Fixture::new();
    let behind = fixture.gitlab(&["rev-parse", &format!("{DUE_DATES}~1")]);
    fixture.git(&["checkout", "-q", "-b", DUE_DATES, &behind]);
    started(&fixture);
    let live = find_live(fixture.root()).unwrap().unwrap();
    let id = behind[..7].to_owned();
    assert_eq!(live.view().branch_before, BranchBefore::MovedFrom { id });
    fixture.abort_git_merge();
    fixture.write("src/board/card.ts", "mine\n");
    let tip = fixture.tip(DUE_DATES);

    let left = live.restore();

    let [Leftover::BranchRefused { branch, message }] = left.as_slice() else {
        panic!("{left:?}");
    };
    assert_eq!(branch, DUE_DATES);
    assert!(message.starts_with("error:"), "{message}");
    assert_eq!(fixture.tip(DUE_DATES), tip);
}

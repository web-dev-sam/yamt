use yamt_conflict_repo::sed_sequence_editor;
use yamt_local_merge::{MergeRequestBranches, Refusal, start};

use crate::common::{DUE_DATES, Fixture, IID, MAIN, MERGED, branches};

#[test]
fn uncommitted_tracked_changes_refuse_and_change_nothing() {
    let fixture = Fixture::new();
    fixture.write("README.md", "# Edited\n");
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    assert_eq!(started, Err(Refusal::UncommittedChanges));
    assert_eq!(fixture.checkout(), before);
}

#[test]
fn staged_changes_refuse_too() {
    let fixture = Fixture::new();
    fixture.write("README.md", "# Edited\n");
    fixture.git(&["add", "README.md"]);
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    assert_eq!(started, Err(Refusal::UncommittedChanges));
    assert_eq!(fixture.checkout(), before);
}

#[test]
fn an_untracked_file_does_not_refuse() {
    let fixture = Fixture::new();
    fixture.write("notes.txt", "mine\n");

    let started = start(fixture.root(), &branches(DUE_DATES)).unwrap();

    assert!(started.conflicts);
    assert_eq!(fixture.git(&["branch", "--show-current"]), DUE_DATES);
    let notes = std::fs::read_to_string(fixture.root().join("notes.txt")).unwrap();
    assert_eq!(notes, "mine\n");
}

#[test]
fn another_operation_in_progress_refuses() {
    let fixture = Fixture::new();
    let edit_first = sed_sequence_editor(&["1s/^pick/edit/"]);
    fixture.git(&["-c", &edit_first, "rebase", "-i", "HEAD~1"]);
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    assert_eq!(started, Err(Refusal::Busy));
    assert_eq!(fixture.checkout(), before);
    assert!(fixture.root().join(".git/rebase-merge").exists());
}

#[test]
fn a_failed_fetch_refuses_with_gits_sentence() {
    let fixture = Fixture::new();
    let before = fixture.checkout();
    let branches = MergeRequestBranches {
        iid: IID,
        remote: "nowhere".to_owned(),
        branch: DUE_DATES.to_owned(),
        target: MAIN.to_owned(),
    };

    let started = start(fixture.root(), &branches);

    let message = "fatal: 'nowhere' does not appear to be a git repository".to_owned();
    assert_eq!(started, Err(Refusal::FetchFailed { message }));
    assert_eq!(fixture.checkout(), before);
    assert_eq!(fixture.git(&["for-each-ref", "refs/remotes"]), "");
}

#[test]
fn a_local_branch_with_its_own_commit_is_refused_and_nothing_changes() {
    let fixture = Fixture::new();
    let gitlab_tip = fixture.gitlab_tip(DUE_DATES);
    let tree = format!("{gitlab_tip}^{{tree}}");
    let mine = fixture.git(&["commit-tree", "-p", &gitlab_tip, "-m", "Mine", &tree]);
    fixture.git(&["branch", DUE_DATES, &mine]);
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    let branch = DUE_DATES.to_owned();
    assert_eq!(started, Err(Refusal::LocalAhead { branch }));
    assert_eq!(fixture.checkout(), before);
    assert_eq!(fixture.tip(DUE_DATES), mine);
}

#[test]
fn a_local_branch_that_diverged_is_refused_too() {
    let fixture = Fixture::new();
    let behind = fixture.gitlab(&["rev-parse", &format!("{DUE_DATES}~1")]);
    let tree = format!("{behind}^{{tree}}");
    let mine = fixture.git(&["commit-tree", "-p", &behind, "-m", "Mine", &tree]);
    fixture.git(&["branch", DUE_DATES, &mine]);
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    let branch = DUE_DATES.to_owned();
    assert_eq!(started, Err(Refusal::LocalAhead { branch }));
    assert_eq!(fixture.checkout(), before);
}

#[test]
fn a_branch_that_already_contains_the_target_is_refused() {
    let fixture = Fixture::new();
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(MERGED));

    let (branch, target) = (MERGED.to_owned(), MAIN.to_owned());
    assert_eq!(started, Err(Refusal::AlreadyContains { branch, target }));
    assert_eq!(fixture.checkout(), before);
}

#[test]
fn a_refused_checkout_changes_nothing_and_leaves_no_record() {
    let fixture = Fixture::new();
    fixture.write("src/board/dueDates.ts", "mine\n");
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    let Err(Refusal::GitRefused { message, left }) = started else {
        panic!("{started:?}");
    };
    assert!(
        message.starts_with(
            "error: The following untracked working tree files would be overwritten by checkout"
        ),
        "{message}"
    );
    assert_eq!(left, []);
    assert_eq!(fixture.checkout(), before);
}

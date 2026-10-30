use std::fs::{self, File};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use yamt_local_merge::{
    LocalMerge, Refusal, claim_window, find_live, local_merge, start, window_is_open,
};

use crate::common::{CLEAN, DEVELOP, DUE_DATES, Fixture, IID, branches};

/// Well inside `claim_window`'s one second of patience.
const WINDOW_CLOSES_AFTER: Duration = Duration::from_millis(300);

#[test]
fn a_second_start_while_a_merge_is_in_progress_is_refused() {
    let fixture = Fixture::new();
    start(fixture.root(), &branches(DUE_DATES)).unwrap();
    let before = fixture.checkout();
    let record = fs::read(fixture.record_path()).unwrap();

    let started = start(fixture.root(), &branches(CLEAN));

    assert_eq!(started, Err(Refusal::AlreadyMerging { iid: Some(IID) }));
    assert_eq!(fixture.checkout(), before);
    assert_eq!(fs::read(fixture.record_path()).unwrap(), record);
}

#[test]
fn a_start_while_another_holds_the_lock_is_refused() {
    let fixture = Fixture::new();
    let other = File::create(fixture.start_lock_path()).unwrap();
    other.try_lock().unwrap();
    let before = fixture.checkout();

    let started = start(fixture.root(), &branches(DUE_DATES));

    assert_eq!(started, Err(Refusal::AlreadyMerging { iid: None }));
    assert_eq!(fixture.checkout(), before);
    drop(other);
    assert!(start(fixture.root(), &branches(DUE_DATES)).is_ok());
}

#[test]
fn local_merge_is_merging_only_while_git_is_in_the_recorded_merge() {
    let fixture = Fixture::new();
    assert_eq!(local_merge(fixture.root()), LocalMerge::Free);
    start(fixture.root(), &branches(DUE_DATES)).unwrap();

    let merging = local_merge(fixture.root());

    let window_open = false;
    assert_eq!(
        merging,
        LocalMerge::Merging {
            iid: IID,
            window_open
        }
    );
    fixture.abort_git_merge();
    assert!(fixture.record_path().exists());
    assert_eq!(local_merge(fixture.root()), LocalMerge::Free);
}

#[test]
fn a_stale_record_is_dropped_at_the_next_start() {
    let fixture = Fixture::new();
    start(fixture.root(), &branches(DUE_DATES)).unwrap();
    fixture.abort_git_merge();
    fixture.git(&["checkout", "-q", DEVELOP]);
    fixture.git(&["branch", "-q", "-D", DUE_DATES]);
    fixture.write("README.md", "# Edited\n");

    let started = start(fixture.root(), &branches(DUE_DATES));

    assert_eq!(started, Err(Refusal::UncommittedChanges));
    assert!(!fixture.record_path().exists());
    fixture.git(&["checkout", "-q", "--", "README.md"]);
    assert!(start(fixture.root(), &branches(DUE_DATES)).is_ok());
}

#[test]
fn an_unreadable_record_refuses_and_stays_untouched() {
    let fixture = Fixture::new();
    let unreadable = [
        ("not json", "expected ident"),
        (r#"{ "format": 2, "iid": 21 }"#, "its format 2 is newer"),
    ];
    for (content, reason) in unreadable {
        fs::write(fixture.record_path(), content).unwrap();
        let before = fixture.checkout();

        let started = start(fixture.root(), &branches(DUE_DATES));

        let Err(Refusal::RecordUnreadable { path, message }) = started else {
            panic!("{started:?}");
        };
        assert_eq!(
            fs::canonicalize(path).unwrap(),
            fs::canonicalize(fixture.record_path()).unwrap()
        );
        assert!(message.starts_with(reason), "{message}");
        assert_eq!(fixture.checkout(), before);
        assert_eq!(fs::read_to_string(fixture.record_path()).unwrap(), content);
        assert!(find_live(fixture.root()).unwrap().is_none());
        assert_eq!(local_merge(fixture.root()), LocalMerge::Free);
    }
}

#[test]
fn local_merge_names_the_merge_request_and_whether_its_window_is_open() {
    let fixture = Fixture::new();
    start(fixture.root(), &branches(DUE_DATES)).unwrap();
    assert!(!window_is_open(fixture.root()));

    let claim = claim_window(fixture.root()).unwrap().unwrap();

    let window_open = true;
    assert_eq!(
        local_merge(fixture.root()),
        LocalMerge::Merging {
            iid: IID,
            window_open
        }
    );
    drop(claim);
    let window_open = false;
    assert_eq!(
        local_merge(fixture.root()),
        LocalMerge::Merging {
            iid: IID,
            window_open
        }
    );
}

#[test]
fn a_second_claim_fails_while_the_first_is_held_and_succeeds_once_it_is_dropped() {
    let fixture = Fixture::new();
    let first = claim_window(fixture.root()).unwrap().unwrap();

    assert!(claim_window(fixture.root()).unwrap().is_none());
    assert!(window_is_open(fixture.root()));
    drop(first);
    assert!(claim_window(fixture.root()).unwrap().is_some());
}

#[test]
fn a_claim_waits_for_a_window_that_closes_within_a_second() {
    let fixture = Fixture::new();
    let first = claim_window(fixture.root()).unwrap().unwrap();

    let second = thread::scope(|scope| {
        scope.spawn(move || {
            thread::sleep(WINDOW_CLOSES_AFTER);
            drop(first);
        });
        claim_window(fixture.root()).unwrap()
    });

    assert!(second.is_some());
}

#[test]
fn window_is_open_probe_never_turns_away_a_claim() {
    let fixture = Fixture::new();
    let claimed = AtomicBool::new(false);

    let claim = thread::scope(|scope| {
        scope.spawn(|| {
            while !claimed.load(Ordering::SeqCst) {
                let _probed = window_is_open(fixture.root());
            }
        });
        let claim = claim_window(fixture.root()).unwrap();
        claimed.store(true, Ordering::SeqCst);
        claim
    });

    assert!(claim.is_some());
    assert!(window_is_open(fixture.root()));
}

#[test]
fn window_is_open_outside_a_repository_is_false() {
    let folder = tempfile::tempdir().unwrap();

    assert!(!window_is_open(folder.path()));
    assert_eq!(local_merge(folder.path()), LocalMerge::Free);
}

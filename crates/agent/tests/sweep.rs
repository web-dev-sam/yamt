#![cfg(test)]

mod common;

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use yamt_agent::sweep_other_pairs;
use yamt_range::{PairLock, RangeSpec, Resolved};

use common::Fixture;

const TAKES_DURING_SWEEPS: usize = 200;

/// A pair folder made by `PairLock::take` whose checkout a window made and then lost (dropped without
/// `end`), with a `checkout.partial` and a `checkout.removing` beside it.
struct Leftover {
    fixture: Fixture,
    folder: PathBuf,
}

impl Leftover {
    fn new() -> Leftover {
        let fixture = Fixture::new();
        let mut workspace = fixture.workspace();
        workspace.prepare();
        drop(workspace);
        let folder = fixture.pair.folder.clone();
        for leftover in ["checkout.partial", "checkout.removing"] {
            fs::create_dir_all(folder.join(leftover).join("inside")).unwrap();
        }
        Leftover { fixture, folder }
    }

    fn other_pair_folder(&self) -> PathBuf {
        self.fixture
            .range_dir
            .path()
            .join("other-0123456789abcdef")
            .join("a-b")
    }

    fn swept_from_another_pair(&self) {
        sweep_other_pairs(self.fixture.range_dir.path(), &self.other_pair_folder());
    }

    fn has(&self, name: &str) -> bool {
        self.folder.join(name).exists()
    }
}

#[test]
fn a_clean_leftover_of_an_unheld_pair_is_removed() {
    let leftover = Leftover::new();

    leftover.swept_from_another_pair();

    assert!(!leftover.has("checkout"));
    assert!(!leftover.has("checkout.partial"));
    assert!(!leftover.has("checkout.removing"));
}

#[test]
fn a_changed_leftover_is_kept() {
    let leftover = Leftover::new();
    let checkout = leftover.fixture.checkout();
    fs::write(checkout.join("a.txt"), b"edited\n").unwrap();

    leftover.swept_from_another_pair();

    assert_eq!(fs::read(checkout.join("a.txt")).unwrap(), b"edited\n");
    assert!(!leftover.has("checkout.partial"));
    assert!(!leftover.has("checkout.removing"));
}

#[test]
fn a_leftover_of_a_held_pair_is_untouched() {
    let leftover = Leftover::new();
    let _window = PairLock::try_hold(&leftover.folder).unwrap().unwrap();

    leftover.swept_from_another_pair();

    assert!(leftover.has("checkout"));
    assert!(leftover.has("checkout.partial"));
    assert!(leftover.has("checkout.removing"));
}

#[test]
fn the_own_pair_keeps_its_checkout_and_loses_partial_and_removing_folders() {
    let leftover = Leftover::new();
    let _own = PairLock::try_hold(&leftover.folder).unwrap().unwrap();

    leftover.fixture.workspace().remove_own_leftovers();

    assert!(leftover.has("checkout"));
    assert!(!leftover.has("checkout.partial"));
    assert!(!leftover.has("checkout.removing"));
}

#[test]
fn the_sweep_of_other_pairs_leaves_the_own_pair_alone_even_when_its_lock_is_free() {
    let leftover = Leftover::new();

    sweep_other_pairs(leftover.fixture.range_dir.path(), &leftover.folder);

    assert!(leftover.has("checkout"));
    assert!(leftover.has("checkout.partial"));
    assert!(leftover.has("checkout.removing"));
}

#[test]
fn a_take_during_a_sweep_of_a_pair_with_nothing_to_sweep_succeeds() {
    let fixture = Fixture::new();
    let range_dir = fixture.range_dir.path();
    let empty = range_dir.join("empty-0123456789abcdef").join("c-d");
    fs::create_dir_all(&empty).unwrap();
    let spec = RangeSpec::parse("main..remote").unwrap();
    let resolved = Resolved::resolve(&fixture.pair.repo, &spec).unwrap();
    let sweeping = AtomicBool::new(true);

    thread::scope(|scope| {
        scope.spawn(|| {
            let other = range_dir.join("other-0123456789abcdef").join("a-b");
            while sweeping.load(Ordering::Relaxed) {
                sweep_other_pairs(range_dir, &other);
            }
        });
        let refused = (0..TAKES_DURING_SWEEPS)
            .filter(|_| PairLock::take(range_dir, &resolved).is_err())
            .count();
        sweeping.store(false, Ordering::Relaxed);
        assert_eq!(refused, 0);
    });

    assert!(!empty.join("lock").exists());
}

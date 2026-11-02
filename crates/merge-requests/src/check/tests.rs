use std::sync::atomic::{AtomicUsize, Ordering};

use super::*;
use crate::Readiness;

/// Far above a thread's start-up, far below a test's patience.
const SLOW_MERGE: Duration = Duration::from_millis(150);
const QUICK_MERGE: Duration = Duration::from_millis(10);

fn oid(digit: char) -> Oid {
    Oid::parse(&digit.to_string().repeat(40)).unwrap()
}

fn pair(target: char, source: char) -> Pair {
    Pair {
        target: oid(target),
        source: oid(source),
    }
}

fn row(iid: u32, target_branch: &str, head: Option<char>) -> RowToCheck {
    RowToCheck {
        iid: MergeRequestIid(iid),
        target_branch: target_branch.to_owned(),
        head: head.map(oid),
        gitlab: GitLabMerge::read(Some("CHECKING"), false, false),
    }
}

/// The pairs `on_merged` got, in its order, and how many merges started.
fn scheduled(
    pairs: &[Pair],
    limit: Duration,
    merge: &(dyn Fn(&Pair) -> Result<MergeOutcome, String> + Sync),
) -> (Vec<Pair>, u32) {
    let mut finished = Vec::new();
    let mut on_merged = |pair: &Pair, _: Result<MergeOutcome, String>| finished.push(pair.clone());
    let started = merged_in_finishing_order(pairs, limit, merge, &mut on_merged);
    (finished, started)
}

#[test]
fn a_summary_reads_as_its_counts_and_then_its_problem() {
    let summary = CheckSummary {
        rows: 9,
        merges: 5,
        fetched_refs: 1,
        remembered: 0,
        moving: 1,
        kept: 1,
        problem: None,
    };
    let words = "9 rows: 5 merges, 1 refs fetched, 0 remembered, 1 moving, 1 kept";
    assert_eq!(summary.to_string(), words);

    let stopped = CheckSummary {
        problem: Some("ls-remote: fatal: no such remote".to_owned()),
        ..summary
    };
    let with_problem = format!("{words}; ls-remote: fatal: no such remote");
    assert_eq!(stopped.to_string(), with_problem);
}

#[test]
fn merges_run_two_at_a_time_and_every_result_comes_back_with_its_pair() {
    let running = AtomicUsize::new(0);
    let most = AtomicUsize::new(0);
    let merge = |pair: &Pair| {
        let now = running.fetch_add(1, Ordering::SeqCst) + 1;
        most.fetch_max(now, Ordering::SeqCst);
        thread::sleep(QUICK_MERGE);
        running.fetch_sub(1, Ordering::SeqCst);
        Ok(outcome_of(pair))
    };
    let pairs = [
        pair('1', 'a'),
        pair('1', 'b'),
        pair('2', 'a'),
        pair('2', 'b'),
        pair('3', 'c'),
    ];
    let mut results = Vec::new();
    let mut on_merged = |pair: &Pair, merged| results.push((pair.clone(), merged));

    let started = merged_in_finishing_order(&pairs, MERGE_PHASE_LIMIT, &merge, &mut on_merged);

    assert_eq!((started, most.load(Ordering::SeqCst)), (5, MERGES_AT_ONCE));
    assert_eq!(results.len(), pairs.len());
    for pair in pairs {
        let merged = (pair.clone(), Ok(outcome_of(&pair)));
        assert!(results.contains(&merged), "{pair:?}: {results:?}");
    }
}

/// What the fake merges of the scheduler tests answer: a conflict for the source `a`.
fn outcome_of(pair: &Pair) -> MergeOutcome {
    if pair.source == oid('a') {
        MergeOutcome::Conflicts
    } else {
        MergeOutcome::Clean
    }
}

#[test]
fn results_arrive_in_finishing_order_not_in_the_order_given() {
    let slow = pair('1', 'a');
    let merge = |pair: &Pair| {
        thread::sleep(if *pair == slow {
            SLOW_MERGE
        } else {
            QUICK_MERGE
        });
        Ok(MergeOutcome::Clean)
    };
    let pairs = [slow.clone(), pair('1', 'b'), pair('1', 'c')];

    let (finished, started) = scheduled(&pairs, MERGE_PHASE_LIMIT, &merge);

    assert_eq!(started, 3);
    assert_eq!(finished, [pair('1', 'b'), pair('1', 'c'), slow]);
}

#[test]
fn no_merge_starts_once_the_limit_has_passed() {
    let merge = |_: &Pair| {
        thread::sleep(SLOW_MERGE);
        Ok(MergeOutcome::Clean)
    };
    let pairs = [
        pair('1', 'a'),
        pair('1', 'b'),
        pair('1', 'c'),
        pair('1', 'd'),
    ];

    let (finished, started) = scheduled(&pairs, QUICK_MERGE, &merge);
    assert_eq!((finished.len(), started), (2, 2));

    let (none, not_started) = scheduled(&pairs, Duration::ZERO, &merge);
    assert_eq!((none, not_started), (Vec::new(), 0));
}

#[test]
fn a_failed_merge_comes_back_as_its_error() {
    let merge = |_: &Pair| Err("merge-tree: not something we can merge".to_owned());
    let mut results = Vec::new();
    let mut on_merged = |_: &Pair, merged| results.push(merged);

    merged_in_finishing_order(&[pair('1', 'a')], MERGE_PHASE_LIMIT, &merge, &mut on_merged);

    assert_eq!(
        results,
        [Err("merge-tree: not something we can merge".to_owned())]
    );
}

#[test]
fn each_target_is_asked_once_a_target_holding_a_colon_or_of_a_row_without_a_head_never() {
    let rows = [
        row(1, "main", Some('a')),
        row(2, "main:refs/heads/x", Some('b')),
        row(3, "develop", Some('c')),
        row(4, "main", Some('d')),
        row(5, "release", None),
    ];

    let patterns = remote_ref_patterns(&rows);

    assert_eq!(
        patterns,
        [
            "refs/heads/main",
            "refs/heads/develop",
            "refs/merge-requests/*/head"
        ]
    );
}

#[test]
fn a_row_is_paired_only_when_its_target_and_head_ref_are_advertised_and_the_head_ref_is_gitlab_s_head()
 {
    let rows = [
        row(1, "main", Some('a')),
        row(2, "main", Some('b')),
        row(3, "gone", Some('c')),
        row(4, "main", Some('d')),
        row(5, "main", None),
    ];
    let advertised = HashMap::from([
        (b"refs/heads/main".to_vec(), oid('1')),
        (b"refs/merge-requests/1/head".to_vec(), oid('a')),
        (b"refs/merge-requests/2/head".to_vec(), oid('e')),
        (b"refs/merge-requests/3/head".to_vec(), oid('c')),
        (b"refs/merge-requests/5/head".to_vec(), oid('f')),
    ]);
    let mut summary = CheckSummary::default();

    let paired = paired_rows(&rows, &advertised, &mut summary);

    let paired: Vec<(u32, Pair)> = paired
        .into_iter()
        .map(|(row, pair)| (row.iid.0, pair))
        .collect();
    assert_eq!(paired, [(1, pair('1', 'a'))]);
    assert_eq!(summary.moving, 1);
}

#[test]
fn only_missing_commits_are_fetched_each_by_its_ref_once() {
    let rows = [
        row(1, "main", Some('a')),
        row(2, "main", Some('b')),
        row(3, "develop", Some('a')),
    ];
    let paired: Vec<PairedRow> = vec![
        (&rows[0], pair('1', 'a')),
        (&rows[1], pair('1', 'b')),
        (&rows[2], pair('2', 'a')),
    ];
    let missing = HashSet::from([oid('1'), oid('a')]);

    let refspecs = refspecs_for(&paired, &missing);

    let expected = [
        "refs/heads/main",
        "refs/merge-requests/1/head",
        "refs/merge-requests/3/head",
    ];
    assert_eq!(refspecs, expected);
}

#[test]
fn after_a_failed_fetch_only_rows_whose_two_commits_are_local_stay() {
    let rows = [
        row(1, "main", Some('a')),
        row(2, "develop", Some('b')),
        row(3, "main", Some('c')),
    ];
    let paired: Vec<PairedRow> = vec![
        (&rows[0], pair('1', 'a')),
        (&rows[1], pair('2', 'b')),
        (&rows[2], pair('1', 'c')),
    ];
    let missing = HashSet::from([oid('2'), oid('c')]);

    let local = with_local_commits(paired, &missing);

    let local: Vec<u32> = local.into_iter().map(|(row, _)| row.iid.0).collect();
    assert_eq!(local, [1]);
}

#[test]
fn a_row_is_sent_only_when_the_merge_changes_its_readiness() {
    let (sender, sent) = mpsc::channel();
    let on_checked = |row: CheckedRow| sender.send(row).unwrap();
    let ready = RowToCheck {
        gitlab: GitLabMerge::read(Some("MERGEABLE"), false, false),
        ..row(1, "main", Some('a'))
    };

    send_if_changed(&ready, MergeOutcome::Clean, &on_checked);
    send_if_changed(&ready, MergeOutcome::Conflicts, &on_checked);

    let conflicts = Readiness::Conflicts { also: Vec::new() };
    let expected = CheckedRow {
        iid: MergeRequestIid(1),
        readiness: conflicts,
    };
    assert_eq!(sent.try_iter().collect::<Vec<_>>(), [expected]);
}

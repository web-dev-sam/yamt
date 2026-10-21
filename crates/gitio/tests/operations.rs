#![cfg(test)]

use std::path::{Path, PathBuf};

use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_TWO_FILE, TempDir, diverged_repo, git, git_ok, operation_repo,
};
use yamt_gitio::{Oid, Operation, Progress, Rebase, Repo, Stop};

const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "cart.ts",
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn stopped(run: Run) -> (TempDir, Repo) {
    let dir = operation_repo(run, &FILES).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    (dir, repo)
}

fn oid(root: &Path, revision: &str) -> Oid {
    let output = git_ok(root, &["rev-parse", "--verify", revision]).unwrap();
    Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
}

fn git_path(root: &Path, name: &str) -> PathBuf {
    let path = git_ok(root, &["rev-parse", "--git-path", name]).unwrap();
    root.join(String::from_utf8(path).unwrap().trim_end())
}

fn operation(repo: &Repo) -> Operation {
    repo.stop().unwrap().operation.unwrap()
}

fn progress_of(stop: &Stop) -> Option<Progress> {
    match stop.operation.as_ref().unwrap() {
        Operation::Rebase(rebase) => rebase.progress,
        Operation::CherryPick { progress, .. }
        | Operation::Revert { progress, .. }
        | Operation::Am { progress, .. } => *progress,
        Operation::Merge { .. } | Operation::SquashMerge { .. } => None,
    }
}

// A `--continue` that reaches the next conflict exits non-zero, as the first stop did.
fn resolve_and_continue(root: &Path, command: &str) {
    let [step_one] = FILES;
    git_ok(root, &["add", "--", step_one.path]).unwrap();
    let next_stop = git(root, &[command, "--continue"]).unwrap();
    assert!(!next_stop.status.success(), "{command} --continue finished");
}

fn rebase_of(run: Run, root: &Path) -> Rebase {
    Rebase {
        branch: Some(b"remote".to_vec()),
        onto: Some(oid(root, "local")),
        replaying: Some(oid(root, "remote~2")),
        redoing_merge: None,
        progress: Progress::new(1, 3),
        editor_steps_ahead: run == Run::RebaseInteractive,
    }
}

#[test]
fn merge_reads_merge_head_and_head() {
    let (dir, repo) = stopped(Run::Merge);
    let stop = repo.stop().unwrap();
    let merging = oid(dir.path(), "remote");
    assert_eq!(stop.operation, Some(Operation::Merge { merging }));
    assert_eq!(stop.head, Some(oid(dir.path(), "local")));
}

// `SQUASH_MSG` lists the squashed commits newest first: the merged commit is its first `commit` line.
#[test]
fn squash_merge_without_merge_head_reads_the_squashed_tip_not_none() {
    let (dir, repo) = stopped(Run::SquashMerge);
    let merging = Some(oid(dir.path(), "remote"));
    assert_ne!(merging, Some(oid(dir.path(), "remote~2")));
    assert_eq!(operation(&repo), Operation::SquashMerge { merging });
}

#[test]
fn each_rebase_backend_reads_branch_onto_and_the_replayed_commit() {
    for run in [Run::Rebase, Run::RebaseApply, Run::RebaseInteractive] {
        let (dir, repo) = stopped(run);
        let expected = Operation::Rebase(rebase_of(run, dir.path()));
        assert_eq!(operation(&repo), expected, "{run:?}");
    }
}

#[test]
fn rebase_apply_without_applying_is_a_rebase_not_am() {
    let (_dir, repo) = stopped(Run::RebaseApply);
    assert!(matches!(operation(&repo), Operation::Rebase(_)));
}

// MERGE_HEAD comes first in git's order only when no rebase runs: a `rebase -r` merge step is a rebase.
#[test]
fn rebase_merges_redoing_a_merge_is_a_rebase_with_redoing_merge_not_a_merge() {
    let (dir, repo) = stopped(Run::RebaseMerges);
    let Operation::Rebase(rebase) = operation(&repo) else {
        panic!("not a rebase");
    };
    assert_eq!(rebase.redoing_merge, Some(oid(dir.path(), "remote")));
    assert_eq!(rebase.replaying, Some(oid(dir.path(), "merged")));
    assert_eq!(rebase.branch, Some(b"merged".to_vec()));
    assert_eq!(rebase.onto, Some(oid(dir.path(), "local")));
}

#[test]
fn single_cherry_pick_reads_the_picked_commit_without_progress() {
    let (dir, repo) = stopped(Run::CherryPick);
    let picking = Some(oid(dir.path(), "remote~2"));
    let progress = None;
    assert_eq!(
        operation(&repo),
        Operation::CherryPick { picking, progress }
    );
}

#[test]
fn cherry_pick_range_reads_the_picked_commit_and_the_sequence_progress() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    let picking = Some(oid(dir.path(), "remote~2"));
    let progress = Progress::new(1, 3);
    assert_eq!(
        operation(&repo),
        Operation::CherryPick { picking, progress }
    );
}

#[test]
fn single_revert_reads_the_reverted_commit_without_progress() {
    let (dir, repo) = stopped(Run::Revert);
    let reverting = Some(oid(dir.path(), "HEAD~1"));
    let progress = None;
    assert_eq!(
        operation(&repo),
        Operation::Revert {
            reverting,
            progress
        }
    );
}

// git's own status falls back to the sequencer's next command once the pick or revert head is gone.
#[test]
fn a_sequence_without_its_head_ref_is_read_from_the_sequencer_todo() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    git_ok(dir.path(), &["update-ref", "-d", "CHERRY_PICK_HEAD"]).unwrap();
    let progress = Progress::new(1, 3);
    let picking = None;
    assert_eq!(
        operation(&repo),
        Operation::CherryPick { picking, progress }
    );

    let (dir, repo) = stopped(Run::RevertRange);
    git_ok(dir.path(), &["update-ref", "-d", "REVERT_HEAD"]).unwrap();
    let reverting = None;
    assert_eq!(
        operation(&repo),
        Operation::Revert {
            reverting,
            progress
        }
    );
}

#[test]
fn revert_range_reads_the_reverted_commit_and_the_sequence_progress() {
    let (dir, repo) = stopped(Run::RevertRange);
    let reverting = Some(oid(dir.path(), "HEAD~1"));
    let progress = Progress::new(1, 3);
    assert_eq!(
        operation(&repo),
        Operation::Revert {
            reverting,
            progress
        }
    );
}

// A pick range started on an unborn branch saves the zero oid as its start.
#[test]
fn a_sequence_start_that_is_not_a_commit_gives_no_progress() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    let zero = "0000000000000000000000000000000000000000\n";
    std::fs::write(git_path(dir.path(), "sequencer/head"), zero).unwrap();
    let picking = Some(oid(dir.path(), "remote~2"));
    let progress = None;
    assert_eq!(
        operation(&repo),
        Operation::CherryPick { picking, progress }
    );
}

// The sequencer's todo belongs to the stopped range, not to the single revert run inside it.
#[test]
fn a_single_revert_inside_a_stopped_pick_range_has_no_progress() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    std::fs::write(dir.path().join("cart.ts"), "resolved\n").unwrap();
    git_ok(dir.path(), &["commit", "--quiet", "--all", "--no-edit"]).unwrap();
    let reverting = Some(oid(dir.path(), "local~1"));

    let revert = git(dir.path(), &["revert", "--no-edit", "local~1"]).unwrap();

    assert!(!revert.status.success(), "the revert did not stop");
    let progress = None;
    assert_eq!(
        operation(&repo),
        Operation::Revert {
            reverting,
            progress
        }
    );
}

// `cherry-pick -n` makes no commits, so `sequencer/head..HEAD` does not count the steps done.
#[test]
fn a_no_commit_pick_range_has_no_progress() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    let root = dir.path();
    git_ok(root, &["cherry-pick", "--abort"]).unwrap();
    git_ok(root, &["checkout", "--quiet", "-b", "other", "main"]).unwrap();
    std::fs::write(root.join(STEP_TWO_FILE), "other\n").unwrap();
    git_ok(root, &["commit", "--quiet", "--all", "-m", "other"]).unwrap();

    let pick = git(root, &["cherry-pick", "-n", "main..remote"]).unwrap();

    assert!(!pick.status.success(), "the pick range did not stop");
    let progress = None;
    let picking = None;
    assert_eq!(
        operation(&repo),
        Operation::CherryPick { picking, progress }
    );
}

// rebase-apply/ with `applying` is `am`, not the apply backend's rebase.
#[test]
fn am_reads_the_patch_subject_and_whole_message() {
    let (_dir, repo) = stopped(Run::Am);
    let expected = Operation::Am {
        subject: b"step 1".to_vec(),
        message: b"step 1\n\nThe first step's body.\n".to_vec(),
        progress: Progress::new(1, 3),
    };
    assert_eq!(operation(&repo), expected);
}

#[test]
fn stash_pop_conflicts_and_a_repository_without_conflicts_record_no_operation() {
    let (dir, repo) = stopped(Run::StashPop);
    assert_eq!(repo.unmerged().unwrap().len(), 3);
    let stop = repo.stop().unwrap();
    assert_eq!(stop.operation, None);
    assert_eq!(stop.head, Some(oid(dir.path(), "local")));

    let dir = diverged_repo(&FILES).unwrap();
    let stop = Repo::discover(dir.path()).unwrap().stop().unwrap();
    assert_eq!(stop.operation, None);
    assert_eq!(stop.head, Some(oid(dir.path(), "local")));
}

// Off by one, or a count of commits instead of git's own step number.
#[test]
fn rebase_progress_moves_from_step_one_to_step_two_of_three_in_both_backends() {
    for run in [Run::Rebase, Run::RebaseApply] {
        let (dir, repo) = stopped(run);
        let second = oid(dir.path(), "remote~1");
        assert_eq!(progress_of(&repo.stop().unwrap()), Progress::new(1, 3));

        resolve_and_continue(dir.path(), "rebase");

        let Operation::Rebase(rebase) = operation(&repo) else {
            panic!("{run:?} is no longer a rebase");
        };
        assert_eq!(rebase.progress, Progress::new(2, 3), "{run:?}");
        assert_eq!(rebase.replaying, Some(second), "{run:?}");
    }
}

// git keeps no `done` file for a sequence; the stopped command is still in `todo`.
#[test]
fn cherry_pick_range_progress_moves_from_one_to_two_of_three() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    let second = Some(oid(dir.path(), "remote~1"));

    resolve_and_continue(dir.path(), "cherry-pick");

    let progress = Progress::new(2, 3);
    let expected = Operation::CherryPick {
        picking: second,
        progress,
    };
    assert_eq!(operation(&repo), expected);
}

#[test]
fn revert_range_progress_moves_from_one_to_two_of_three() {
    let (dir, repo) = stopped(Run::RevertRange);
    let second = Some(oid(dir.path(), "HEAD~2"));

    resolve_and_continue(dir.path(), "revert");

    let progress = Progress::new(2, 3);
    let expected = Operation::Revert {
        reverting: second,
        progress,
    };
    assert_eq!(operation(&repo), expected);
}

#[test]
fn am_progress_moves_from_patch_one_to_two_of_three() {
    let (dir, repo) = stopped(Run::Am);

    resolve_and_continue(dir.path(), "am");

    let Operation::Am {
        subject, progress, ..
    } = operation(&repo)
    else {
        panic!("no longer am");
    };
    assert_eq!(subject, b"step 2");
    assert_eq!(progress, Progress::new(2, 3));
}

// A reword ahead would be committed without its editor by a Continue that runs `GIT_EDITOR=:`.
#[test]
fn editor_steps_ahead_only_for_the_interactive_rebase_with_a_reword_left() {
    for (run, expected) in [
        (Run::RebaseInteractive, true),
        (Run::Rebase, false),
        (Run::RebaseApply, false),
    ] {
        let (_dir, repo) = stopped(run);
        let Operation::Rebase(rebase) = operation(&repo) else {
            panic!("{run:?} is not a rebase");
        };
        assert_eq!(rebase.editor_steps_ahead, expected, "{run:?}");
    }
}

#[test]
fn two_reads_of_one_stop_give_equal_ids() {
    for run in [Run::Merge, Run::Rebase, Run::CherryPickRange, Run::Am] {
        let (_dir, repo) = stopped(run);
        assert_eq!(
            repo.stop().unwrap().id(),
            repo.stop().unwrap().id(),
            "{run:?}"
        );
    }
}

// A missed move would let a write meant for one stop land on the next one.
#[test]
fn continue_to_the_next_stop_gives_a_different_id() {
    for (run, command) in [
        (Run::Rebase, "rebase"),
        (Run::RebaseApply, "rebase"),
        (Run::CherryPickRange, "cherry-pick"),
        (Run::RevertRange, "revert"),
        (Run::Am, "am"),
    ] {
        let (dir, repo) = stopped(run);
        let first = repo.stop().unwrap().id();

        resolve_and_continue(dir.path(), command);

        assert_ne!(repo.stop().unwrap().id(), first, "{run:?}");
    }
}

// A refusal read as a move would drop the user's edits at a stop that did not change.
#[test]
fn a_refused_continue_keeps_the_id() {
    for (run, command) in [
        (Run::Rebase, "rebase"),
        (Run::CherryPickRange, "cherry-pick"),
        (Run::Am, "am"),
    ] {
        let (dir, repo) = stopped(run);
        let first = repo.stop().unwrap();

        let refused = git(dir.path(), &[command, "--continue"]).unwrap();

        assert!(!refused.status.success(), "{run:?} continued");
        assert_eq!(repo.stop().unwrap().id(), first.id(), "{run:?}");
    }
}

// A plain rebase's `Stop` does not change when a pick is dropped; dropping the reword changes `editor_steps_ahead`.
#[test]
fn edit_todo_dropping_a_later_step_keeps_the_id() {
    let (dir, repo) = stopped(Run::RebaseInteractive);
    let first = repo.stop().unwrap();
    let drop_the_reword = "sequence.editor=sed -i -e /^reword/d";

    git_ok(
        dir.path(),
        &["-c", drop_the_reword, "rebase", "--edit-todo"],
    )
    .unwrap();

    let edited = repo.stop().unwrap();
    let steps_ahead = |stop: &Stop| {
        let Some(Operation::Rebase(rebase)) = &stop.operation else {
            panic!("{stop:?} is not a rebase");
        };
        rebase.editor_steps_ahead
    };
    assert!(steps_ahead(&first));
    assert!(!steps_ahead(&edited));
    assert_eq!(edited.id(), first.id());
}

// A `.git/` path instead of `rev-parse --git-path` reads the main checkout's state in a linked worktree.
#[test]
fn a_linked_worktree_reads_its_own_rebase_and_the_main_checkout_none() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let linked = root.join("linked");
    let linked_arg = linked.to_str().unwrap();
    let add = [
        "worktree", "add", "--quiet", "--detach", linked_arg, "remote",
    ];
    git_ok(root, &add).unwrap();
    assert!(!git(&linked, &["rebase", "local"]).unwrap().status.success());

    let linked_stop = Repo::discover(&linked).unwrap().stop().unwrap();

    let expected = Rebase {
        branch: None,
        onto: Some(oid(root, "local")),
        replaying: Some(oid(root, "remote")),
        redoing_merge: None,
        progress: Progress::new(1, 1),
        editor_steps_ahead: false,
    };
    assert_eq!(linked_stop.operation, Some(Operation::Rebase(expected)));
    assert_eq!(
        Repo::discover(root).unwrap().stop().unwrap().operation,
        None
    );
}

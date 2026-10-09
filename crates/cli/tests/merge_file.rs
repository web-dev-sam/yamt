#![cfg(test)]

use std::fs;
use std::process::Command;

use proptest::collection::vec;
use proptest::option;
use proptest::prelude::*;
use proptest::sample::{Index, select};
use proptest::strategy::ValueTree;
use proptest::test_runner::{TestCaseError, TestRunner};
use tempfile::TempDir;
use yamt_merge_core::{ChunkKind, Options, apply_non_conflicting, compute_chunks};

const LINES: [&str; 5] = ["x\n", "x\r\n", "\n", "y\n", "z\n"];
const LAST_LINES: [&str; 3] = ["", "x", "y"];
const MAX_LINES: usize = 10;
const MAX_EDITS: usize = 3;
const CASES: u32 = 512;
const MIN_BOTH_CLEAN_PERCENT: u32 = 25;
const MAX_ONLY_GIT_CONFLICT_PERCENT: u32 = 1;
const PERCENT: u32 = 100;
// Exit status is the conflict count capped at 127; errors are negative, i.e. 255 (git-merge-file(1)).
const MAX_GIT_CONFLICT_EXIT: i32 = 127;

#[derive(Clone, Debug)]
enum Edit {
    Insert(&'static str),
    Delete,
    Replace(&'static str),
}

#[derive(Clone, Debug)]
struct Doc {
    lines: Vec<&'static str>,
    last: &'static str,
}

impl Doc {
    fn text(&self) -> String {
        let mut text = self.lines.concat();
        text.push_str(self.last);
        text
    }

    fn edited(&self, edits: &[(Index, Edit)], last: Option<&'static str>) -> Doc {
        let mut lines = self.lines.clone();
        for (at, edit) in edits {
            match *edit {
                Edit::Insert(line) => lines.insert(at.index(lines.len() + 1), line),
                Edit::Delete if !lines.is_empty() => {
                    lines.remove(at.index(lines.len()));
                }
                Edit::Replace(line) if !lines.is_empty() => {
                    let replaced = at.index(lines.len());
                    lines[replaced] = line;
                }
                Edit::Delete | Edit::Replace(_) => {}
            }
        }
        Doc {
            lines,
            last: last.unwrap_or(self.last),
        }
    }
}

#[derive(Clone, Debug)]
struct Triple {
    base: String,
    local: String,
    remote: String,
}

fn line() -> impl Strategy<Value = &'static str> {
    select(LINES.to_vec())
}

fn last_line() -> impl Strategy<Value = &'static str> {
    select(LAST_LINES.to_vec())
}

fn doc() -> impl Strategy<Value = Doc> {
    (vec(line(), 0..MAX_LINES), last_line()).prop_map(|(lines, last)| Doc { lines, last })
}

fn edits() -> impl Strategy<Value = Vec<(Index, Edit)>> {
    let edit = prop_oneof![
        line().prop_map(Edit::Insert),
        Just(Edit::Delete),
        line().prop_map(Edit::Replace),
    ];
    vec((any::<Index>(), edit), 0..MAX_EDITS)
}

fn triple() -> impl Strategy<Value = Triple> {
    let derived = (
        doc(),
        edits(),
        option::of(last_line()),
        edits(),
        option::of(last_line()),
    )
        .prop_map(
            |(base, local_edits, local_last, remote_edits, remote_last)| Triple {
                local: base.edited(&local_edits, local_last).text(),
                remote: base.edited(&remote_edits, remote_last).text(),
                base: base.text(),
            },
        );
    let shared = (doc(), edits(), option::of(last_line()), edits(), edits()).prop_map(
        |(base, shared_edits, shared_last, local_edits, remote_edits)| {
            let common = base.edited(&shared_edits, shared_last);
            Triple {
                local: common.edited(&local_edits, None).text(),
                remote: common.edited(&remote_edits, None).text(),
                base: base.text(),
            }
        },
    );
    prop_oneof![derived, shared]
}

struct GitMerge {
    exit_code: Option<i32>,
    stdout: String,
}

fn git_merge_file(triple: &Triple) -> GitMerge {
    let dir = TempDir::new().unwrap();
    for (name, text) in [
        ("local", &triple.local),
        ("base", &triple.base),
        ("remote", &triple.remote),
    ] {
        fs::write(dir.path().join(name), text).unwrap();
    }
    let output = Command::new("git")
        .current_dir(dir.path())
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("LC_ALL", "C")
        .args([
            "merge-file",
            "-p",
            "--diff-algorithm=histogram",
            "local",
            "base",
            "remote",
        ])
        .output()
        .unwrap();
    GitMerge {
        exit_code: output.status.code(),
        stdout: String::from_utf8(output.stdout).unwrap(),
    }
}

#[derive(Clone, Copy, Debug)]
enum Agreement {
    BothClean,
    BothConflict,
    OnlyGitConflicts,
    OnlyYamtConflicts,
}

fn cross_check(triple: &Triple) -> Result<Agreement, TestCaseError> {
    let chunks = compute_chunks(
        &triple.base,
        &triple.local,
        &triple.remote,
        &Options::default(),
    );
    let yamt_clean = !chunks.iter().any(|chunk| chunk.kind == ChunkKind::Conflict);
    let git = git_merge_file(triple);
    prop_assert!(
        matches!(git.exit_code, Some(0..=MAX_GIT_CONFLICT_EXIT)),
        "git merge-file failed: {:?}",
        git.exit_code
    );
    let git_clean = git.exit_code == Some(0);
    match (yamt_clean, git_clean) {
        (true, true) => {
            let ours = apply_non_conflicting(&triple.base, &triple.local, &triple.remote, &chunks);
            prop_assert_eq!(&ours, &git.stdout, "{:?}\nchunks: {:?}", triple, chunks);
            Ok(Agreement::BothClean)
        }
        (false, false) => Ok(Agreement::BothConflict),
        (true, false) => Ok(Agreement::OnlyGitConflicts),
        (false, true) => Ok(Agreement::OnlyYamtConflicts),
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(CASES))]

    #[test]
    fn merge_equals_git_merge_file_when_both_are_conflict_free(triple in triple()) {
        cross_check(&triple)?;
    }
}

#[test]
fn enough_generated_triples_are_clean_for_both_to_exercise_the_cross_check() {
    let mut runner = TestRunner::deterministic();
    let strategy = triple();
    let mut both_clean = 0;
    let mut both_conflict = 0;
    let mut only_git_conflicts = 0;
    let mut only_yamt_conflicts = 0;
    for _ in 0..CASES {
        let triple = strategy.new_tree(&mut runner).unwrap().current();
        match cross_check(&triple).unwrap() {
            Agreement::BothClean => both_clean += 1,
            Agreement::BothConflict => both_conflict += 1,
            Agreement::OnlyGitConflicts => only_git_conflicts += 1,
            Agreement::OnlyYamtConflicts => only_yamt_conflicts += 1,
        }
    }
    eprintln!(
        "of {CASES}: both clean {both_clean}, both conflict {both_conflict}, \
         yamt clean/git conflict {only_git_conflicts}, yamt conflict/git clean {only_yamt_conflicts}"
    );
    assert!(
        both_clean * PERCENT >= CASES * MIN_BOTH_CLEAN_PERCENT,
        "only {both_clean} of {CASES} triples were clean for both yamt and git"
    );
    assert!(
        only_git_conflicts * PERCENT <= CASES * MAX_ONLY_GIT_CONFLICT_PERCENT,
        "{only_git_conflicts} of {CASES} triples were clean for yamt but conflicted in git"
    );
}

#![cfg(test)]

use std::fs;
use std::path::Path;
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
const MAX_ALIGNED_DIFFERENTLY_PERCENT: u32 = 3;
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

fn hermetic_git(dir: &Path) -> Command {
    let mut command = Command::new("git");
    command
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("LC_ALL", "C")
        .env_remove("GIT_CONFIG_PARAMETERS")
        .env_remove("GIT_CONFIG_COUNT")
        .args(["-c", "core.attributesFile=/dev/null"]);
    command
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
    let output = hermetic_git(dir.path())
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

#[derive(Debug, PartialEq, Eq)]
struct Span {
    start: u32,
    len: u32,
}

#[derive(Debug, PartialEq, Eq)]
struct Hunk {
    base: Span,
    side: Span,
}

fn yamt_hunks(base: &str, side: &str) -> Vec<Hunk> {
    compute_chunks(base, side, side, &Options { gap: 0 })
        .iter()
        .map(|chunk| Hunk {
            base: Span {
                start: chunk.base.start.0,
                len: chunk.base.len,
            },
            side: Span {
                start: chunk.local.start.0,
                len: chunk.local.len,
            },
        })
        .collect()
}

fn git_hunks(base: &str, side: &str) -> Vec<Hunk> {
    let dir = TempDir::new().unwrap();
    fs::write(dir.path().join("base"), base).unwrap();
    fs::write(dir.path().join("side"), side).unwrap();
    let output = hermetic_git(dir.path())
        .args([
            "diff",
            "--no-index",
            "--no-color",
            "--histogram",
            "--no-indent-heuristic",
            "-U0",
            "base",
            "side",
        ])
        .output()
        .unwrap();
    assert!(
        matches!(output.status.code(), Some(0 | 1)),
        "git diff failed: {output:?}"
    );
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .filter_map(|line| line.strip_prefix("@@ -"))
        .map(parsed_hunk_header)
        .collect()
}

fn parsed_hunk_header(ranges_and_rest: &str) -> Hunk {
    let (ranges, _) = ranges_and_rest.split_once(" @@").unwrap();
    let (base, side) = ranges.split_once(" +").unwrap();
    Hunk {
        base: parsed_span(base),
        side: parsed_span(side),
    }
}

fn parsed_span(range: &str) -> Span {
    let (start, len) = range.split_once(',').unwrap_or((range, "1"));
    let start: u32 = start.parse().unwrap();
    let len: u32 = len.parse().unwrap();
    // 1-based; an empty range names the line before it (diffutils manual, "Detailed Unified").
    let start = if len == 0 { start } else { start - 1 };
    Span { start, len }
}

fn is_aligned_alike(triple: &Triple) -> bool {
    [&triple.local, &triple.remote]
        .into_iter()
        .all(|side| yamt_hunks(&triple.base, side) == git_hunks(&triple.base, side))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Agreement {
    BothClean,
    AlignedDifferently,
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
        (true, true) if !is_aligned_alike(triple) => Ok(Agreement::AlignedDifferently),
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
fn sample_is_often_clean_for_both_and_rarely_clean_only_for_yamt() {
    let mut runner = TestRunner::deterministic();
    let strategy = triple();
    let mut both_clean = 0;
    let mut aligned_differently = 0;
    let mut both_conflict = 0;
    let mut only_git_conflicts = 0;
    let mut only_yamt_conflicts = 0;
    for _ in 0..CASES {
        let triple = strategy.new_tree(&mut runner).unwrap().current();
        match cross_check(&triple).unwrap() {
            Agreement::BothClean => both_clean += 1,
            Agreement::AlignedDifferently => aligned_differently += 1,
            Agreement::BothConflict => both_conflict += 1,
            Agreement::OnlyGitConflicts => only_git_conflicts += 1,
            Agreement::OnlyYamtConflicts => only_yamt_conflicts += 1,
        }
    }
    eprintln!(
        "of {CASES}: both clean {both_clean}, both clean but aligned differently {aligned_differently}, \
         both conflict {both_conflict}, yamt clean/git conflict {only_git_conflicts}, \
         yamt conflict/git clean {only_yamt_conflicts}"
    );
    assert!(
        both_clean * PERCENT >= CASES * MIN_BOTH_CLEAN_PERCENT,
        "only {both_clean} of {CASES} triples were clean for both yamt and git"
    );
    assert!(
        only_git_conflicts * PERCENT <= CASES * MAX_ONLY_GIT_CONFLICT_PERCENT,
        "{only_git_conflicts} of {CASES} triples were clean for yamt but conflicted in git"
    );
    assert!(
        aligned_differently * PERCENT <= CASES * MAX_ALIGNED_DIFFERENTLY_PERCENT,
        "{aligned_differently} of {CASES} clean triples were aligned differently by yamt and git"
    );
}

fn assert_yamt_merges_to_and_git_differs(triple: &Triple, expected: &str) {
    let chunks = compute_chunks(
        &triple.base,
        &triple.local,
        &triple.remote,
        &Options::default(),
    );
    let ours = apply_non_conflicting(&triple.base, &triple.local, &triple.remote, &chunks);
    assert_eq!(ours, expected);
    assert_ne!(
        git_merge_file(triple).stdout,
        ours,
        "git now merges this triple like yamt"
    );
    assert_eq!(cross_check(triple).unwrap(), Agreement::AlignedDifferently);
}

#[test]
fn both_branches_dropping_one_of_three_equal_lines_keeps_two() {
    let triple = Triple {
        base: "\nx\r\ny\ny\ny\nx\nx".to_owned(),
        local: "\nx\nx\r\nx\r\ny\ny\nx\nx".to_owned(),
        remote: "\nx\r\ny\ny\nx\nx".to_owned(),
    };
    // git places the two sides' changes at different copies of a repeated line.
    assert_yamt_merges_to_and_git_differs(&triple, &triple.local);
}

#[test]
fn remote_that_is_local_plus_a_line_merges_to_remote() {
    let triple = Triple {
        base: "x\r\nz\nx\r\nx\r\n".to_owned(),
        local: "x\r\nz\nz\nx\r\nz\nx\r\n".to_owned(),
        remote: "x\nx\r\nz\nz\nx\r\nz\nx\r\n".to_owned(),
    };
    // git places the two sides' changes at different copies of a repeated line.
    assert_yamt_merges_to_and_git_differs(&triple, &triple.remote);
}

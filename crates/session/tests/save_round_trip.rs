#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::{ConflictFile, FileKind, Setup, TempDir, conflict_repo_with};
use yamt_merge_core::{ChunkKind, LineRange};
use yamt_session::{FileMergeData, MergeChunk, MergeSession, Middle, Waiting, WriteReply};

mod listing;
use listing::listed;
mod samples;
use samples::{BASE, OURS, THEIRS, WORKED_MIDDLE, with_block_resolved};
mod window;
use window::{middle_text, saved_with_everything_waiting};

const GOLDEN_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/golden");
const SAMPLE: &str = "sample.txt";

struct Case {
    path: String,
    sides: [Vec<u8>; 3],
}

fn golden_cases() -> Vec<Case> {
    let mut cases = Vec::new();
    for entry in fs::read_dir(GOLDEN_DIR).unwrap() {
        let dir = entry.unwrap().path();
        if !dir.is_dir() {
            continue;
        }
        let base = side_file(&dir, "base");
        let extension = base.extension().unwrap().to_str().unwrap().to_owned();
        let read = |name: &str| fs::read(dir.join(format!("{name}.{extension}"))).unwrap();
        let name = dir.file_name().unwrap().to_str().unwrap().to_owned();
        cases.push(Case {
            path: format!("{name}.{extension}"),
            sides: [read("base"), read("local"), read("remote")],
        });
    }
    cases.sort_by(|a, b| a.path.cmp(&b.path));
    cases
}

fn side_file(dir: &Path, side: &str) -> PathBuf {
    let files = fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().path());
    let mut found = files.filter(|file| file.file_stem().unwrap() == side);
    found.next().unwrap()
}

fn repo(path: &str, sides: [&[u8]; 3], style: &str) -> TempDir {
    let [base, local, remote] = sides;
    let file = ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(base),
        local: Some(local),
        remote: Some(remote),
    };
    let setup = Setup {
        config: &[("merge.conflictStyle", style)],
        ..Setup::default()
    };
    conflict_repo_with(&[file], &setup).unwrap()
}

fn opened(dir: &TempDir) -> MergeSession {
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(listed(&mut session).disk_changes, []);
    session
}

/// A second run of yamt on the repository: open, the first look, and the file's data.
fn loaded_again(dir: &TempDir, path: &str) -> FileMergeData {
    let mut session = MergeSession::open(dir.path()).unwrap();
    listed(&mut session);
    session.load(path).unwrap()
}

type Ranges = ((u32, u32), (u32, u32));

fn conflict_ranges(chunks: &[MergeChunk]) -> Vec<Ranges> {
    let conflicts = chunks
        .iter()
        .filter(|chunk| chunk.chunk.kind == ChunkKind::Conflict);
    conflicts.map(side_ranges).collect()
}

fn side_ranges(chunk: &MergeChunk) -> Ranges {
    let LineRange { start, len } = chunk.chunk.local;
    let remote = chunk.chunk.remote;
    ((start.0, len), (remote.start.0, remote.len))
}

fn is_markers(chunk: &MergeChunk) -> bool {
    matches!(chunk.waiting, Waiting::Markers { .. })
}

#[test]
fn every_golden_saved_with_everything_waiting_opens_again_untouched_or_with_the_same_conflicts() {
    for style in ["merge", "diff3"] {
        for case in golden_cases() {
            let [base, local, remote] = &case.sides;
            let dir = repo(&case.path, [base, local, remote], style);
            let mut session = opened(&dir);
            let data = session.load(&case.path).unwrap();
            let saved = saved_with_everything_waiting(&data);

            let reply = session.save(&case.path, &saved, data.disk_version).unwrap();

            assert!(matches!(reply, WriteReply::Written { .. }), "{reply:?}");
            drop(session);
            let again = loaded_again(&dir, &case.path);
            let context = format!("{} in {style} style", case.path);
            match &again.middle {
                Middle::Stages { .. } => assert_eq!(again.chunks, data.chunks, "{context}"),
                Middle::Disk { .. } => {
                    let expected = conflict_ranges(&data.chunks);
                    assert_eq!(conflict_ranges(&again.chunks), expected, "{context}");
                    assert!(again.chunks.iter().all(is_markers), "{context}");
                }
                Middle::DiskNotText { found } => panic!("{context}: {found:?}"),
            }
        }
    }
}

/// The sample merged in merge style with its second block taken from theirs, and the first block
/// given to `first_block`.
fn sample_saved_as(first_block: fn(&str) -> String) -> (TempDir, String) {
    let dir = repo(SAMPLE, [BASE, OURS, THEIRS].map(str::as_bytes), "merge");
    let mut session = opened(&dir);
    let data = session.load(SAMPLE).unwrap();
    let git_output = fs::read_to_string(dir.path().join(SAMPLE)).unwrap();
    let saved = first_block(&with_block_resolved(&git_output, 1, "eight-theirs\n"));
    session.save(SAMPLE, &saved, data.disk_version).unwrap();
    (dir, saved)
}

fn first_block_of(saved: &str) -> String {
    let start = saved.find("<<<<<<<").unwrap();
    let close = saved[start..].find(">>>>>>>").unwrap() + start;
    let end = saved[close..].find('\n').unwrap() + close + 1;
    saved[start..end].to_owned()
}

#[test]
fn a_conflict_with_its_local_section_applied_but_not_edited_comes_back_exactly_placed() {
    let (dir, _) = sample_saved_as(str::to_owned);

    let again = loaded_again(&dir, SAMPLE);

    assert!(matches!(again.middle, Middle::Disk { .. }), "{again:?}");
    assert_eq!(middle_text(&again), WORKED_MIDDLE);
    let [chunk] = &again.chunks[..] else {
        panic!("expected one chunk: {:?}", again.chunks);
    };
    assert!(is_markers(chunk), "{chunk:?}");
    assert_eq!(side_ranges(chunk), ((2, 4), (2, 4)));
}

#[test]
fn a_conflict_with_an_ignored_or_edited_section_comes_back_raw_with_both_sections() {
    let ignored_local: fn(&str) -> String =
        |text| text.replacen("one\nTWO\nshared-a\nthree-ours\n", "one\ntwo\nthree\n", 1);
    let edited_remote: fn(&str) -> String =
        |text| text.replacen("three-theirs\n", "three-theirs, edited\n", 1);

    for first_block in [ignored_local, edited_remote] {
        let (dir, saved) = sample_saved_as(first_block);

        let again = loaded_again(&dir, SAMPLE);

        let [chunk] = &again.chunks[..] else {
            panic!("expected one chunk: {:?}", again.chunks);
        };
        assert_eq!(chunk.waiting, Waiting::AsShown);
        let block = first_block_of(&saved);
        let middle = middle_text(&again);
        let start = chunk.middle.start.0 as usize;
        let shown: Vec<&str> = middle.split_inclusive('\n').collect();
        let shown = shown[start..start + chunk.middle.len as usize].concat();
        assert_eq!(shown, block);
    }
}

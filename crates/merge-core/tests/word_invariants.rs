use proptest::collection::vec;
use proptest::option;
use proptest::prelude::*;
use proptest::sample::Index;
use yamt_merge_core::{
    BaseLine, Chunk, ChunkId, ChunkKind, LineRange, LocalLine, Options, RemoteLine,
    SideWordChanges, compute_chunks, word_changes,
};

const LINE: &str = "[ab_é😀 \t(;\r]{0,6}(\n|\r\n)";
const LAST_LINE: &str = "[ab_é😀 \t(;]{0,4}";
const MAX_LINES: usize = 8;
const MAX_EDITS: usize = 4;
const CASES: u32 = 512;

#[derive(Clone, Debug)]
enum Edit {
    Insert(String),
    Delete,
    Replace(String),
}

#[derive(Clone, Debug)]
struct Doc {
    lines: Vec<String>,
    last: String,
}

impl Doc {
    fn text(&self) -> String {
        self.lines.concat() + &self.last
    }

    fn edited(&self, edits: &[(Index, Edit)], last: Option<String>) -> Doc {
        let mut lines = self.lines.clone();
        for (at, edit) in edits {
            match edit {
                Edit::Insert(line) => lines.insert(at.index(lines.len() + 1), line.clone()),
                Edit::Delete if !lines.is_empty() => {
                    lines.remove(at.index(lines.len()));
                }
                Edit::Replace(line) if !lines.is_empty() => {
                    let replaced = at.index(lines.len());
                    lines[replaced].clone_from(line);
                }
                Edit::Delete | Edit::Replace(_) => {}
            }
        }
        Doc {
            lines,
            last: last.unwrap_or_else(|| self.last.clone()),
        }
    }
}

#[derive(Clone, Debug)]
struct Triple {
    base: String,
    local: String,
    remote: String,
}

fn doc() -> impl Strategy<Value = Doc> {
    (vec(LINE, 0..MAX_LINES), LAST_LINE).prop_map(|(lines, last)| Doc { lines, last })
}

fn edits() -> impl Strategy<Value = Vec<(Index, Edit)>> {
    let edit = prop_oneof![
        LINE.prop_map(Edit::Insert),
        Just(Edit::Delete),
        LINE.prop_map(Edit::Replace),
    ];
    vec((any::<Index>(), edit), 0..MAX_EDITS)
}

fn triple() -> impl Strategy<Value = Triple> {
    (
        doc(),
        edits(),
        option::of(LAST_LINE),
        edits(),
        option::of(LAST_LINE),
    )
        .prop_map(
            |(base, local_edits, local_last, remote_edits, remote_last)| Triple {
                local: base.edited(&local_edits, local_last).text(),
                remote: base.edited(&remote_edits, remote_last).text(),
                base: base.text(),
            },
        )
}

fn content(line: &str) -> &str {
    line.strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line)
}

#[derive(Debug, PartialEq)]
struct PlainSide {
    ranges: Vec<(u32, u32, u32)>,
    removals: Vec<(u32, u32, String)>,
}

fn nothing() -> PlainSide {
    PlainSide {
        ranges: Vec::new(),
        removals: Vec::new(),
    }
}

fn plain<L: Copy>(side: &SideWordChanges<L>, index: fn(L) -> u32) -> PlainSide {
    PlainSide {
        ranges: side
            .changed
            .iter()
            .map(|range| (index(range.line), range.start, range.len))
            .collect(),
        removals: side
            .removals
            .iter()
            .map(|removal| {
                (
                    index(removal.at.line),
                    removal.at.column,
                    removal.text.clone(),
                )
            })
            .collect(),
    }
}

fn is_char_boundary(line: &str, column: u32) -> bool {
    let units: Vec<u16> = content(line).encode_utf16().collect();
    units
        .get(..column as usize)
        .is_some_and(|prefix| String::from_utf16(prefix).is_ok())
}

fn check_side(side: &PlainSide, text: &str, chunk_lines: (u32, u32)) -> Result<(), TestCaseError> {
    let lines: Vec<&str> = text.split_inclusive('\n').collect();
    let (first, len) = chunk_lines;
    let in_chunk = |line: u32| line >= first && line < first + len;
    for &(line, start, range_len) in &side.ranges {
        prop_assert!(in_chunk(line), "{side:?} {chunk_lines:?}");
        let line_text = lines[line as usize];
        prop_assert!(
            is_char_boundary(line_text, start) && is_char_boundary(line_text, start + range_len),
            "{side:?} {text:?}"
        );
        prop_assert!(range_len > 0, "{side:?}");
    }
    for pair in side.ranges.windows(2) {
        let ((line, start, len), (next_line, next_start, _)) = (pair[0], pair[1]);
        prop_assert!(
            line < next_line || (line == next_line && start + len < next_start),
            "{side:?}"
        );
    }
    for (line, column, _) in &side.removals {
        prop_assert!(in_chunk(*line), "{side:?} {chunk_lines:?}");
        prop_assert!(
            is_char_boundary(lines[*line as usize], *column),
            "{side:?} {text:?}"
        );
    }
    prop_assert!(
        side.removals
            .windows(2)
            .all(|pair| (pair[0].0, pair[0].1) < (pair[1].0, pair[1].1)),
        "{side:?}"
    );
    Ok(())
}

fn without_whitespace(text: &str) -> String {
    text.chars().filter(|c| !c.is_whitespace()).collect()
}

/// Each text is non-empty and, whitespace aside, a contiguous part of the chunk's base text; its
/// `k` line breaks cut it into `k + 1` parts, of which the first `k` or the last `k` are `k`
/// consecutive whole base lines.
fn check_texts(side: &PlainSide, base_lines: &[&str]) -> Result<(), TestCaseError> {
    let base_contents: Vec<&str> = base_lines.iter().map(|line| content(line)).collect();
    let base_text = without_whitespace(&base_lines.concat());
    for (_, _, text) in &side.removals {
        prop_assert!(!text.is_empty(), "{side:?}");
        prop_assert!(
            base_text.contains(&without_whitespace(text)),
            "{text:?} {base_lines:?}"
        );
        let parts: Vec<&str> = text.split('\n').collect();
        let breaks = parts.len() - 1;
        if breaks > 0 {
            let is_whole_lines =
                |lines: &[&str]| base_contents.windows(breaks).any(|window| window == lines);
            prop_assert!(
                is_whole_lines(&parts[..breaks]) || is_whole_lines(&parts[1..]),
                "{text:?} {base_lines:?}"
            );
        }
    }
    Ok(())
}

fn chunk_lines(text: &str, first: u32, len: u32) -> Vec<&str> {
    let lines = text.split_inclusive('\n').skip(first as usize);
    lines.take(len as usize).collect()
}

fn without_ranges(text: &str, first: u32, len: u32, ranges: &[(u32, u32, u32)]) -> Option<String> {
    let mut kept = String::new();
    for (line, line_text) in (0..).zip(text.split_inclusive('\n')) {
        if line < first || line >= first + len {
            continue;
        }
        let mut units: Vec<Option<u16>> = line_text.encode_utf16().map(Some).collect();
        for &(_, start, range_len) in ranges.iter().filter(|range| range.0 == line) {
            units[start as usize..(start + range_len) as usize].fill(None);
        }
        let rest: Vec<u16> = units.into_iter().flatten().collect();
        kept += &String::from_utf16(&rest).ok()?;
    }
    Some(kept.chars().filter(|c| !c.is_whitespace()).collect())
}

fn is_subsequence(part: &str, whole: &str) -> bool {
    let mut whole = whole.chars();
    part.chars()
        .all(|wanted| whole.any(|character| character == wanted))
}

fn whole_text_chunk(text: &str) -> Chunk {
    let len: u32 = text.split_inclusive('\n').map(|_| 1).sum();
    Chunk {
        id: ChunkId(0),
        kind: ChunkKind::Conflict,
        base: LineRange {
            start: BaseLine(0),
            len,
        },
        local: LineRange {
            start: LocalLine(0),
            len,
        },
        remote: LineRange {
            start: RemoteLine(0),
            len,
        },
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(CASES))]

    #[test]
    fn every_mark_lies_sorted_and_disjoint_on_a_line_of_its_chunk(triple in triple()) {
        let Triple { base, local, remote } = &triple;
        let chunks = compute_chunks(base, local, remote, &Options::default());
        let words = word_changes(base, local, remote, &chunks);
        prop_assert_eq!(words.len(), chunks.len());
        for (chunk, change) in chunks.iter().zip(&words) {
            prop_assert_eq!(change.chunk, chunk.id);
            check_side(&plain(&change.local, |line| line.0), local, (chunk.local.start.0, chunk.local.len))?;
            check_side(&plain(&change.remote, |line| line.0), remote, (chunk.remote.start.0, chunk.remote.len))?;
        }
    }

    #[test]
    fn unmarked_side_text_is_in_base_in_order(triple in triple()) {
        let Triple { base, local, .. } = &triple;
        let chunks = compute_chunks(base, local, base, &Options::default());
        for (chunk, change) in chunks.iter().zip(word_changes(base, local, base, &chunks)) {
            prop_assert_eq!(plain(&change.remote, |line| line.0), nothing());
            let local_rest = without_ranges(local, chunk.local.start.0, chunk.local.len, &plain(&change.local, |line| line.0).ranges);
            let base_rest = without_ranges(base, chunk.base.start.0, chunk.base.len, &[]);
            let (Some(local_rest), Some(base_rest)) = (local_rest, base_rest) else {
                return Err(TestCaseError::fail("a range splits a character"));
            };
            if chunk.base.is_empty() {
                prop_assert!(change.local.changed.is_empty() && change.local.removals.is_empty());
            } else {
                prop_assert!(is_subsequence(&local_rest, &base_rest), "{local_rest:?} {base_rest:?}");
            }
        }
    }

    #[test]
    fn every_removal_text_is_base_text_of_its_chunk(triple in triple()) {
        let Triple { base, local, remote } = &triple;
        let chunks = compute_chunks(base, local, remote, &Options::default());
        for (chunk, change) in chunks.iter().zip(word_changes(base, local, remote, &chunks)) {
            let base_lines = chunk_lines(base, chunk.base.start.0, chunk.base.len);
            check_texts(&plain(&change.local, |line| line.0), &base_lines)?;
            check_texts(&plain(&change.remote, |line| line.0), &base_lines)?;
        }
    }

    #[test]
    fn both_same_chunks_give_both_sides_equal_marks(triple in triple()) {
        let Triple { base, local, .. } = &triple;
        let chunks = compute_chunks(base, local, local, &Options::default());
        for change in word_changes(base, local, local, &chunks) {
            prop_assert_eq!(plain(&change.local, |line| line.0), plain(&change.remote, |line| line.0));
        }
    }

    #[test]
    fn identical_texts_give_no_marks(text in doc()) {
        let text = text.text();
        prop_assert!(word_changes(&text, &text, &text, &compute_chunks(&text, &text, &text, &Options::default())).is_empty());
        let whole = whole_text_chunk(&text);
        for change in word_changes(&text, &text, &text, &[whole]) {
            prop_assert_eq!(plain(&change.local, |line| line.0), nothing());
            prop_assert_eq!(plain(&change.remote, |line| line.0), nothing());
        }
    }
}

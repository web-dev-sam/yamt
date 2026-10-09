use proptest::collection::vec;
use proptest::option;
use proptest::prelude::*;
use proptest::sample::Index;
use yamt_merge_core::{
    BaseLine, Chunk, ChunkId, ChunkKind, InlineRange, LineRange, LocalLine, Options, RemoteLine,
    compute_chunks, word_changes,
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

fn plain<L: Copy>(ranges: &[InlineRange<L>], index: fn(L) -> u32) -> Vec<(u32, u32, u32)> {
    ranges
        .iter()
        .map(|range| (index(range.line), range.start, range.len))
        .collect()
}

fn check_side(
    ranges: &[(u32, u32, u32)],
    text: &str,
    chunk_lines: (u32, u32),
) -> Result<(), TestCaseError> {
    let lines: Vec<&str> = text.split_inclusive('\n').collect();
    let (first, len) = chunk_lines;
    for &(line, start, range_len) in ranges {
        prop_assert!(
            line >= first && line < first + len,
            "{ranges:?} {chunk_lines:?}"
        );
        let width = content(lines[line as usize]).encode_utf16().count();
        prop_assert!((start + range_len) as usize <= width, "{ranges:?} {text:?}");
        prop_assert!(range_len > 0, "{ranges:?}");
    }
    for pair in ranges.windows(2) {
        let ((line, start, len), (next_line, next_start, _)) = (pair[0], pair[1]);
        prop_assert!(line < next_line || start + len < next_start, "{ranges:?}");
    }
    Ok(())
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
    fn every_range_lies_sorted_and_disjoint_on_a_line_of_its_chunk(triple in triple()) {
        let Triple { base, local, remote } = &triple;
        let chunks = compute_chunks(base, local, remote, &Options::default());
        let words = word_changes(base, local, remote, &chunks);
        prop_assert_eq!(words.len(), chunks.len());
        for (chunk, change) in chunks.iter().zip(&words) {
            prop_assert_eq!(change.chunk, chunk.id);
            check_side(&plain(&change.local, |line| line.0), local, (chunk.local.start.0, chunk.local.len))?;
            check_side(&plain(&change.base, |line| line.0), base, (chunk.base.start.0, chunk.base.len))?;
            check_side(&plain(&change.remote, |line| line.0), remote, (chunk.remote.start.0, chunk.remote.len))?;
        }
    }

    #[test]
    fn removing_ranges_then_whitespace_leaves_both_texts_equal(triple in triple()) {
        let Triple { base, local, .. } = &triple;
        let chunks = compute_chunks(base, local, base, &Options::default());
        for (chunk, change) in chunks.iter().zip(word_changes(base, local, base, &chunks)) {
            prop_assert!(change.remote.is_empty());
            if chunk.base.is_empty() || chunk.local.is_empty() {
                prop_assert!(change.local.is_empty() && change.base.is_empty());
                continue;
            }
            let local_rest = without_ranges(local, chunk.local.start.0, chunk.local.len, &plain(&change.local, |line| line.0));
            let base_rest = without_ranges(base, chunk.base.start.0, chunk.base.len, &plain(&change.base, |line| line.0));
            prop_assert!(local_rest.is_some() && base_rest.is_some(), "a range splits a character");
            prop_assert_eq!(local_rest, base_rest);
        }
    }

    #[test]
    fn both_same_chunks_give_both_sides_equal_ranges(triple in triple()) {
        let Triple { base, local, .. } = &triple;
        let chunks = compute_chunks(base, local, local, &Options::default());
        for change in word_changes(base, local, local, &chunks) {
            prop_assert_eq!(plain(&change.local, |line| line.0), plain(&change.remote, |line| line.0));
        }
    }

    #[test]
    fn identical_texts_give_no_ranges(text in doc()) {
        let text = text.text();
        prop_assert!(word_changes(&text, &text, &text, &compute_chunks(&text, &text, &text, &Options::default())).is_empty());
        let whole = whole_text_chunk(&text);
        for change in word_changes(&text, &text, &text, &[whole]) {
            prop_assert!(change.local.is_empty() && change.base.is_empty() && change.remote.is_empty());
        }
    }
}

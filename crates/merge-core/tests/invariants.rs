use proptest::collection::vec;
use proptest::option;
use proptest::prelude::*;
use proptest::sample::{Index, select};
use yamt_merge_core::{Chunk, ChunkId, ChunkKind, Options, apply_non_conflicting, compute_chunks};

const LINES: [&str; 5] = ["x\n", "x\r\n", "\n", "y\n", "z\n"];
const LAST_LINES: [&str; 3] = ["", "x", "y"];
const MAX_LINES: usize = 10;
const MAX_EDITS: usize = 4;
const MAX_GAP: u32 = 3;
const CASES: u32 = 512;

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
    let independent = (doc(), doc(), doc()).prop_map(|(base, local, remote)| Triple {
        base: base.text(),
        local: local.text(),
        remote: remote.text(),
    });
    prop_oneof![4 => derived, 1 => independent]
}

struct Lines<'a> {
    base: Vec<&'a str>,
    local: Vec<&'a str>,
    remote: Vec<&'a str>,
}

impl<'a> Lines<'a> {
    fn of(triple: &'a Triple) -> Lines<'a> {
        Lines {
            base: triple.base.split_inclusive('\n').collect(),
            local: triple.local.split_inclusive('\n').collect(),
            remote: triple.remote.split_inclusive('\n').collect(),
        }
    }

    fn base(&self, chunk: &Chunk) -> String {
        slice(&self.base, chunk.base.start.0, chunk.base.len)
    }

    fn local(&self, chunk: &Chunk) -> String {
        slice(&self.local, chunk.local.start.0, chunk.local.len)
    }

    fn remote(&self, chunk: &Chunk) -> String {
        slice(&self.remote, chunk.remote.start.0, chunk.remote.len)
    }

    fn replace_chunks(&self, chunks: &[Chunk], replacement: impl Fn(&Chunk) -> String) -> String {
        let mut rebuilt = String::new();
        let mut next_base_line = 0;
        for chunk in chunks {
            rebuilt += &slice(
                &self.base,
                next_base_line,
                chunk.base.start.0 - next_base_line,
            );
            rebuilt += &replacement(chunk);
            next_base_line = chunk.base.end().0;
        }
        rebuilt + &self.base[next_base_line as usize..].concat()
    }
}

fn slice(lines: &[&str], start: u32, len: u32) -> String {
    lines[start as usize..(start + len) as usize].concat()
}

fn chunks_of(triple: &Triple, gap: u32) -> Vec<Chunk> {
    compute_chunks(
        &triple.base,
        &triple.local,
        &triple.remote,
        &Options { gap },
    )
}

fn kinds(base: &str, local: &str, remote: &str) -> Vec<ChunkKind> {
    let chunks = compute_chunks(base, local, remote, &Options::default());
    chunks.iter().map(|chunk| chunk.kind).collect()
}

fn line_count(text: &str) -> usize {
    text.split_inclusive('\n').count()
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(CASES))]

    #[test]
    fn chunks_are_indexed_sorted_and_separated_in_all_three_texts(triple in triple(), gap in 0..MAX_GAP) {
        let chunks = chunks_of(&triple, gap);
        for (index, chunk) in (0..).zip(&chunks) {
            prop_assert_eq!(chunk.id, ChunkId(index));
        }
        for pair in chunks.windows(2) {
            prop_assert!(pair[0].base.end() < pair[1].base.start, "{:?}", pair);
            prop_assert!(pair[0].local.end() < pair[1].local.start, "{:?}", pair);
            prop_assert!(pair[0].remote.end() < pair[1].remote.start, "{:?}", pair);
        }
        if let Some(last) = chunks.last() {
            prop_assert!(last.base.end().0 as usize <= line_count(&triple.base));
            prop_assert!(last.local.end().0 as usize <= line_count(&triple.local));
            prop_assert!(last.remote.end().0 as usize <= line_count(&triple.remote));
        }
    }

    #[test]
    fn replacing_base_ranges_with_side_lines_rebuilds_each_side(triple in triple(), gap in 0..MAX_GAP) {
        let chunks = chunks_of(&triple, gap);
        let lines = Lines::of(&triple);
        prop_assert_eq!(lines.replace_chunks(&chunks, |chunk| lines.local(chunk)), triple.local.clone());
        prop_assert_eq!(lines.replace_chunks(&chunks, |chunk| lines.remote(chunk)), triple.remote.clone());
    }

    #[test]
    fn non_conflict_chunks_leave_the_other_side_equal(triple in triple(), gap in 0..MAX_GAP) {
        let lines = Lines::of(&triple);
        for chunk in chunks_of(&triple, gap) {
            match chunk.kind {
                ChunkKind::LocalOnly => prop_assert_eq!(lines.remote(&chunk), lines.base(&chunk)),
                ChunkKind::RemoteOnly => prop_assert_eq!(lines.local(&chunk), lines.base(&chunk)),
                ChunkKind::BothSame => prop_assert_eq!(lines.local(&chunk), lines.remote(&chunk)),
                ChunkKind::Conflict => {}
            }
        }
    }

    #[test]
    fn an_unchanged_side_yields_only_the_other_sides_kind(triple in triple()) {
        let Triple { base, local, remote } = &triple;
        prop_assert!(kinds(base, base, remote).iter().all(|kind| *kind == ChunkKind::RemoteOnly));
        prop_assert!(kinds(base, local, base).iter().all(|kind| *kind == ChunkKind::LocalOnly));
        prop_assert!(!kinds(base, local, local).contains(&ChunkKind::Conflict));
    }

    #[test]
    fn apply_non_conflicting_takes_the_only_changed_side(triple in triple()) {
        let Triple { base, local, remote } = &triple;
        let apply = |local: &str, remote: &str| {
            apply_non_conflicting(base, local, remote, &compute_chunks(base, local, remote, &Options::default()))
        };
        prop_assert_eq!(&apply(base, remote), remote);
        prop_assert_eq!(&apply(local, base), local);
        prop_assert_eq!(&apply(local, local), local);
    }

    #[test]
    fn add_add_yields_one_chunk_at_line_zero(local in doc(), remote in doc(), gap in 0..MAX_GAP) {
        let (local, remote) = (local.text(), remote.text());
        prop_assume!(!local.is_empty() && !remote.is_empty());
        for remote in [&remote, &local] {
            let chunks = compute_chunks("", &local, remote, &Options { gap });
            prop_assert_eq!(chunks.len(), 1);
            prop_assert_eq!(chunks[0].base.start.0, 0);
            prop_assert!(chunks[0].base.is_empty());
            let expected = if &local == remote { ChunkKind::BothSame } else { ChunkKind::Conflict };
            prop_assert_eq!(chunks[0].kind, expected);
        }
    }

    #[test]
    fn every_chunk_is_a_real_change(triple in triple(), gap in 0..MAX_GAP) {
        let lines = Lines::of(&triple);
        for chunk in chunks_of(&triple, gap) {
            match chunk.kind {
                ChunkKind::LocalOnly | ChunkKind::BothSame => prop_assert_ne!(lines.local(&chunk), lines.base(&chunk)),
                ChunkKind::RemoteOnly => prop_assert_ne!(lines.remote(&chunk), lines.base(&chunk)),
                ChunkKind::Conflict => prop_assert_ne!(lines.local(&chunk), lines.remote(&chunk)),
            }
        }
    }
}

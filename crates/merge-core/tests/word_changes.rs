use yamt_merge_core::{
    BaseLine, ChunkId, ChunkKind, InlineRange, LocalLine, Options, RemoteLine, WordChanges,
    compute_chunks, word_changes,
};

type Ranges<'a> = &'a [(u32, u32, u32)];

fn ranges<L>(line_of: fn(u32) -> L, expected: Ranges) -> Vec<InlineRange<L>> {
    expected
        .iter()
        .map(|&(line, start, len)| InlineRange {
            line: line_of(line),
            start,
            len,
        })
        .collect()
}

fn expected(local: Ranges, base: Ranges, remote: Ranges) -> WordChanges {
    WordChanges {
        chunk: ChunkId(0),
        local: ranges(LocalLine, local),
        base: ranges(BaseLine, base),
        remote: ranges(RemoteLine, remote),
    }
}

fn only_chunk_words(base: &str, local: &str, remote: &str) -> (ChunkKind, WordChanges) {
    let chunks = compute_chunks(base, local, remote, &Options::default());
    let mut changes = word_changes(base, local, remote, &chunks);
    assert_eq!(chunks.len(), 1, "{chunks:?}");
    assert_eq!(changes.len(), 1);
    (chunks[0].kind, changes.remove(0))
}

#[test]
fn one_changed_word_is_one_range_on_the_changed_side_and_base() {
    let base = "foo(a, b)\n";
    let (kind, words) = only_chunk_words(base, "foo(a, c)\n", base);
    assert_eq!(kind, ChunkKind::LocalOnly);
    assert_eq!(words, expected(&[(0, 7, 1)], &[(0, 7, 1)], &[]));
}

#[test]
fn two_changed_words_separated_by_a_space_become_one_range() {
    let base = "a old words z\n";
    let (kind, words) = only_chunk_words(base, base, "a new terms z\n");
    assert_eq!(kind, ChunkKind::RemoteOnly);
    assert_eq!(words, expected(&[], &[(0, 2, 9)], &[(0, 2, 9)]));
}

#[test]
fn changed_words_on_later_lines_of_a_chunk_carry_their_own_line() {
    let base = "head\nalpha\nbeta gamma\ntail\n";
    let (_, words) = only_chunk_words(base, "head\nALPHA\nbeta delta\ntail\n", base);
    assert_eq!(
        words,
        expected(&[(1, 0, 5), (2, 5, 5)], &[(1, 0, 5), (2, 5, 5)], &[])
    );
}

#[test]
fn a_line_added_inside_a_modified_chunk_is_a_full_line_range_without_its_break() {
    let base = "a\nb\n";
    let (_, words) = only_chunk_words(base, "a!\nnew line\nb\n", base);
    assert_eq!(words, expected(&[(0, 1, 1), (1, 0, 8)], &[], &[]));
}

#[test]
fn columns_count_utf16_code_units_of_a_non_ascii_prefix() {
    let base = "é😀 x\n";
    let (_, words) = only_chunk_words(base, "é😀 yy\n", base);
    assert_eq!(words, expected(&[(0, 4, 2)], &[(0, 4, 1)], &[]));
}

#[test]
fn crlf_line_breaks_stay_outside_every_range() {
    let base = "keep\r\nold value\r\n";
    let (_, words) = only_chunk_words(base, "keep\r\nnew value\r\nadded\r\n", base);
    assert_eq!(words, expected(&[(1, 0, 3), (2, 0, 5)], &[(1, 0, 3)], &[]));
}

#[test]
fn a_changed_line_break_alone_yields_no_range() {
    let base = "a\r\nb\n";
    let (_, words) = only_chunk_words(base, "a\nb\n", base);
    assert_eq!(words, expected(&[], &[], &[]));
}

#[test]
fn a_conflict_on_different_words_marks_each_side_and_their_union_in_base() {
    let (kind, words) = only_chunk_words("let a = 1;\n", "let b = 1;\n", "let a = 2;\n");
    assert_eq!(kind, ChunkKind::Conflict);
    assert_eq!(
        words,
        expected(&[(0, 4, 1)], &[(0, 4, 1), (0, 8, 1)], &[(0, 8, 1)])
    );
}

#[test]
fn overlapping_base_ranges_of_both_sides_merge_into_one() {
    let (_, words) = only_chunk_words("x a+b y\n", "x c+b y\n", "x d-b y\n");
    assert_eq!(words, expected(&[(0, 2, 1)], &[(0, 2, 2)], &[(0, 2, 2)]));
}

#[test]
fn an_underscore_belongs_to_its_word() {
    let base = "snake_case\n";
    let (_, words) = only_chunk_words(base, "snake_name\n", base);
    assert_eq!(words, expected(&[(0, 0, 10)], &[(0, 0, 10)], &[]));
}

#[test]
fn both_same_gives_both_sides_the_same_ranges() {
    let (kind, words) = only_chunk_words("fn a()\n", "fn b()\n", "fn b()\n");
    assert_eq!(kind, ChunkKind::BothSame);
    assert_eq!(words, expected(&[(0, 3, 1)], &[(0, 3, 1)], &[(0, 3, 1)]));
}

#[test]
fn add_add_has_no_ranges() {
    let (kind, words) = only_chunk_words("", "local\n", "remote\n");
    assert_eq!(kind, ChunkKind::Conflict);
    assert_eq!(words, expected(&[], &[], &[]));
}

#[test]
fn lines_differing_only_in_whitespace_mark_the_whitespace_run() {
    let base = "a  b\n";
    let (_, words) = only_chunk_words(base, "a b\n", base);
    assert_eq!(words, expected(&[(0, 1, 1)], &[(0, 1, 2)], &[]));
}

#[test]
fn each_chunk_gets_its_own_entry_in_chunk_order() {
    let base = "a 1\nb\nc\nd\ne 2\n";
    let local = "a 9\nb\nc\nd\ne 2\n";
    let remote = "a 1\nb\nc\nd\ne 8\n";
    let chunks = compute_chunks(base, local, remote, &Options::default());
    let words = word_changes(base, local, remote, &chunks);
    let ids: Vec<ChunkId> = words.iter().map(|change| change.chunk).collect();
    assert_eq!(ids, [ChunkId(0), ChunkId(1)]);
    assert_eq!(words[1].remote, ranges(RemoteLine, &[(4, 2, 1)]));
    assert_eq!(words[1].base, ranges(BaseLine, &[(4, 2, 1)]));
}

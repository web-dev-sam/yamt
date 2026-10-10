mod marks;

use marks::{marked_lines, one_sided, only_chunk};
use yamt_merge_core::{
    ChunkId, ChunkKind, InlinePoint, InlineRange, LocalLine, Options, RemoteLine, SideWordChanges,
    WordChanges, compute_chunks, word_changes,
};

fn nothing<L>() -> SideWordChanges<L> {
    SideWordChanges {
        changed: Vec::new(),
        removed_at: Vec::new(),
    }
}

#[test]
fn a_changed_word_and_a_removed_word_carry_absolute_lines_and_utf16_columns() {
    let base = "keep\né😀 old x y;\n";
    let (_, words) = only_chunk(base, "keep\né😀 new x;\n", base);
    assert_eq!(
        words,
        WordChanges {
            chunk: ChunkId(0),
            local: SideWordChanges {
                changed: vec![InlineRange {
                    line: LocalLine(1),
                    start: 4,
                    len: 3,
                }],
                removed_at: vec![InlinePoint {
                    line: LocalLine(1),
                    column: 9,
                }],
            },
            remote: nothing(),
        }
    );
}

#[test]
fn a_changed_line_break_alone_yields_nothing() {
    let base = "a\r\nb\n";
    let (_, words) = only_chunk(base, "a\nb\n", base);
    assert_eq!(words.local, nothing());
}

#[test]
fn a_space_before_a_changed_line_break_stays_unmarked() {
    let (_, words) = only_chunk("x old \n", "x new \r\n", "x old \n");
    assert_eq!(
        marked_lines("x new \r\n", 0, 1, &words.local, |line| line.0),
        ["x [new] "]
    );
}

#[test]
fn an_underscore_belongs_to_its_word() {
    assert_eq!(one_sided("snake_case\n", "snake_name\n"), ["[snake_name]"]);
}

#[test]
fn two_changed_words_separated_by_an_unchanged_space_become_one_range() {
    assert_eq!(
        one_sided("a old words z\n", "a new terms z\n"),
        ["a [new terms] z"]
    );
}

#[test]
fn a_new_blank_line_is_not_marked_but_a_new_indented_line_is() {
    assert_eq!(
        one_sided("a(1);\n", "a(2);\n\n\t\n"),
        ["a([2]);", "", "[\t]"]
    );
}

#[test]
fn removed_lines_at_the_chunk_start_point_at_the_first_side_line() {
    assert_eq!(one_sided("gone();\nx(1);\n", "x(2);\n"), ["|x([2]);"]);
}

#[test]
fn a_pure_deletion_has_no_point() {
    let base = "a\nb\nc\n";
    let (chunk, words) = only_chunk(base, "a\nc\n", base);
    assert!(chunk.local.is_empty());
    assert_eq!(words.local, nothing());
}

#[test]
fn both_same_gives_both_sides_the_same_marks() {
    let side = "lead\nfn b(x)\n";
    let (chunk, words) = only_chunk("fn a(x, y)\n", side, side);
    assert_eq!(chunk.kind, ChunkKind::BothSame);
    let local = marked_lines(side, 0, 2, &words.local, |line| line.0);
    let remote = marked_lines(side, 0, 2, &words.remote, |line| line.0);
    assert_eq!(local, ["[lead]", "fn [b](x|)"]);
    assert_eq!(local, remote);
}

#[test]
fn add_add_has_no_marks() {
    let (chunk, words) = only_chunk("", "local\n", "remote\n");
    assert_eq!(chunk.kind, ChunkKind::Conflict);
    assert_eq!((words.local, words.remote), (nothing(), nothing()));
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
    assert_eq!(
        words[1].remote.changed,
        [InlineRange {
            line: RemoteLine(4),
            start: 2,
            len: 1,
        }]
    );
    assert_eq!(words[1].local, nothing());
}

use yamt_merge_core::{
    BaseLine, Chunk, ChunkId, ChunkKind, DEFAULT_GAP, LineRange, LocalLine, Options, RemoteLine,
    apply_non_conflicting, compute_chunks,
};

fn chunk(
    id: u32,
    kind: ChunkKind,
    base: (u32, u32),
    local: (u32, u32),
    remote: (u32, u32),
) -> Chunk {
    Chunk {
        id: ChunkId(id),
        kind,
        base: LineRange {
            start: BaseLine(base.0),
            len: base.1,
        },
        local: LineRange {
            start: LocalLine(local.0),
            len: local.1,
        },
        remote: LineRange {
            start: RemoteLine(remote.0),
            len: remote.1,
        },
    }
}

fn assert_merge(base: &str, local: &str, remote: &str, expected: &[Chunk], expected_text: &str) {
    let chunks = compute_chunks(base, local, remote, &Options { gap: DEFAULT_GAP });
    assert_eq!(chunks, expected);
    assert_eq!(
        apply_non_conflicting(base, local, remote, &chunks),
        expected_text
    );
}

#[test]
fn far_apart_edits_yield_local_only_then_remote_only() {
    assert_merge(
        "a\nb\nc\nd\ne\nf\n",
        "a\nB1\nB2\nc\nd\ne\nf\n",
        "a\nb\nc\nd\nE\nf\n",
        &[
            chunk(0, ChunkKind::LocalOnly, (1, 1), (1, 2), (1, 1)),
            chunk(1, ChunkKind::RemoteOnly, (4, 1), (5, 1), (4, 1)),
        ],
        "a\nB1\nB2\nc\nd\nE\nf\n",
    );
}

#[test]
fn identical_edit_on_both_sides_yields_both_same() {
    assert_merge(
        "a\nb\nc\n",
        "a\nX\nY\nc\n",
        "a\nX\nY\nc\n",
        &[chunk(0, ChunkKind::BothSame, (1, 1), (1, 2), (1, 2))],
        "a\nX\nY\nc\n",
    );
}

#[test]
fn overlapping_different_edits_yield_one_conflict_with_three_lengths() {
    assert_merge(
        "a\nb\nc\nd\ne\n",
        "a\nL\nd\ne\n",
        "a\nb\nR1\nR2\nR3\ne\n",
        &[chunk(0, ChunkKind::Conflict, (1, 3), (1, 2), (1, 4))],
        "a\nb\nc\nd\ne\n",
    );
}

#[test]
fn add_add_with_different_text_yields_one_conflict_at_line_zero() {
    assert_merge(
        "",
        "x\ny\n",
        "z\n",
        &[chunk(0, ChunkKind::Conflict, (0, 0), (0, 2), (0, 1))],
        "",
    );
}

#[test]
fn edits_within_gap_group_and_beyond_gap_split_with_eof_insertion() {
    assert_merge(
        "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\n",
        "a\nB\nc\nd\ne\nf\nG\nh\ni\nj\nk\nl\nm\n",
        "a\nb\nc\nD\ne\nf\ng\nh\ni\nJ\nk\nl\n",
        &[
            chunk(0, ChunkKind::Conflict, (1, 3), (1, 3), (1, 3)),
            chunk(1, ChunkKind::LocalOnly, (6, 1), (6, 1), (6, 1)),
            chunk(2, ChunkKind::RemoteOnly, (9, 1), (9, 1), (9, 1)),
            chunk(3, ChunkKind::LocalOnly, (12, 0), (12, 1), (12, 0)),
        ],
        "a\nb\nc\nd\ne\nf\nG\nh\ni\nJ\nk\nl\nm\n",
    );
}

#[test]
fn missing_final_newline_alone_is_a_one_line_change() {
    assert_merge(
        "a\nb\n",
        "a\nb",
        "a\nb\n",
        &[chunk(0, ChunkKind::LocalOnly, (1, 1), (1, 1), (1, 1))],
        "a\nb",
    );
}

use std::ops::Range;

use imara_diff::{Algorithm, Diff, Hunk, InternedInput};
use serde::Serialize;
use specta::Type;

use crate::chunk::{Chunk, ChunkId};
use crate::line::{InlinePoint, InlineRange, LocalLine, RemoteLine, lines_in, split_lines};
use crate::line_pairs::{LinePair, line_pairs};
use crate::token::{Token, TokenKind, line_tokens, utf16_len, without_line_break};

/// One side of a chunk compared with base, line by line.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SideWordChanges<L> {
    /// Side text that is not in base: sorted by line then start, disjoint, never empty,
    /// never across a line break.
    pub changed: Vec<InlineRange<L>>,
    /// Places where base text this side removed would sit: sorted, at most one per place.
    pub removed_at: Vec<InlinePoint<L>>,
}

/// Where one chunk's sides differ from base.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct WordChanges {
    /// The chunk these changes belong to.
    pub chunk: ChunkId,
    /// Local compared with base.
    pub local: SideWordChanges<LocalLine>,
    /// Remote compared with base.
    pub remote: SideWordChanges<RemoteLine>,
}

/// One entry per chunk, in the order of `chunks`.
#[must_use]
pub fn word_changes(base: &str, local: &str, remote: &str, chunks: &[Chunk]) -> Vec<WordChanges> {
    let base_lines = split_lines(base);
    let local_lines = split_lines(local);
    let remote_lines = split_lines(remote);
    chunks
        .iter()
        .map(|chunk| {
            let base = lines_in(&base_lines, &(chunk.base.start.0..chunk.base.end().0));
            let local = chunk.local.start.0..chunk.local.end().0;
            let remote = chunk.remote.start.0..chunk.remote.end().0;
            WordChanges {
                chunk: chunk.id,
                local: side_word_changes(base, &local_lines, local, LocalLine),
                remote: side_word_changes(base, &remote_lines, remote, RemoteLine),
            }
        })
        .collect()
}

fn side_word_changes<L: Copy + PartialEq>(
    base: &[&str],
    all_side_lines: &[&str],
    side_range: Range<u32>,
    line_of: fn(u32) -> L,
) -> SideWordChanges<L> {
    let mut marker = SideMarker {
        side: lines_in(all_side_lines, &side_range),
        first_line: side_range.start,
        line_of,
        changes: SideWordChanges {
            changed: Vec::new(),
            removed_at: Vec::new(),
        },
    };
    if base.is_empty() || marker.side.is_empty() {
        return marker.changes;
    }
    let mut after_previous = LinePair { base: 0, side: 0 };
    for pair in line_pairs(base, marker.side) {
        marker.mark_gap(after_previous, pair);
        marker.mark_pair(line_text(base, pair.base), pair.side);
        after_previous = LinePair {
            base: pair.base + 1,
            side: pair.side + 1,
        };
    }
    let chunk_end = LinePair {
        base: u32::try_from(base.len()).unwrap_or(u32::MAX),
        side: marker.side_len(),
    };
    marker.mark_gap(after_previous, chunk_end);
    marker.changes.removed_at.dedup();
    marker.changes
}

struct SideMarker<'a, L> {
    side: &'a [&'a str],
    first_line: u32,
    line_of: fn(u32) -> L,
    changes: SideWordChanges<L>,
}

impl<L: Copy> SideMarker<'_, L> {
    /// Marks the unpaired lines between two pairs (or a chunk edge): new side lines in full, and
    /// removed base lines as one point when no side line replaces them.
    fn mark_gap(&mut self, from: LinePair, until: LinePair) {
        for side_line in from.side..until.side {
            let width = self.width(side_line);
            if width > 0 {
                self.mark_range(side_line, 0, width);
            }
        }
        if from.side < until.side || from.base == until.base {
            return;
        }
        if until.side < self.side_len() {
            self.mark_point(until.side, 0);
        } else if let Some(previous) = from.side.checked_sub(1) {
            self.mark_point(previous, self.width(previous));
        }
    }

    fn mark_pair(&mut self, base_text: &str, side_line: u32) {
        let side_text = line_text(self.side, side_line);
        if base_text == side_text {
            return;
        }
        let base_tokens = line_tokens(without_line_break(base_text));
        let side_tokens = line_tokens(without_line_break(side_text));
        let diff = token_diff(&base_tokens, &side_tokens);
        for hunk in diff.hunks().filter(Hunk::is_pure_removal) {
            let column = side_tokens
                .get(hunk.after.start as usize)
                .map_or_else(|| self.width(side_line), |token| token.column);
            self.mark_point(side_line, column);
        }
        let added: Vec<bool> = (0..)
            .zip(&side_tokens)
            .map(|(index, _)| diff.is_added(index))
            .collect();
        for (start, len) in marked_spans(&side_tokens, &added) {
            self.mark_range(side_line, start, len);
        }
    }

    fn mark_range(&mut self, side_line: u32, start: u32, len: u32) {
        let line = (self.line_of)(self.first_line + side_line);
        self.changes.changed.push(InlineRange { line, start, len });
    }

    fn mark_point(&mut self, side_line: u32, column: u32) {
        let line = (self.line_of)(self.first_line + side_line);
        self.changes.removed_at.push(InlinePoint { line, column });
    }

    fn width(&self, side_line: u32) -> u32 {
        utf16_len(without_line_break(line_text(self.side, side_line)))
    }

    fn side_len(&self) -> u32 {
        u32::try_from(self.side.len()).unwrap_or(u32::MAX)
    }
}

fn line_text<'a>(lines: &[&'a str], index: u32) -> &'a str {
    lines.get(index as usize).copied().unwrap_or_default()
}

fn token_diff(base: &[Token], side: &[Token]) -> Diff {
    let mut input = InternedInput::default();
    input.update_before(base.iter().map(|token| token.text));
    input.update_after(side.iter().map(|token| token.text));
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_no_heuristic(&input);
    diff
}

/// `(start, len)` of each run of added tokens; whitespace between two added tokens joins them.
fn marked_spans(tokens: &[Token], added: &[bool]) -> Vec<(u32, u32)> {
    let is_added = |index: Option<usize>| index.and_then(|index| added.get(index)) == Some(&true);
    let mut spans: Vec<(u32, u32)> = Vec::new();
    for (index, token) in tokens.iter().enumerate() {
        let joins_neighbours = token.kind == TokenKind::Space
            && is_added(index.checked_sub(1))
            && is_added(Some(index + 1));
        if !is_added(Some(index)) && !joins_neighbours {
            continue;
        }
        match spans.last_mut() {
            Some((start, len)) if *start + *len == token.column => *len += token.width,
            Some(_) | None => spans.push((token.column, token.width)),
        }
    }
    spans
}

use serde::Serialize;
use specta::Type;

use crate::compute::{Options, compute_chunks};
use crate::line::{LeftLine, LineRange, RightLine, lines_in, split_lines};
use crate::word::{SideWordChanges, side_word_changes};

/// One fragment per hunk, as `WebStorm`'s 2-way diff shows it (plan §2 #95).
const COMPARE_GAP: u32 = 0;

/// One place where the right text differs from the left, located in both texts.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct Difference {
    /// The lines in the left; empty where the right inserted lines.
    pub left: LineRange<LeftLine>,
    /// The lines in the right; empty where the right removed the left's lines.
    pub right: LineRange<RightLine>,
    /// Where the two sides of this difference differ inside their lines.
    pub words: DifferenceWords,
}

/// Each side of a difference compared with the other side.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct DifferenceWords {
    /// Left compared with right: left text the right lacks; removals are right text the left
    /// lacks, placed where it would sit in the left.
    pub left: SideWordChanges<LeftLine>,
    /// Right compared with left.
    pub right: SideWordChanges<RightLine>,
}

/// The differences between two texts, sorted and disjoint; none for equal texts.
#[must_use]
pub fn compare(left: &str, right: &str) -> Vec<Difference> {
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let chunks = compute_chunks(left, left, right, &Options { gap: COMPARE_GAP });
    chunks
        .iter()
        .map(|chunk| {
            let left_range = chunk.base.start.0..chunk.base.end().0;
            let right_range = chunk.remote.start.0..chunk.remote.end().0;
            let left_text = lines_in(&left_lines, &left_range);
            let right_text = lines_in(&right_lines, &right_range);
            Difference {
                left: LineRange {
                    start: LeftLine(chunk.base.start.0),
                    len: chunk.base.len,
                },
                right: LineRange {
                    start: RightLine(chunk.remote.start.0),
                    len: chunk.remote.len,
                },
                words: DifferenceWords {
                    left: side_word_changes(right_text, &left_lines, left_range, LeftLine),
                    right: side_word_changes(left_text, &right_lines, right_range, RightLine),
                },
            }
        })
        .collect()
}

use serde::Serialize;
use specta::Type;

use crate::compute::{Options, compute_chunks};
use crate::line::{LeftLine, LineRange, RightLine, lines_in, split_lines};
use crate::word::{SideWordChanges, side_word_changes};

/// One fragment per hunk, as `WebStorm`'s 2-way diff shows it (plan §2 #95).
const COMPARE_GAP: u32 = 0;

/// Where two texts differ, by lines only: the same ranges as a [`Difference`], without its word marks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct LineChange {
    /// The lines in the left; empty where the right inserted lines.
    pub left: LineRange<LeftLine>,
    /// The lines in the right; empty where the right removed the left's lines.
    pub right: LineRange<RightLine>,
}

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

/// The lines where two texts differ, sorted and disjoint; none for equal texts.
#[must_use]
pub fn line_changes(left: &str, right: &str) -> Vec<LineChange> {
    let chunks = compute_chunks(left, left, right, &Options { gap: COMPARE_GAP });
    chunks
        .iter()
        .map(|chunk| LineChange {
            left: LineRange {
                start: LeftLine(chunk.base.start.0),
                len: chunk.base.len,
            },
            right: LineRange {
                start: RightLine(chunk.remote.start.0),
                len: chunk.remote.len,
            },
        })
        .collect()
}

/// The differences between two texts, sorted and disjoint; none for equal texts.
#[must_use]
pub fn compare(left: &str, right: &str) -> Vec<Difference> {
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    line_changes(left, right)
        .into_iter()
        .map(|change| {
            let left_range = change.left.start.0..change.left.end().0;
            let right_range = change.right.start.0..change.right.end().0;
            let left_text = lines_in(&left_lines, &left_range);
            let right_text = lines_in(&right_lines, &right_range);
            Difference {
                left: change.left,
                right: change.right,
                words: DifferenceWords {
                    left: side_word_changes(right_text, &left_lines, left_range, LeftLine),
                    right: side_word_changes(left_text, &right_lines, right_range, RightLine),
                },
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use proptest::prelude::*;

    use super::*;

    const MAX_LINES: usize = 8;
    const LINES: [&str; 4] = ["alpha\n", "beta\n", "gamma one\n", "gamma two\n"];

    fn text() -> impl Strategy<Value = String> {
        proptest::collection::vec(proptest::sample::select(&LINES[..]), 0..MAX_LINES)
            .prop_map(|lines| lines.concat())
    }

    #[test]
    fn equal_texts_have_no_line_changes() {
        let text = "one\ntwo\nthree\n";
        assert_eq!(line_changes(text, text), Vec::new());
        assert_eq!(line_changes("", ""), Vec::new());
    }

    #[test]
    fn a_replaced_line_and_an_appended_line_are_two_changes() {
        let changes = line_changes("one\ntwo\nthree\n", "one\n2\nthree\nfour\n");
        let change = |left: (u32, u32), right: (u32, u32)| LineChange {
            left: LineRange {
                start: LeftLine(left.0),
                len: left.1,
            },
            right: LineRange {
                start: RightLine(right.0),
                len: right.1,
            },
        };
        assert_eq!(changes, [change((1, 1), (1, 1)), change((3, 0), (3, 1))]);
    }

    proptest! {
        #[test]
        fn line_changes_are_compare_s_ranges(left in text(), right in text()) {
            let from_compare: Vec<LineChange> = compare(&left, &right)
                .into_iter()
                .map(|difference| LineChange { left: difference.left, right: difference.right })
                .collect();
            prop_assert_eq!(line_changes(&left, &right), from_compare);
        }
    }
}

use std::ops::Range;

use imara_diff::{Algorithm, Diff, Hunk, InternedInput};

/// Where the lines of one text sit in another, from a line diff of the two.
#[derive(Clone, Debug)]
pub struct LineMap {
    hunks: Vec<Hunk>,
}

/// Aligns the lines of `from` with the lines of `to`.
#[must_use]
pub fn line_map(from: &str, to: &str) -> LineMap {
    let input = InternedInput::new(from, to);
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    LineMap {
        hunks: diff.hunks().collect(),
    }
}

impl LineMap {
    /// The `to` lines equal to these `from` lines, or `None` when any of them changed; an empty
    /// range gives the place after the last unchanged line before it.
    #[must_use]
    pub fn exact(&self, from: Range<u32>) -> Option<Range<u32>> {
        if from.is_empty() {
            let point = self.before_changes_at(from.start);
            return Some(point..point);
        }
        let changed = self
            .hunks
            .iter()
            .any(|hunk| hunk.before.start < from.end && hunk.before.end > from.start);
        if changed {
            return None;
        }
        let start = self.after_changes_at(from.start);
        Some(start..start + (from.end - from.start))
    }

    /// The `to` lines that cover these `from` lines, grown outward to whole changed hunks;
    /// lines inserted right at either edge are included.
    #[must_use]
    pub fn covering(&self, from: Range<u32>) -> Range<u32> {
        self.before_changes_at(from.start)..self.after_changes_at(from.end)
    }

    fn before_changes_at(&self, from_point: u32) -> u32 {
        let preceding = self
            .hunks
            .partition_point(|hunk| hunk.before.start < from_point);
        let Some(hunk) = preceding
            .checked_sub(1)
            .and_then(|last| self.hunks.get(last))
        else {
            return from_point;
        };
        if hunk.before.end > from_point {
            hunk.after.start
        } else {
            hunk.after.end + (from_point - hunk.before.end)
        }
    }

    fn after_changes_at(&self, from_point: u32) -> u32 {
        let reaching = self.hunks.partition_point(|hunk| {
            hunk.before.start < from_point
                || (hunk.before.start == from_point && hunk.before.is_empty())
        });
        let Some(hunk) = reaching
            .checked_sub(1)
            .and_then(|last| self.hunks.get(last))
        else {
            return from_point;
        };
        if hunk.before.end > from_point {
            hunk.after.end
        } else {
            hunk.after.end + (from_point - hunk.before.end)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOCAL: &str = "a\nb\nc\nd\ne\n";

    #[test]
    fn unchanged_lines_map_exactly_and_cover_themselves() {
        let map = line_map(LOCAL, "new\na\nb\nc\nd\ne\n");
        assert_eq!(map.exact(1..3), Some(2..4));
        assert_eq!(map.covering(1..3), 2..4);
        assert_eq!(map.exact(0..5), Some(1..6));
    }

    #[test]
    fn a_changed_line_inside_the_range_makes_it_inexact_and_covering_grows_to_the_hunk() {
        let map = line_map(LOCAL, "a\nB\nC\nX\nd\ne\n");
        assert_eq!(map.exact(1..2), None);
        assert_eq!(map.exact(0..2), None);
        assert_eq!(map.exact(3..5), Some(4..6));
        assert_eq!(map.covering(1..2), 1..4);
        assert_eq!(map.covering(0..2), 0..4);
    }

    #[test]
    fn lines_inserted_inside_a_range_make_it_inexact() {
        let map = line_map(LOCAL, "a\nb\nnew\nc\nd\ne\n");
        assert_eq!(map.exact(1..3), None);
        assert_eq!(map.exact(0..2), Some(0..2));
        assert_eq!(map.exact(2..4), Some(3..5));
        assert_eq!(map.covering(1..3), 1..4);
    }

    #[test]
    fn an_empty_range_is_a_point_after_the_last_unchanged_line_and_covers_lines_inserted_there() {
        let map = line_map(LOCAL, "a\nb\nnew\nc\nd\ne\n");
        assert_eq!(map.exact(2..2), Some(2..2));
        assert_eq!(map.covering(2..2), 2..3);
        assert_eq!(map.exact(4..4), Some(5..5));
        assert_eq!(map.covering(4..4), 5..5);
    }

    #[test]
    fn an_empty_range_inside_a_changed_hunk_sits_before_it_and_covers_all_of_it() {
        let map = line_map(LOCAL, "a\nB\nC\nd\ne\n");
        assert_eq!(map.exact(2..2), Some(1..1));
        assert_eq!(map.covering(2..2), 1..3);
    }

    #[test]
    fn the_start_and_the_end_of_the_text_are_points_too() {
        let map = line_map(LOCAL, "first\na\nb\nc\nd\ne\nlast\n");
        assert_eq!(map.exact(0..0), Some(0..0));
        assert_eq!(map.covering(0..0), 0..1);
        assert_eq!(map.exact(5..5), Some(6..6));
        assert_eq!(map.covering(5..5), 6..7);
        assert_eq!(map.covering(0..5), 0..7);
    }

    #[test]
    fn deleted_lines_cover_nothing_and_are_not_exact() {
        let map = line_map(LOCAL, "a\ne\n");
        assert_eq!(map.exact(1..4), None);
        assert_eq!(map.covering(1..4), 1..1);
        assert_eq!(map.covering(2..3), 1..1);
        assert_eq!(map.exact(4..5), Some(1..2));
    }

    #[test]
    fn an_empty_input_maps_to_points_and_covers_the_whole_other_text() {
        let from_empty = line_map("", LOCAL);
        assert_eq!(from_empty.exact(0..0), Some(0..0));
        assert_eq!(from_empty.covering(0..0), 0..5);
        let to_empty = line_map(LOCAL, "");
        assert_eq!(to_empty.exact(0..5), None);
        assert_eq!(to_empty.covering(0..5), 0..0);
        assert_eq!(to_empty.exact(5..5), Some(0..0));
        let both_empty = line_map("", "");
        assert_eq!(both_empty.exact(0..0), Some(0..0));
        assert_eq!(both_empty.covering(0..0), 0..0);
    }
}

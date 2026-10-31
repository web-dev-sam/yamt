use sha1::{Digest, Sha1};
use yamt_merge_core::Difference;
use yamt_range::RangeEntry;

use super::{gitlab_lines, one_based};
use crate::gitlab::line_range::{LineType, MultiLine, RangeEnd};
use crate::{DiffLine, ThreadPlace};

const NOT_IN_THIS_DIFF: &str = "the thread's lines are not in this diff any more";

/// A text file's differences, and whether a side has no line at all (an added file's left, a deleted file's right).
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct FileDiff {
    pub(crate) differences: Vec<Difference>,
    pub(crate) left_is_empty: bool,
    pub(crate) right_is_empty: bool,
}

/// Both ends of `place` in `entry`. GitLab hashes the new path, also for a renamed file
/// (`lib/gitlab/diff/file.rb:83-85, 253-255`, v19.3.2-ee). `Err` names why it cannot be posted.
pub(crate) fn multi_line(
    entry: &RangeEntry,
    diff: &FileDiff,
    place: ThreadPlace,
) -> Result<MultiLine, &'static str> {
    let path_hash = format!("{:x}", Sha1::digest(entry.path.as_bytes()));
    let end_of = |line| range_end_of(&path_hash, diff, line).ok_or(NOT_IN_THIS_DIFF);
    Ok(MultiLine {
        start: end_of(place.start)?,
        end: end_of(place.end.diff_line())?,
    })
}

/// GitLab numbers a diff line by its parser's old and new counters when it reads the line
/// (`lib/gitlab/diff/parser.rb:13-14, 48, 52-64`, v19.3.2-ee): a removed line pairs with the new number of the line
/// after its change's removed lines, an added line with the old number of that line. A side with no line at all
/// counts from git's hunk header `@@ -0,0 +1,n @@` (or `+0,0`), so its lines pair with 0. `None` for a changed line
/// inside no difference.
fn range_end_of(path_hash: &str, diff: &FileDiff, line: DiffLine) -> Option<RangeEnd> {
    let (line_type, old, new) = match line {
        DiffLine::Unchanged { left, right } => (None, one_based(left.0), one_based(right.0)),
        DiffLine::Removed { left } => {
            let difference = diff
                .differences
                .iter()
                .find(|difference| difference.left.start <= left && left < difference.left.end())?;
            let new = if diff.right_is_empty {
                0
            } else {
                one_based(difference.right.start.0)
            };
            (Some(LineType::Old), one_based(left.0), new)
        }
        DiffLine::Added { right } => {
            let difference = diff.differences.iter().find(|difference| {
                difference.right.start <= right && right < difference.right.end()
            })?;
            let old = if diff.left_is_empty {
                0
            } else {
                one_based(difference.left.end().0)
            };
            (Some(LineType::New), old, one_based(right.0))
        }
    };
    let (old_line, new_line) = gitlab_lines(line);
    Some(RangeEnd {
        line_code: line_code(path_hash, old, new),
        line_type,
        old_line,
        new_line,
    })
}

/// `Gitlab::Git.diff_line_code` (`lib/gitlab/git.rb:113-115`, v19.3.2-ee).
fn line_code(path_hash: &str, old: u32, new: u32) -> String {
    format!("{path_hash}_{old}_{new}")
}

#[cfg(test)]
mod tests {
    use yamt_merge_core::{DifferenceWords, LeftLine, LineRange, RightLine, SideWordChanges};
    use yamt_range::{RangeChange, RangeFileId, RangeLineCounts};

    use super::*;
    use crate::ThreadLine;

    /// `printf '%s' src/board/board.ts | sha1sum`
    const BOARD: &str = "e783a9be490e9bcfa1e4a239bf6e62d2ab163459";
    /// `printf '%s' docs/keys.md | sha1sum`
    const KEYS: &str = "5aac5fc3e70b10f7e0b73e4222c367c9808e3eb3";
    /// `printf '%s' src/board/reminders.ts | sha1sum`
    const REMINDERS: &str = "0b766bb31a60a01e5f1284f46f34806d44b68dba";
    /// `printf '%s' src/api/mockBoards.ts | sha1sum`
    const MOCK_BOARDS: &str = "381f208cdbeb0d5464c4b33957afc4b6822e944e";

    fn difference(left: u32, left_len: u32, right: u32, right_len: u32) -> Difference {
        let no_words = DifferenceWords {
            left: SideWordChanges {
                changed: Vec::new(),
                removals: Vec::new(),
            },
            right: SideWordChanges {
                changed: Vec::new(),
                removals: Vec::new(),
            },
        };
        Difference {
            left: LineRange {
                start: LeftLine(left),
                len: left_len,
            },
            right: LineRange {
                start: RightLine(right),
                len: right_len,
            },
            words: no_words,
        }
    }

    fn modified(differences: Vec<Difference>) -> FileDiff {
        FileDiff {
            differences,
            left_is_empty: false,
            right_is_empty: false,
        }
    }

    /// `src/board/board.ts` of `scripts/range-repo.sh`'s `main...feature` (`frontend/fixtures/range/review.json`
    /// `files[7]`), 0-based.
    fn board_diff() -> FileDiff {
        modified(vec![
            difference(19, 1, 19, 2),
            difference(179, 0, 180, 3),
            difference(199, 1, 203, 1),
            difference(254, 1, 258, 3),
            difference(308, 18, 314, 0),
            difference(415, 0, 403, 33),
            difference(461, 0, 482, 2),
        ])
    }

    fn entry(path: &str, change: RangeChange) -> RangeEntry {
        RangeEntry {
            id: RangeFileId(7),
            path: path.to_owned(),
            change,
            lines: RangeLineCounts::NotCounted,
        }
    }

    fn removed(left: u32) -> DiffLine {
        DiffLine::Removed {
            left: LeftLine(left),
        }
    }

    fn added(right: u32) -> ThreadLine {
        ThreadLine::Added {
            right: RightLine(right),
        }
    }

    fn range_end(
        line_code: &str,
        line_type: Option<LineType>,
        old_line: Option<u32>,
        new_line: Option<u32>,
    ) -> RangeEnd {
        RangeEnd {
            line_code: line_code.to_owned(),
            line_type,
            old_line,
            new_line,
        }
    }

    fn board_ends(start: DiffLine, end: ThreadLine) -> Result<MultiLine, &'static str> {
        let board = entry("src/board/board.ts", RangeChange::Modified);
        multi_line(&board, &board_diff(), ThreadPlace { start, end })
    }

    #[test]
    fn line_codes_number_a_line_as_gitlabs_parser_does() {
        let unchanged = DiffLine::Unchanged {
            left: LeftLine(196),
            right: RightLine(200),
        };
        let unchanged_end = range_end(&format!("{BOARD}_197_201"), None, Some(197), Some(201));
        let new = Some(LineType::New);
        let added_end = range_end(&format!("{BOARD}_201_204"), new, None, Some(204));
        let in_column = MultiLine {
            start: unchanged_end,
            end: added_end.clone(),
        };
        assert_eq!(board_ends(unchanged, added(203)), Ok(in_column));
        let old = Some(LineType::Old);
        let removed_end = range_end(&format!("{BOARD}_200_204"), old, Some(200), None);
        let both_sides = MultiLine {
            start: removed_end,
            end: added_end,
        };
        assert_eq!(board_ends(removed(199), added(203)), Ok(both_sides));

        let pure_removal = range_end(&format!("{BOARD}_309_315"), old, Some(309), None);
        let pure_addition = range_end(&format!("{BOARD}_416_404"), new, None, Some(404));
        let pure = MultiLine {
            start: pure_removal,
            end: pure_addition,
        };
        assert_eq!(board_ends(removed(308), added(403)), Ok(pure));
        let last_lines = board_ends(removed(325), added(435)).unwrap();
        assert_eq!(last_lines.start.line_code, format!("{BOARD}_326_315"));
        assert_eq!(last_lines.end.line_code, format!("{BOARD}_416_436"));

        let renamed = RangeChange::Renamed {
            old_path: "docs/shortcuts.md".to_owned(),
        };
        let keys = entry("docs/keys.md", renamed);
        let place = ThreadPlace {
            start: removed(199),
            end: added(203),
        };
        let renamed_ends = multi_line(&keys, &board_diff(), place).unwrap();
        assert_eq!(renamed_ends.start.line_code, format!("{KEYS}_200_204"));
    }

    /// `src/board/reminders.ts` (`review.json` `files[8]`, 11 lines) and `src/api/mockBoards.ts` (`files[6]`, 43
    /// lines): git's hunks `@@ -0,0 +1,11 @@` and `@@ -1,43 +0,0 @@`.
    #[test]
    fn the_missing_side_of_an_added_or_a_deleted_file_is_numbered_0() {
        let added_file = FileDiff {
            differences: vec![difference(0, 0, 0, 11)],
            left_is_empty: true,
            right_is_empty: false,
        };
        let reminders = entry("src/board/reminders.ts", RangeChange::Added);
        let place = ThreadPlace {
            start: DiffLine::Added {
                right: RightLine(0),
            },
            end: added(3),
        };
        let new = Some(LineType::New);
        let added_ends = MultiLine {
            start: range_end(&format!("{REMINDERS}_0_1"), new, None, Some(1)),
            end: range_end(&format!("{REMINDERS}_0_4"), new, None, Some(4)),
        };
        assert_eq!(multi_line(&reminders, &added_file, place), Ok(added_ends));

        let deleted_file = FileDiff {
            differences: vec![difference(0, 43, 0, 0)],
            left_is_empty: false,
            right_is_empty: true,
        };
        let mock_boards = entry("src/api/mockBoards.ts", RangeChange::Deleted);
        let place = ThreadPlace {
            start: removed(0),
            end: ThreadLine::Removed { left: LeftLine(42) },
        };
        let old = Some(LineType::Old);
        let removed_ends = MultiLine {
            start: range_end(&format!("{MOCK_BOARDS}_1_0"), old, Some(1), None),
            end: range_end(&format!("{MOCK_BOARDS}_43_0"), old, Some(43), None),
        };
        assert_eq!(
            multi_line(&mock_boards, &deleted_file, place),
            Ok(removed_ends)
        );
    }

    #[test]
    fn a_changed_end_inside_no_difference_is_not_in_this_diff() {
        let not_in_this_diff = Err(NOT_IN_THIS_DIFF);
        assert_eq!(board_ends(removed(200), added(203)), not_in_this_diff);
        assert_eq!(board_ends(removed(326), added(203)), not_in_this_diff);
        assert_eq!(board_ends(removed(199), added(204)), not_in_this_diff);
        assert_eq!(board_ends(removed(199), added(202)), not_in_this_diff);
    }
}

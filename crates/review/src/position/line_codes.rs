use serde_json::{Map, Value};
use sha1::{Digest, Sha1};
use yamt_merge_core::Difference;
use yamt_range::RangeEntry;

use super::{insert_lines, one_based};
use crate::{DiffLine, ThreadPlace};

const NOT_IN_THIS_DIFF: &str = "the thread's lines are not in this diff any more";
const OLD: &str = "old";
const NEW: &str = "new";

/// The side of GitLab's diff a changed line is on; an unchanged line has none.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum LineType {
    Old,
    New,
}

impl LineType {
    fn gitlab_name(self) -> &'static str {
        match self {
            LineType::Old => OLD,
            LineType::New => NEW,
        }
    }

    pub(crate) fn from_gitlab_name(name: &str) -> Option<LineType> {
        match name {
            OLD => Some(LineType::Old),
            NEW => Some(LineType::New),
            _ => None,
        }
    }
}

/// One end of GitLab's `position[line_range]`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct RangeEnd {
    pub(crate) line_code: String,
    pub(crate) line_type: Option<LineType>,
    pub(crate) old_line: Option<u32>,
    pub(crate) new_line: Option<u32>,
}

/// GitLab's `position[line_range]`: the first and the last line of a thread on several lines.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MultiLine {
    pub(crate) start: RangeEnd,
    pub(crate) end: RangeEnd,
}

impl RangeEnd {
    /// `{ line_code, type?, old_line?, new_line? }`; GitLab's own form sends no `type` for an unchanged line
    /// (`app/assets/javascripts/diffs/components/diff_line_note_form.vue:64-69`, v19.3.2-ee; plan §2 #147).
    pub(super) fn json(&self) -> Value {
        let mut end = Map::new();
        end.insert("line_code".to_owned(), self.line_code.clone().into());
        if let Some(line_type) = self.line_type {
            end.insert("type".to_owned(), line_type.gitlab_name().into());
        }
        insert_lines(&mut end, self.old_line, self.new_line);
        Value::Object(end)
    }
}

/// Both ends of `place` in `entry` with `differences`. GitLab hashes the new path, also for a renamed file
/// (`lib/gitlab/diff/file.rb:83-85, 253-255`, v19.3.2-ee). `Err` names why it cannot be posted.
pub(crate) fn multi_line(
    entry: &RangeEntry,
    differences: &[Difference],
    place: ThreadPlace,
) -> Result<MultiLine, &'static str> {
    let path_hash = format!("{:x}", Sha1::digest(entry.path.as_bytes()));
    let end_of = |line| range_end_of(&path_hash, differences, line).ok_or(NOT_IN_THIS_DIFF);
    Ok(MultiLine {
        start: end_of(place.start)?,
        end: end_of(place.end.diff_line())?,
    })
}

/// GitLab numbers a diff line by its parser's old and new counters when it reads the line
/// (`lib/gitlab/diff/parser.rb:13-14, 48, 52-64`, v19.3.2-ee): a removed line pairs with the new number of its
/// change's first added line, an added line with the old number after its change's removed lines. `None` for a
/// changed line inside no difference.
fn range_end_of(path_hash: &str, differences: &[Difference], line: DiffLine) -> Option<RangeEnd> {
    match line {
        DiffLine::Unchanged { left, right } => {
            let (old, new) = (one_based(left.0), one_based(right.0));
            Some(RangeEnd {
                line_code: line_code(path_hash, old, new),
                line_type: None,
                old_line: Some(old),
                new_line: Some(new),
            })
        }
        DiffLine::Removed { left } => {
            let difference = differences
                .iter()
                .find(|difference| difference.left.start <= left && left < difference.left.end())?;
            let old = one_based(left.0);
            Some(RangeEnd {
                line_code: line_code(path_hash, old, one_based(difference.right.start.0)),
                line_type: Some(LineType::Old),
                old_line: Some(old),
                new_line: None,
            })
        }
        DiffLine::Added { right } => {
            let difference = differences.iter().find(|difference| {
                difference.right.start <= right && right < difference.right.end()
            })?;
            let new = one_based(right.0);
            Some(RangeEnd {
                line_code: line_code(path_hash, one_based(difference.left.end().0), new),
                line_type: Some(LineType::New),
                old_line: None,
                new_line: Some(new),
            })
        }
    }
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

    /// `src/board/board.ts` of `scripts/range-repo.sh`'s `main...feature` (`frontend/fixtures/range/review.json`
    /// `files[7]`), 0-based.
    fn board_differences() -> Vec<Difference> {
        vec![
            difference(19, 1, 19, 2),
            difference(179, 0, 180, 3),
            difference(199, 1, 203, 1),
            difference(254, 1, 258, 3),
            difference(308, 18, 314, 0),
            difference(415, 0, 403, 33),
            difference(461, 0, 482, 2),
        ]
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
        multi_line(&board, &board_differences(), ThreadPlace { start, end })
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
        let renamed_ends = multi_line(&keys, &board_differences(), place).unwrap();
        assert_eq!(renamed_ends.start.line_code, format!("{KEYS}_200_204"));
    }

    #[test]
    fn a_changed_end_inside_no_difference_is_not_in_this_diff() {
        let not_in_this_diff = Err(NOT_IN_THIS_DIFF);
        assert_eq!(board_ends(removed(200), added(203)), not_in_this_diff);
        assert_eq!(board_ends(removed(326), added(203)), not_in_this_diff);
        assert_eq!(board_ends(removed(199), added(204)), not_in_this_diff);
        assert_eq!(board_ends(removed(199), added(202)), not_in_this_diff);
    }

    #[test]
    fn a_range_end_writes_type_and_lines_only_where_the_line_has_them() {
        let unchanged = range_end("h_1_2", None, Some(1), Some(2)).json();
        let expected = serde_json::json!({ "line_code": "h_1_2", "old_line": 1, "new_line": 2 });
        assert_eq!(unchanged, expected);
        let removed = range_end("h_3_4", Some(LineType::Old), Some(3), None).json();
        let expected = serde_json::json!({ "line_code": "h_3_4", "type": "old", "old_line": 3 });
        assert_eq!(removed, expected);
        let added = range_end("h_5_6", Some(LineType::New), None, Some(6)).json();
        let expected = serde_json::json!({ "line_code": "h_5_6", "type": "new", "new_line": 6 });
        assert_eq!(added, expected);
        assert_eq!(LineType::from_gitlab_name("old"), Some(LineType::Old));
        assert_eq!(LineType::from_gitlab_name("new"), Some(LineType::New));
        assert_eq!(LineType::from_gitlab_name("context"), None);
    }
}

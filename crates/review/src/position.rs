use serde_json::{Map, Value};
use yamt_range::{RangeChange, RangeEntry};

use crate::ThreadLine;
use crate::gitlab::drafts::DraftNote;
use crate::gitlab::{DiffRefs, LinePlace};

mod line_codes;

pub(crate) use line_codes::{LineType, MultiLine, RangeEnd, multi_line};

/// What the range shows in place of a byte it could not read as UTF-8.
const REPLACEMENT: char = '\u{FFFD}';
pub(crate) const NOT_UTF8: &str = "the path is not UTF-8";

/// One draft note to post: its text and where it sits in the merge request's diff.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PostBody {
    pub(crate) note: String,
    pub(crate) diff_refs: DiffRefs,
    pub(crate) place: LinePlace,
    /// `None` for a thread on one line.
    pub(crate) multi_line: Option<MultiLine>,
}

/// GitLab's place for `line` of `entry`: a removed line has `old_line` only, an added one `new_line` only, an
/// unchanged one both (docs.gitlab.com, discussions API); `Err` names why it cannot be posted.
pub(crate) fn line_place(entry: &RangeEntry, line: ThreadLine) -> Result<LinePlace, &'static str> {
    let old_path = match &entry.change {
        RangeChange::Renamed { old_path } => old_path,
        RangeChange::Added | RangeChange::Modified | RangeChange::Deleted => &entry.path,
    };
    if old_path.contains(REPLACEMENT) || entry.path.contains(REPLACEMENT) {
        return Err(NOT_UTF8);
    }
    let (old_line, new_line) = match line {
        ThreadLine::Removed { left } => (Some(left.0), None),
        ThreadLine::Added { right } => (None, Some(right.0)),
        ThreadLine::UnchangedOnLeft { left, right }
        | ThreadLine::UnchangedOnRight { left, right } => (Some(left.0), Some(right.0)),
    };
    Ok(LinePlace {
        old_path: old_path.clone(),
        new_path: entry.path.clone(),
        old_line: old_line.map(one_based),
        new_line: new_line.map(one_based),
    })
}

fn one_based(line: u32) -> u32 {
    line.saturating_add(1)
}

impl PostBody {
    /// `{ note, position: { position_type: "text", base_sha, start_sha, head_sha, old_path, new_path, old_line?,
    /// new_line?, line_range? } }`, the draft-notes route's body (`lib/api/draft_notes.rb:95-108`, v19.3.2-ee).
    pub(crate) fn json(&self) -> Vec<u8> {
        let mut position = Map::new();
        position.insert("position_type".to_owned(), "text".into());
        position.insert(
            "base_sha".to_owned(),
            self.diff_refs.base_sha.clone().into(),
        );
        position.insert(
            "start_sha".to_owned(),
            self.diff_refs.start_sha.clone().into(),
        );
        position.insert(
            "head_sha".to_owned(),
            self.diff_refs.head_sha.clone().into(),
        );
        position.insert("old_path".to_owned(), self.place.old_path.clone().into());
        position.insert("new_path".to_owned(), self.place.new_path.clone().into());
        insert_lines(&mut position, self.place.old_line, self.place.new_line);
        if let Some(multi_line) = &self.multi_line {
            let mut line_range = Map::new();
            line_range.insert("start".to_owned(), multi_line.start.json());
            line_range.insert("end".to_owned(), multi_line.end.json());
            position.insert("line_range".to_owned(), Value::Object(line_range));
        }
        let mut body = Map::new();
        body.insert("note".to_owned(), self.note.clone().into());
        body.insert("position".to_owned(), Value::Object(position));
        Value::Object(body).to_string().into_bytes()
    }
}

/// `old_line` and `new_line`, each only when the line has one.
fn insert_lines(object: &mut Map<String, Value>, old_line: Option<u32>, new_line: Option<u32>) {
    if let Some(line) = old_line {
        object.insert("old_line".to_owned(), line.into());
    }
    if let Some(line) = new_line {
        object.insert("new_line".to_owned(), line.into());
    }
}

/// A draft GitLab already holds for this body: the same text, paths, lines, range ends and head commit.
pub(crate) fn same_draft(body: &PostBody, draft: &DraftNote) -> bool {
    let Some(placed) = &draft.placed else {
        return false;
    };
    draft.note == body.note
        && placed.head_sha == body.diff_refs.head_sha
        && placed.place == body.place
        && same_range(body.multi_line.as_ref(), placed.multi_line.as_ref())
}

/// The same ends by their type and lines; `line_code` follows from those and the path.
fn same_range(body: Option<&MultiLine>, draft: Option<&MultiLine>) -> bool {
    match (body, draft) {
        (None, None) => true,
        (Some(body), Some(draft)) => {
            same_end(&body.start, &draft.start) && same_end(&body.end, &draft.end)
        }
        (Some(_), None) | (None, Some(_)) => false,
    }
}

fn same_end(body: &RangeEnd, draft: &RangeEnd) -> bool {
    body.line_type == draft.line_type
        && body.old_line == draft.old_line
        && body.new_line == draft.new_line
}

#[cfg(test)]
mod tests {
    use yamt_merge_core::{LeftLine, RightLine};
    use yamt_range::{RangeFileId, RangeLineCounts};

    use super::*;
    use crate::gitlab::drafts::PlacedDraft;

    fn entry(path: &str, change: RangeChange) -> RangeEntry {
        RangeEntry {
            id: RangeFileId(0),
            path: path.to_owned(),
            change,
            lines: RangeLineCounts::NotCounted,
        }
    }

    fn place(old_path: &str, new_path: &str, old: Option<u32>, new: Option<u32>) -> LinePlace {
        LinePlace {
            old_path: old_path.to_owned(),
            new_path: new_path.to_owned(),
            old_line: old,
            new_line: new,
        }
    }

    fn body() -> PostBody {
        PostBody {
            note: "Why 300?".to_owned(),
            diff_refs: DiffRefs {
                base_sha: "b".repeat(40),
                start_sha: "s".repeat(40),
                head_sha: "h".repeat(40),
            },
            place: place("a.ts", "a.ts", Some(3), Some(4)),
            multi_line: None,
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

    /// From the removed line 2 to the unchanged line 3 / 4, the body's own line.
    fn range_body() -> PostBody {
        PostBody {
            multi_line: Some(MultiLine {
                start: range_end("h_2_4", Some(LineType::Old), Some(2), None),
                end: range_end("h_3_4", None, Some(3), Some(4)),
            }),
            ..body()
        }
    }

    #[test]
    fn removed_added_and_unchanged_give_one_based_old_and_new_lines() {
        let modified = entry("a.ts", RangeChange::Modified);
        let removed = ThreadLine::Removed { left: LeftLine(0) };
        let added = ThreadLine::Added {
            right: RightLine(6),
        };
        let on_left = ThreadLine::UnchangedOnLeft {
            left: LeftLine(10),
            right: RightLine(12),
        };
        let on_right = ThreadLine::UnchangedOnRight {
            left: LeftLine(10),
            right: RightLine(12),
        };
        let at = |line| line_place(&modified, line);
        assert_eq!(at(removed), Ok(place("a.ts", "a.ts", Some(1), None)));
        assert_eq!(at(added), Ok(place("a.ts", "a.ts", None, Some(7))));
        assert_eq!(at(on_left), Ok(place("a.ts", "a.ts", Some(11), Some(13))));
        assert_eq!(at(on_right), Ok(place("a.ts", "a.ts", Some(11), Some(13))));
    }

    #[test]
    fn renamed_added_and_deleted_files_give_both_paths() {
        let line = ThreadLine::UnchangedOnRight {
            left: LeftLine(0),
            right: RightLine(0),
        };
        let renamed = RangeChange::Renamed {
            old_path: "docs/shortcuts.md".to_owned(),
        };
        let at = |path, change| {
            line_place(&entry(path, change), line).map(|place| (place.old_path, place.new_path))
        };
        let both = |old: &str, new: &str| Ok((old.to_owned(), new.to_owned()));
        assert_eq!(
            at("docs/keys.md", renamed),
            both("docs/shortcuts.md", "docs/keys.md")
        );
        assert_eq!(
            at("src/new.ts", RangeChange::Added),
            both("src/new.ts", "src/new.ts")
        );
        assert_eq!(
            at("src/gone.ts", RangeChange::Deleted),
            both("src/gone.ts", "src/gone.ts")
        );
        let lossy = RangeChange::Renamed {
            old_path: "caf\u{FFFD}.txt".to_owned(),
        };
        assert_eq!(at("cafe.txt", lossy), Err(NOT_UTF8));
        assert_eq!(at("caf\u{FFFD}.txt", RangeChange::Added), Err(NOT_UTF8));
    }

    #[test]
    fn the_body_leaves_out_the_line_a_side_does_not_have() {
        let mut removed = body();
        removed.place.new_line = None;
        let json: Value = serde_json::from_slice(&removed.json()).unwrap();
        let expected = serde_json::json!({
            "note": "Why 300?",
            "position": {
                "position_type": "text",
                "base_sha": "b".repeat(40),
                "start_sha": "s".repeat(40),
                "head_sha": "h".repeat(40),
                "old_path": "a.ts",
                "new_path": "a.ts",
                "old_line": 3,
            },
        });
        assert_eq!(json, expected);
        let mut added = body();
        added.place.old_line = None;
        let json: Value = serde_json::from_slice(&added.json()).unwrap();
        assert_eq!(json["position"].get("old_line"), None);
        assert_eq!(json["position"]["new_line"], 4);
    }

    #[test]
    fn a_one_line_body_has_no_line_range() {
        let json: Value = serde_json::from_slice(&body().json()).unwrap();
        assert_eq!(json["position"].get("line_range"), None);
        assert_eq!(json["position"]["old_line"], 3);
        assert_eq!(json["position"]["new_line"], 4);
    }

    #[test]
    fn a_range_body_has_line_range_and_names_its_end_line() {
        let json: Value = serde_json::from_slice(&range_body().json()).unwrap();
        let line_range = serde_json::json!({
            "start": { "line_code": "h_2_4", "type": "old", "old_line": 2 },
            "end": { "line_code": "h_3_4", "old_line": 3, "new_line": 4 },
        });
        assert_eq!(json["position"]["line_range"], line_range);
        assert_eq!(json["position"]["old_line"], 3);
        assert_eq!(json["position"]["new_line"], 4);
        assert_eq!(json["note"], "Why 300?");
    }

    #[test]
    fn a_draft_is_the_same_only_with_the_same_text_place_and_head() {
        let draft = |note: &str, head: &str, place: LinePlace| DraftNote {
            id: 301,
            note: note.to_owned(),
            placed: Some(PlacedDraft {
                head_sha: head.to_owned(),
                place,
                multi_line: None,
            }),
        };
        let head = "h".repeat(40);
        let here = body().place;
        assert!(same_draft(&body(), &draft("Why 300?", &head, here.clone())));
        assert!(!same_draft(
            &body(),
            &draft("Why 300 ms?", &head, here.clone())
        ));
        assert!(!same_draft(
            &body(),
            &draft("Why 300?", &"b".repeat(40), here)
        ));
        let elsewhere = place("a.ts", "a.ts", Some(3), Some(5));
        assert!(!same_draft(&body(), &draft("Why 300?", &head, elsewhere)));
        let on_no_line = DraftNote {
            id: 302,
            note: "Why 300?".to_owned(),
            placed: None,
        };
        assert!(!same_draft(&body(), &on_no_line));
    }

    fn range_draft(multi_line: Option<MultiLine>) -> DraftNote {
        DraftNote {
            id: 401,
            note: "Why 300?".to_owned(),
            placed: Some(PlacedDraft {
                head_sha: "h".repeat(40),
                place: body().place,
                multi_line,
            }),
        }
    }

    #[test]
    fn a_draft_is_the_same_only_with_the_same_range_or_both_without() {
        let range = range_body().multi_line;
        assert!(same_draft(&range_body(), &range_draft(range.clone())));
        assert!(same_draft(&body(), &range_draft(None)));
        assert!(!same_draft(&range_body(), &range_draft(None)));
        assert!(!same_draft(&body(), &range_draft(range.clone())));

        let range = range.unwrap();
        let other_code = MultiLine {
            start: range_end("x_2_4", Some(LineType::Old), Some(2), None),
            ..range.clone()
        };
        assert!(same_draft(&range_body(), &range_draft(Some(other_code))));
        let changed_ends = [
            range_end("h_2_4", Some(LineType::New), Some(2), None),
            range_end("h_2_4", None, Some(2), None),
            range_end("h_2_4", Some(LineType::Old), Some(1), None),
            range_end("h_2_4", Some(LineType::Old), Some(2), Some(4)),
        ];
        for changed in changed_ends {
            let other_start = MultiLine {
                start: changed.clone(),
                ..range.clone()
            };
            assert!(!same_draft(&range_body(), &range_draft(Some(other_start))));
            let other_end = MultiLine {
                end: changed,
                ..range.clone()
            };
            assert!(!same_draft(&range_body(), &range_draft(Some(other_end))));
        }
    }
}

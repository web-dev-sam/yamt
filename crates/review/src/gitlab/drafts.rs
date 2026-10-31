use serde_json::Value;

use super::{LinePlace, field_at, number_at, optional_line_at, text_at, unexpected};
use crate::position::{LineType, MultiLine, RangeEnd};

/// One of the user's draft notes on the merge request.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct DraftNote {
    pub(crate) id: u64,
    pub(crate) note: String,
    /// `None` for a draft on no line.
    pub(crate) placed: Option<PlacedDraft>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PlacedDraft {
    pub(crate) head_sha: String,
    pub(crate) place: LinePlace,
    /// `None` for a draft on one line.
    pub(crate) multi_line: Option<MultiLine>,
}

/// The drafts `glab api --paginate` printed: one JSON array, or one per page.
pub(crate) fn draft_notes_from(json: &[u8]) -> Result<Vec<DraftNote>, String> {
    let mut drafts = Vec::new();
    for page in serde_json::Deserializer::from_slice(json).into_iter::<Value>() {
        let page = page.map_err(|error| format!("GitLab's answer is not JSON: {error}"))?;
        let Value::Array(items) = page else {
            return Err(unexpected("draft notes", "list"));
        };
        for item in items {
            drafts.push(draft_note_from(&item)?);
        }
    }
    Ok(drafts)
}

fn draft_note_from(item: &Value) -> Result<DraftNote, String> {
    Ok(DraftNote {
        id: number_at(item, "id")?,
        note: text_at(item, "note")?,
        placed: placed_draft_from(item).ok(),
    })
}

/// A draft on no line has no position, or one without paths: it matches no message.
fn placed_draft_from(item: &Value) -> Result<PlacedDraft, String> {
    Ok(PlacedDraft {
        head_sha: text_at(item, "position.head_sha")?,
        place: LinePlace {
            old_path: text_at(item, "position.old_path")?,
            new_path: text_at(item, "position.new_path")?,
            old_line: optional_line_at(item, "position.old_line")?,
            new_line: optional_line_at(item, "position.new_line")?,
        },
        multi_line: multi_line_from(item)?,
    })
}

fn multi_line_from(item: &Value) -> Result<Option<MultiLine>, String> {
    match field_at(item, "position.line_range") {
        None | Some(Value::Null) => Ok(None),
        Some(_) => Ok(Some(MultiLine {
            start: range_end_at(item, "position.line_range.start")?,
            end: range_end_at(item, "position.line_range.end")?,
        })),
    }
}

fn range_end_at(item: &Value, path: &str) -> Result<RangeEnd, String> {
    Ok(RangeEnd {
        line_code: text_at(item, &format!("{path}.line_code"))?,
        line_type: line_type_at(item, &format!("{path}.type"))?,
        old_line: optional_line_at(item, &format!("{path}.old_line"))?,
        new_line: optional_line_at(item, &format!("{path}.new_line"))?,
    })
}

fn line_type_at(item: &Value, path: &str) -> Result<Option<LineType>, String> {
    match field_at(item, path) {
        None | Some(Value::Null) => Ok(None),
        Some(line_type) => line_type
            .as_str()
            .and_then(LineType::from_gitlab_name)
            .map(Some)
            .ok_or_else(|| unexpected(path, "line type")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_page_of_drafts_is_read_and_a_draft_on_no_line_is_kept_unplaced() {
        let pages = br#"[{"id":1,"note":"a","position":{"head_sha":"h","old_path":"x","new_path":"y","old_line":null,"new_line":2}}]
[{"id":2,"note":"b","position":null},{"id":3,"note":"c","position":{"head_sha":"h","old_path":null}}]"#;
        let drafts = draft_notes_from(pages).unwrap();
        let place = LinePlace {
            old_path: "x".to_owned(),
            new_path: "y".to_owned(),
            old_line: None,
            new_line: Some(2),
        };
        let placed = PlacedDraft {
            head_sha: "h".to_owned(),
            place,
            multi_line: None,
        };
        let unplaced = |id: u64, note: &str| DraftNote {
            id,
            note: note.to_owned(),
            placed: None,
        };
        let first = DraftNote {
            placed: Some(placed),
            ..unplaced(1, "a")
        };
        assert_eq!(drafts, [first, unplaced(2, "b"), unplaced(3, "c")]);
        assert_eq!(draft_notes_from(b"[]").unwrap(), []);
        assert_eq!(
            draft_notes_from(br#"[{"id":4}]"#),
            Err("unexpected answer from GitLab: `note` is not a text".to_owned())
        );
        assert!(draft_notes_from(br#"{"id":4}"#).is_err());
    }

    /// The draft read back from a position with this `line_range`; `None` when it has no place.
    fn placed_with(line_range: &str) -> Option<PlacedDraft> {
        let json = format!(
            r#"[{{"id":1,"note":"a","position":{{"head_sha":"h","old_path":"x","new_path":"x","new_line":4,"line_range":{line_range}}}}}]"#
        );
        let drafts = draft_notes_from(json.as_bytes()).unwrap();
        drafts[0].placed.clone()
    }

    fn range_of(line_range: &str) -> MultiLine {
        placed_with(line_range).unwrap().multi_line.unwrap()
    }

    #[test]
    fn drafts_read_back_their_line_range_or_none() {
        assert_eq!(placed_with("null").unwrap().multi_line, None);
        let missing = br#"[{"id":1,"note":"a","position":{"head_sha":"h","old_path":"x","new_path":"x","new_line":4}}]"#;
        let drafts = draft_notes_from(missing).unwrap();
        assert_eq!(drafts[0].placed.as_ref().unwrap().multi_line, None);

        let both = r#"{"start":{"line_code":"c_1_2","type":null,"old_line":1,"new_line":2},
            "end":{"line_code":"c_3_4","type":"new","old_line":null,"new_line":4}}"#;
        let expected = MultiLine {
            start: RangeEnd {
                line_code: "c_1_2".to_owned(),
                line_type: None,
                old_line: Some(1),
                new_line: Some(2),
            },
            end: RangeEnd {
                line_code: "c_3_4".to_owned(),
                line_type: Some(LineType::New),
                old_line: None,
                new_line: Some(4),
            },
        };
        assert_eq!(range_of(both), expected);
        let old_without_type = r#"{"start":{"line_code":"c_3_4","type":"old","old_line":3},
            "end":{"line_code":"c_3_4","old_line":3,"new_line":4}}"#;
        let ends = range_of(old_without_type);
        assert_eq!(
            (ends.start.line_type, ends.start.new_line),
            (Some(LineType::Old), None)
        );
        assert_eq!(ends.end.line_type, None);
    }

    #[test]
    fn a_malformed_line_range_leaves_the_draft_without_a_place() {
        let malformed = [
            r#"{"start":{"line_code":"c","type":"context"},"end":{"line_code":"c"}}"#,
            r#"{"start":{"line_code":"c","type":3},"end":{"line_code":"c"}}"#,
            r#"{"start":{"type":"new"},"end":{"line_code":"c"}}"#,
            r#"{"start":{"line_code":"c"},"end":{"line_code":"c","new_line":"4"}}"#,
            r#"{"start":{"line_code":"c"}}"#,
            r#""lines 1 to 4""#,
        ];
        for line_range in malformed {
            assert_eq!(placed_with(line_range), None, "{line_range}");
        }
    }
}

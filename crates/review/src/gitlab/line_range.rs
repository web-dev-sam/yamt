use serde_json::{Map, Value};

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
    pub(crate) fn json(&self) -> Value {
        let mut end = Map::new();
        end.insert("line_code".to_owned(), self.line_code.clone().into());
        if let Some(line_type) = self.line_type {
            end.insert("type".to_owned(), line_type.gitlab_name().into());
        }
        insert_lines(&mut end, self.old_line, self.new_line);
        Value::Object(end)
    }
}

/// `old_line` and `new_line`, each only when the line has one.
pub(crate) fn insert_lines(
    object: &mut Map<String, Value>,
    old_line: Option<u32>,
    new_line: Option<u32>,
) {
    if let Some(line) = old_line {
        object.insert("old_line".to_owned(), line.into());
    }
    if let Some(line) = new_line {
        object.insert("new_line".to_owned(), line.into());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

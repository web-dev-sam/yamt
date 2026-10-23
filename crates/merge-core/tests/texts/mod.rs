use proptest::collection::vec;
use proptest::prelude::*;
use proptest::sample::Index;

const LINE: &str = "[ab_é😀 \t(;\r]{0,6}(\n|\r\n)";
pub const LAST_LINE: &str = "[ab_é😀 \t(;]{0,4}";

#[derive(Clone, Debug)]
pub enum Edit {
    Insert(String),
    Delete,
    Replace(String),
}

#[derive(Clone, Debug)]
pub struct Doc {
    lines: Vec<String>,
    last: String,
}

impl Doc {
    pub fn text(&self) -> String {
        self.lines.concat() + &self.last
    }

    pub fn edited(&self, edits: &[(Index, Edit)], last: Option<String>) -> Doc {
        let mut lines = self.lines.clone();
        for (at, edit) in edits {
            match edit {
                Edit::Insert(line) => lines.insert(at.index(lines.len() + 1), line.clone()),
                Edit::Delete if !lines.is_empty() => {
                    lines.remove(at.index(lines.len()));
                }
                Edit::Replace(line) if !lines.is_empty() => {
                    let replaced = at.index(lines.len());
                    lines[replaced].clone_from(line);
                }
                Edit::Delete | Edit::Replace(_) => {}
            }
        }
        Doc {
            lines,
            last: last.unwrap_or_else(|| self.last.clone()),
        }
    }
}

pub fn doc(max_lines: usize) -> impl Strategy<Value = Doc> {
    (vec(LINE, 0..max_lines), LAST_LINE).prop_map(|(lines, last)| Doc { lines, last })
}

pub fn edits(max_edits: usize) -> impl Strategy<Value = Vec<(Index, Edit)>> {
    let edit = prop_oneof![
        LINE.prop_map(Edit::Insert),
        Just(Edit::Delete),
        LINE.prop_map(Edit::Replace),
    ];
    vec((any::<Index>(), edit), 0..max_edits)
}

pub fn content(line: &str) -> &str {
    line.strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line)
}

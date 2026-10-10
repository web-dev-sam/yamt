use proptest::collection::vec;
use proptest::prelude::*;
use proptest::sample::Index;
use yamt_merge_core::{Options, SideWordChanges, compute_chunks, word_changes};

const INDENTS: [&str; 5] = ["", "\t", "\t\t", "  ", "    "];
const WORDS_PER_LINE: usize = 3;
const MIN_LINES: usize = 3;
const MAX_LINES: usize = 30;
const MAX_EDITS: usize = 10;
const CASES: u32 = 512;

#[derive(Clone, Debug)]
struct Line {
    indent: &'static str,
    words: Vec<String>,
}

impl Line {
    fn text(&self) -> String {
        format!("{}{};\n", self.indent, self.words.join(" "))
    }

    fn word_columns(&self, word: usize) -> (usize, usize) {
        let before: usize = self.words[..word].iter().map(|word| word.len() + 1).sum();
        let start = self.indent.len() + before;
        (start, start + self.words[word].len())
    }
}

#[derive(Clone, Debug)]
enum Edit {
    Reindent(Index),
    ReplaceWord(Index),
    InsertWord(Index),
    DeleteWord(Index),
    InsertLine,
    DeleteLine,
    Split(Index),
    Join,
}

/// What the marks of one side line may be, known from the edit that made it.
#[derive(Clone, Copy, Debug)]
enum Truth {
    Untouched,
    Reindented { width: usize },
    OneWord { start: usize, end: usize },
    WordDeleted { column: usize },
    Unconstrained,
}

#[derive(Debug, Default)]
struct Side {
    text: String,
    truths: Vec<Truth>,
    fresh_words: u32,
}

impl Side {
    fn push(&mut self, text: &str, truth: Truth) {
        self.text += text;
        self.truths.push(truth);
    }

    fn fresh_word(&mut self) -> String {
        self.fresh_words += 1;
        format!("new{}", self.fresh_words)
    }

    fn push_edited(&mut self, line: &Line, edit: &Edit) {
        let mut line = line.clone();
        match edit {
            Edit::Reindent(at) => {
                let mut indent = at.index(INDENTS.len());
                if INDENTS[indent] == line.indent {
                    indent = (indent + 1) % INDENTS.len();
                }
                line.indent = INDENTS[indent];
                let width = line.indent.len();
                self.push(&line.text(), Truth::Reindented { width });
            }
            Edit::ReplaceWord(at) => {
                let position = at.index(WORDS_PER_LINE);
                line.words[position] = self.fresh_word();
                self.push_one_word(&line, position);
            }
            Edit::InsertWord(at) => {
                let position = at.index(WORDS_PER_LINE + 1);
                line.words.insert(position, self.fresh_word());
                self.push_one_word(&line, position);
            }
            Edit::DeleteWord(at) => self.push_word_deleted(line, at.index(WORDS_PER_LINE)),
            Edit::InsertLine => {
                let words = (0..WORDS_PER_LINE).map(|_| self.fresh_word()).collect();
                let indent = line.indent;
                self.push(&Line { indent, words }.text(), Truth::Unconstrained);
                self.push(&line.text(), Truth::Untouched);
            }
            Edit::DeleteLine => {}
            Edit::Split(at) => self.push_split(&line, 1 + at.index(WORDS_PER_LINE - 1)),
            Edit::Join => self.push(&line.text(), Truth::Untouched),
        }
    }

    fn push_one_word(&mut self, line: &Line, position: usize) {
        let (start, end) = line.word_columns(position);
        self.push(&line.text(), Truth::OneWord { start, end });
    }

    /// The point is pinned at the start of the word that moved into the deleted one's place, or
    /// at the end of the line's words when the last one was deleted.
    fn push_word_deleted(&mut self, mut line: Line, position: usize) {
        line.words.remove(position);
        let column = if position < line.words.len() {
            line.word_columns(position).0
        } else {
            line.word_columns(position - 1).1
        };
        self.push(&line.text(), Truth::WordDeleted { column });
    }

    fn push_split(&mut self, line: &Line, position: usize) {
        let first = format!("{}{}\n", line.indent, line.words[..position].join(" "));
        let second = format!("{}\t{};\n", line.indent, line.words[position..].join(" "));
        self.push(&first, Truth::Unconstrained);
        self.push(&second, Truth::Unconstrained);
    }
}

fn base_lines(indents: &[Index]) -> Vec<Line> {
    (0..)
        .zip(indents)
        .map(|(line, indent): (usize, &Index)| Line {
            indent: INDENTS[indent.index(INDENTS.len())],
            words: ["a", "b", "c"]
                .iter()
                .map(|suffix| format!("l{line}{suffix}"))
                .collect(),
        })
        .collect()
}

/// Applies at most one edit per base line; a join also consumes the next line.
fn edited(base: &[Line], edits: &[(Index, Edit)]) -> Side {
    let mut planned: Vec<Option<&Edit>> = vec![None; base.len()];
    for (at, edit) in edits {
        planned[at.index(base.len())].get_or_insert(edit);
    }
    let mut side = Side::default();
    let mut line = 0;
    while line < base.len() {
        let next_is_free = line + 1 < base.len() && planned[line + 1].is_none();
        match planned[line] {
            Some(Edit::Join) if next_is_free => {
                let joined = format!(
                    "{} {}",
                    base[line].text().trim_end(),
                    base[line + 1].text().trim()
                );
                side.push(&format!("{joined}\n"), Truth::Unconstrained);
                line += 2;
                continue;
            }
            Some(edit) => side.push_edited(&base[line], edit),
            None => side.push(&base[line].text(), Truth::Untouched),
        }
        line += 1;
    }
    side
}

fn edit() -> impl Strategy<Value = Edit> {
    prop_oneof![
        any::<Index>().prop_map(Edit::Reindent),
        any::<Index>().prop_map(Edit::ReplaceWord),
        any::<Index>().prop_map(Edit::InsertWord),
        any::<Index>().prop_map(Edit::DeleteWord),
        Just(Edit::InsertLine),
        Just(Edit::DeleteLine),
        any::<Index>().prop_map(Edit::Split),
        Just(Edit::Join),
    ]
}

fn case() -> impl Strategy<Value = (Vec<Line>, Side, Side)> {
    (
        vec(any::<Index>(), MIN_LINES..=MAX_LINES),
        vec((any::<Index>(), edit()), 1..=MAX_EDITS),
        vec((any::<Index>(), edit()), 0..=MAX_EDITS),
    )
        .prop_map(|(indents, local_edits, remote_edits)| {
            let base = base_lines(&indents);
            let local = edited(&base, &local_edits);
            let remote = edited(&base, &remote_edits);
            (base, local, remote)
        })
}

fn check_promises<'a, L: Copy + 'a>(
    side: &Side,
    changes: impl Iterator<Item = &'a SideWordChanges<L>>,
    index: fn(L) -> u32,
) -> Result<(), TestCaseError> {
    let mut ranges: Vec<Vec<(usize, usize)>> = vec![Vec::new(); side.truths.len()];
    let mut points: Vec<Vec<usize>> = vec![Vec::new(); side.truths.len()];
    for change in changes {
        for range in &change.changed {
            let (start, end) = (range.start as usize, (range.start + range.len) as usize);
            ranges[index(range.line) as usize].push((start, end));
        }
        for point in &change.removed_at {
            points[index(point.line) as usize].push(point.column as usize);
        }
    }
    for (line, truth) in side.truths.iter().enumerate() {
        let on_line = &ranges[line];
        let message = format!("line {line} {truth:?} ranges {on_line:?}\n{}", side.text);
        match *truth {
            Truth::Untouched => prop_assert!(on_line.is_empty(), "{}", message),
            Truth::Reindented { width } => {
                prop_assert!(on_line.iter().all(|&(_, end)| end <= width), "{}", message);
            }
            Truth::OneWord { start, end } => prop_assert!(
                on_line
                    .iter()
                    .all(|&(from, to)| from + 1 >= start && to <= end + 1),
                "{}",
                message
            ),
            Truth::WordDeleted { column } => {
                prop_assert!(
                    points[line].contains(&column),
                    "{} points {:?}",
                    message,
                    points[line]
                );
            }
            Truth::Unconstrained => {}
        }
    }
    Ok(())
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(CASES))]

    #[test]
    fn edits_on_one_side_keep_every_promise((base, local, _) in case()) {
        let base: String = base.iter().map(Line::text).collect();
        let chunks = compute_chunks(&base, &local.text, &base, &Options::default());
        let words = word_changes(&base, &local.text, &base, &chunks);
        check_promises(&local, words.iter().map(|change| &change.local), |line| line.0)?;
        for change in &words {
            prop_assert!(change.remote.changed.is_empty() && change.remote.removed_at.is_empty());
        }
    }

    #[test]
    fn edits_on_both_sides_keep_every_promise_on_each((base, local, remote) in case()) {
        let base: String = base.iter().map(Line::text).collect();
        let chunks = compute_chunks(&base, &local.text, &remote.text, &Options::default());
        let words = word_changes(&base, &local.text, &remote.text, &chunks);
        check_promises(&local, words.iter().map(|change| &change.local), |line| line.0)?;
        check_promises(&remote, words.iter().map(|change| &change.remote), |line| line.0)?;
    }
}

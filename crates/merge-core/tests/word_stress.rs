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
const MAX_DELETED: usize = 4;

/// Which neighbours of a deleted run have one word replaced, so that they pair with base.
#[derive(Clone, Copy, Debug)]
enum Neighbours {
    Before,
    After,
    Both,
}

/// Base lines, with `len` lines from `start` deleted and the run's `neighbours` edited.
#[derive(Debug)]
struct DeletedRun {
    base: Vec<Line>,
    start: usize,
    len: usize,
    neighbours: Neighbours,
}

impl DeletedRun {
    fn side_text(&self) -> String {
        let mut text = String::new();
        for (index, line) in self.base.iter().enumerate() {
            if (self.start..self.start + self.len).contains(&index) {
                continue;
            }
            let is_before = index + 1 == self.start;
            let is_after = index == self.start + self.len;
            let edited = match self.neighbours {
                Neighbours::Before => is_before,
                Neighbours::After => is_after,
                Neighbours::Both => is_before || is_after,
            };
            if edited {
                text += &with_new_word(line).text();
            } else {
                text += &line.text();
            }
        }
        text
    }

    /// The one removal: every deleted line in order, each followed by its line break at the start
    /// of the line after the run, or each preceded by one at the end of the line before it.
    fn removal(&self) -> (u32, usize, String) {
        let deleted = &self.base[self.start..self.start + self.len];
        let contents: Vec<String> = deleted
            .iter()
            .map(|line| line.text().trim_end().to_owned())
            .collect();
        let side_line = u32::try_from(self.start).unwrap_or(u32::MAX);
        match self.neighbours {
            Neighbours::After | Neighbours::Both => {
                let text = contents
                    .iter()
                    .flat_map(|line| [line.as_str(), "\n"])
                    .collect();
                (side_line, 0, text)
            }
            Neighbours::Before => {
                let width = with_new_word(&self.base[self.start - 1])
                    .text()
                    .trim_end()
                    .len();
                let text = contents
                    .iter()
                    .flat_map(|line| ["\n", line.as_str()])
                    .collect();
                (side_line - 1, width, text)
            }
        }
    }
}

fn with_new_word(line: &Line) -> Line {
    let mut line = line.clone();
    line.words[1] = String::from("new");
    line
}

fn deleted_run() -> impl Strategy<Value = DeletedRun> {
    (
        vec(any::<Index>(), MAX_DELETED + 2..=MAX_LINES),
        1..=MAX_DELETED,
        any::<Index>(),
        prop_oneof![
            Just(Neighbours::Before),
            Just(Neighbours::After),
            Just(Neighbours::Both)
        ],
    )
        .prop_map(|(indents, len, start, neighbours)| DeletedRun {
            start: 1 + start.index(indents.len() - len - 1),
            base: base_lines(&indents),
            len,
            neighbours,
        })
}

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
#[derive(Clone, Debug)]
enum Truth {
    Untouched,
    Reindented { width: usize },
    OneWord { start: usize, end: usize },
    WordDeleted { column: usize, word: String },
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

    /// The removal is pinned at the start of the word that moved into the deleted one's place, or
    /// at the end of the line's words when the last one was deleted, and holds the deleted word.
    fn push_word_deleted(&mut self, mut line: Line, position: usize) {
        let word = line.words.remove(position);
        let column = if position < line.words.len() {
            line.word_columns(position).0
        } else {
            line.word_columns(position - 1).1
        };
        self.push(&line.text(), Truth::WordDeleted { column, word });
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
    let mut removals: Vec<Vec<(usize, &str)>> = vec![Vec::new(); side.truths.len()];
    for change in changes {
        for range in &change.changed {
            let (start, end) = (range.start as usize, (range.start + range.len) as usize);
            ranges[index(range.line) as usize].push((start, end));
        }
        for removal in &change.removals {
            let at = (removal.at.column as usize, removal.text.as_str());
            removals[index(removal.at.line) as usize].push(at);
        }
    }
    for (line, truth) in side.truths.iter().enumerate() {
        let on_line = &ranges[line];
        let message = format!("line {line} {truth:?} ranges {on_line:?}\n{}", side.text);
        match truth {
            Truth::Untouched => prop_assert!(on_line.is_empty(), "{}", message),
            Truth::Reindented { width } => {
                prop_assert!(on_line.iter().all(|&(_, end)| end <= *width), "{}", message);
            }
            Truth::OneWord { start, end } => prop_assert!(
                on_line
                    .iter()
                    .all(|&(from, to)| from + 1 >= *start && to <= end + 1),
                "{}",
                message
            ),
            Truth::WordDeleted { column, word } => {
                let holds_word = |&(at, text): &(usize, &str)| at == *column && text.contains(word);
                let held = &removals[line];
                prop_assert!(held.iter().any(holds_word), "{message} removals {held:?}");
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
            prop_assert!(change.remote.changed.is_empty() && change.remote.removals.is_empty());
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

    #[test]
    fn a_deleted_run_is_removed_whole_and_in_order(run in deleted_run()) {
        let base: String = run.base.iter().map(Line::text).collect();
        let side = run.side_text();
        let chunks = compute_chunks(&base, &side, &base, &Options::default());
        prop_assert_eq!(chunks.len(), 1);
        let words = word_changes(&base, &side, &base, &chunks);
        let removals: Vec<(u32, usize, String)> = words[0]
            .local
            .removals
            .iter()
            .map(|removal| (removal.at.line.0, removal.at.column as usize, removal.text.clone()))
            .collect();
        prop_assert_eq!(removals, vec![run.removal()], "{}", side);
    }
}

#![cfg(test)]

use proptest::collection::vec;
use proptest::option;
use proptest::prelude::*;
use proptest::sample::{Index, subsequence};
use yamt_merge_core::{
    Difference, InlinePoint, InlineRange, LeftLine, Options, RightLine, SideWordChanges, compare,
    compute_chunks,
};

const LINE: &str = "[ab_é😀 \t(;\r]{0,6}(\n|\r\n)";
const LAST_LINE: &str = "[ab_é😀 \t(;]{0,4}";
const MAX_LINES: usize = 10;
const MAX_EDITS: usize = 5;
const CASES: u32 = 512;
const WORDS: [&str; 5] = ["alpha", "beta", "gamma", "delta", "omega"];
const NEW_WORD: &str = "CHANGED";

#[derive(Clone, Debug)]
enum Edit {
    Insert(String),
    Delete,
    Replace(String),
}

#[derive(Clone, Debug)]
struct Doc {
    lines: Vec<String>,
    last: String,
}

impl Doc {
    fn text(&self) -> String {
        self.lines.concat() + &self.last
    }

    fn edited(&self, edits: &[(Index, Edit)], last: Option<String>) -> Doc {
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

#[derive(Clone, Debug)]
struct Pair {
    left: String,
    right: String,
}

fn doc() -> impl Strategy<Value = Doc> {
    (vec(LINE, 0..MAX_LINES), LAST_LINE).prop_map(|(lines, last)| Doc { lines, last })
}

fn edits() -> impl Strategy<Value = Vec<(Index, Edit)>> {
    let edit = prop_oneof![
        LINE.prop_map(Edit::Insert),
        Just(Edit::Delete),
        LINE.prop_map(Edit::Replace),
    ];
    vec((any::<Index>(), edit), 0..MAX_EDITS)
}

fn pair() -> impl Strategy<Value = Pair> {
    let edited = (doc(), edits(), option::of(LAST_LINE)).prop_map(|(left, edits, last)| Pair {
        right: left.edited(&edits, last).text(),
        left: left.text(),
    });
    let independent = (doc(), doc()).prop_map(|(left, right)| Pair {
        left: left.text(),
        right: right.text(),
    });
    prop_oneof![4 => edited, 1 => independent]
}

fn lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

fn content(line: &str) -> &str {
    line.strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line)
}

fn width(line: &str) -> u32 {
    u32::try_from(content(line).encode_utf16().count()).unwrap()
}

fn rebuilt_right(left: &str, right: &str, differences: &[Difference]) -> String {
    let (left_lines, right_lines) = (lines(left), lines(right));
    let mut rebuilt = String::new();
    let mut next_left_line = 0;
    for difference in differences {
        rebuilt += &left_lines[next_left_line..difference.left.start.0 as usize].concat();
        let right_start = difference.right.start.0 as usize;
        rebuilt += &right_lines[right_start..difference.right.end().0 as usize].concat();
        next_left_line = difference.left.end().0 as usize;
    }
    rebuilt + &left_lines[next_left_line..].concat()
}

/// Every mark of one side lies on a line of its difference, inside that line's content, and
/// every removal carries text.
fn check_side<L: Copy + std::fmt::Debug>(
    side: &SideWordChanges<L>,
    text: &str,
    (first, len): (u32, u32),
    index: fn(L) -> u32,
) -> Result<(), TestCaseError> {
    let text_lines = lines(text);
    let in_difference = |line: u32| line >= first && line < first + len;
    for range in &side.changed {
        let line = index(range.line);
        prop_assert!(in_difference(line), "{range:?} not in {first}+{len}");
        prop_assert!(range.len > 0, "{range:?}");
        let line_width = width(text_lines[line as usize]);
        prop_assert!(
            range.start + range.len <= line_width,
            "{range:?} past {line_width}"
        );
    }
    for removal in &side.removals {
        let line = index(removal.at.line);
        prop_assert!(in_difference(line), "{removal:?} not in {first}+{len}");
        prop_assert!(
            removal.at.column <= width(text_lines[line as usize]),
            "{removal:?}"
        );
    }
    Ok(())
}

/// Lines `l<number> <words>`, and the same lines with one word replaced by `NEW_WORD`; the word
/// starts at `column` in both, `left_len` long in the left.
struct OneWordChange {
    left: String,
    right: String,
    line: u32,
    column: u32,
    left_len: u32,
}

fn one_word_change(text: &[Vec<&str>], changed_line: Index, changed_word: Index) -> OneWordChange {
    let line = changed_line.index(text.len());
    let word = changed_word.index(text[line].len());
    let line_text = |words: &[&str], number: usize| format!("l{number} {}\n", words.join(" "));
    let left_lines: Vec<String> = text
        .iter()
        .enumerate()
        .map(|(number, words)| line_text(words, number))
        .collect();
    let mut right_words = text[line].clone();
    right_words[word] = NEW_WORD;
    let mut right_lines = left_lines.clone();
    right_lines[line] = line_text(&right_words, line);
    let words_before: usize = text[line][..word].iter().map(|word| word.len() + 1).sum();
    OneWordChange {
        left: left_lines.concat(),
        right: right_lines.concat(),
        line: u32::try_from(line).unwrap(),
        column: u32::try_from(format!("l{line} ").len() + words_before).unwrap(),
        left_len: u32::try_from(text[line][word].len()).unwrap(),
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(CASES))]

    // Catches a difference located in the wrong lines on either side, or one left out.
    #[test]
    fn replacing_each_difference_with_its_right_lines_rebuilds_the_right_text(pair in pair()) {
        let differences = compare(&pair.left, &pair.right);
        prop_assert_eq!(rebuilt_right(&pair.left, &pair.right, &differences), pair.right.clone());
    }

    // Catches differences that overlap, touch, run backwards, or mark nothing on either side.
    #[test]
    fn differences_are_sorted_disjoint_and_never_empty_on_both_sides(pair in pair()) {
        let differences = compare(&pair.left, &pair.right);
        for difference in &differences {
            prop_assert!(!(difference.left.is_empty() && difference.right.is_empty()), "{difference:?}");
        }
        for neighbours in differences.windows(2) {
            prop_assert!(neighbours[0].left.end() < neighbours[1].left.start, "{neighbours:?}");
            prop_assert!(neighbours[0].right.end() < neighbours[1].right.start, "{neighbours:?}");
        }
        if let Some(last) = differences.last() {
            prop_assert!(last.left.end().0 as usize <= lines(&pair.left).len());
            prop_assert!(last.right.end().0 as usize <= lines(&pair.right).len());
        }
    }

    // Catches a difference reported for equal texts (e.g. a line break counted as a change).
    #[test]
    fn comparing_a_text_with_itself_finds_nothing(text in doc()) {
        let text = text.text();
        prop_assert!(compare(&text, &text).is_empty());
    }

    // Catches a second diff rule: a gap other than 0 joining nearby hunks, or the texts swapped.
    #[test]
    fn line_ranges_are_the_two_way_chunks_of_compute_chunks(pair in pair()) {
        let chunks = compute_chunks(&pair.left, &pair.left, &pair.right, &Options { gap: 0 });
        let from_chunks: Vec<(u32, u32, u32, u32)> = chunks
            .iter()
            .map(|chunk| (chunk.base.start.0, chunk.base.len, chunk.remote.start.0, chunk.remote.len))
            .collect();
        let from_compare: Vec<(u32, u32, u32, u32)> = compare(&pair.left, &pair.right)
            .iter()
            .map(|difference| (difference.left.start.0, difference.left.len, difference.right.start.0, difference.right.len))
            .collect();
        prop_assert_eq!(from_compare, from_chunks);
    }

    // Catches word marks or removals placed in the other column's lines, or across a line break,
    // and empty removal texts.
    #[test]
    fn every_word_mark_lies_inside_a_line_of_its_own_column(pair in pair()) {
        for difference in compare(&pair.left, &pair.right) {
            let left = (difference.left.start.0, difference.left.len);
            let right = (difference.right.start.0, difference.right.len);
            check_side(&difference.words.left, &pair.left, left, |line| line.0)?;
            check_side(&difference.words.right, &pair.right, right, |line| line.0)?;
            let removals = difference.words.left.removals.iter().map(|removal| &removal.text);
            let right_removals = difference.words.right.removals.iter().map(|removal| &removal.text);
            for removal in removals.chain(right_removals) {
                prop_assert!(!removal.is_empty(), "{difference:?}");
            }
        }
    }

    // Catches marks computed in one direction only (the right against the left, as
    // `word_changes` would), or the two columns' marks swapped.
    #[test]
    fn a_one_word_change_marks_exactly_that_word_in_both_columns(
        text in vec(subsequence(WORDS.to_vec(), 1..=WORDS.len()), 1..MAX_LINES),
        changed_line in any::<Index>(),
        changed_word in any::<Index>(),
    ) {
        let change = one_word_change(&text, changed_line, changed_word);
        let differences = compare(&change.left, &change.right);
        prop_assert_eq!(differences.len(), 1);
        let words = &differences[0].words;
        let new_len = u32::try_from(NEW_WORD.len()).unwrap();
        prop_assert_eq!(&words.left.changed, &vec![InlineRange { line: LeftLine(change.line), start: change.column, len: change.left_len }]);
        prop_assert_eq!(&words.right.changed, &vec![InlineRange { line: RightLine(change.line), start: change.column, len: new_len }]);
        prop_assert!(words.left.removals.is_empty() && words.right.removals.is_empty(), "{words:?}");
    }
}

// Catches removals given to the wrong column: a word only the left has is the left's mark and a
// removal in the right, at the place it would sit.
#[test]
fn a_word_only_in_the_left_is_a_left_mark_and_a_right_removal() {
    let differences = compare("one two three\n", "one three\n");
    assert_eq!(differences.len(), 1);
    let words = &differences[0].words;
    assert_eq!(
        words.left.changed,
        vec![InlineRange {
            line: LeftLine(0),
            start: 4,
            len: 4
        }]
    );
    assert!(words.left.removals.is_empty(), "{words:?}");
    assert!(words.right.changed.is_empty(), "{words:?}");
    let [removal] = words.right.removals.as_slice() else {
        panic!("{words:?}");
    };
    assert_eq!(
        removal.at,
        InlinePoint {
            line: RightLine(0),
            column: 4
        }
    );
    assert_eq!(removal.text, "two ");
}

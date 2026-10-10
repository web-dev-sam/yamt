use std::cmp::Ordering;

use imara_diff::{Algorithm, Diff, InternedInput};

use crate::line::{lines_in, without_line_break};
use crate::token::{TokenKind, line_tokens};

/// Two lines pair when the tokens they share are at least this percentage of their average token
/// count (Dice): `a(1);`/`a(2);` share 50 and pair; `if (!emitted) {` and
/// `if (!scriptSetup || !scriptSetupRanges) {`, sharing only `if`, reach 40 and stay apart.
const MIN_SHARED_PERCENT: usize = 50;

/// Dice counts each shared token once in each line (× 2) and gives a percentage (× 100).
const DICE_PERCENT_SCALE: usize = 200;

/// A gap with more base × side line combinations than this gets no similarity pairing: the
/// table that chooses the pairs has one cell per combination (100 × 100 lines).
const MAX_GAP_COMBINATIONS: usize = 10_000;

/// A line index in base and one in side, counted from the chunk's first line.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct LinePosition {
    pub(crate) base: u32,
    pub(crate) side: u32,
}

/// The pairs of a chunk's base and side lines, in order: lines equal but for whitespace, then
/// similar lines in the gaps between them.
pub(crate) fn line_pairs(base: &[&str], side: &[&str]) -> Vec<LinePosition> {
    let base_squeezed: Vec<String> = base.iter().map(|line| without_whitespace(line)).collect();
    let side_squeezed: Vec<String> = side.iter().map(|line| without_whitespace(line)).collect();
    let mut input = InternedInput::default();
    input.update_before(base_squeezed.iter().map(String::as_str));
    input.update_after(side_squeezed.iter().map(String::as_str));
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    let mut pairs = Vec::new();
    let mut equal_from = LinePosition { base: 0, side: 0 };
    for hunk in diff.hunks() {
        pairs.extend(equal_run(equal_from, hunk.before.start));
        pairs.extend(similar_pairs(
            lines_in(base, &hunk.before),
            lines_in(side, &hunk.after),
            LinePosition {
                base: hunk.before.start,
                side: hunk.after.start,
            },
        ));
        equal_from = LinePosition {
            base: hunk.before.end,
            side: hunk.after.end,
        };
    }
    let base_len = u32::try_from(base.len()).unwrap_or(u32::MAX);
    pairs.extend(equal_run(equal_from, base_len));
    pairs
}

fn without_whitespace(line: &str) -> String {
    line.chars()
        .filter(|character| !character.is_whitespace())
        .collect()
}

fn equal_run(from: LinePosition, base_end: u32) -> impl Iterator<Item = LinePosition> {
    (from.base..base_end)
        .zip(from.side..)
        .map(|(base, side)| LinePosition { base, side })
}

/// Pairs lines of one gap in order so that the sum of their shared percentages is the largest.
fn similar_pairs(base: &[&str], side: &[&str], first: LinePosition) -> Vec<LinePosition> {
    if base.len().saturating_mul(side.len()) > MAX_GAP_COMBINATIONS {
        return Vec::new();
    }
    let base: Vec<ComparedLine> = base.iter().map(|line| compared_line(line)).collect();
    let side: Vec<ComparedLine> = side.iter().map(|line| compared_line(line)).collect();
    let best = best_totals(&base, &side);
    let mut pairs = Vec::new();
    let (mut base_line, mut side_line) = (0, 0);
    while let (Some(base_compared), Some(side_compared)) =
        (base.get(base_line), side.get(side_line))
    {
        let total = best.at(base_line, side_line);
        let pairs_here = match pair_score(base_compared, side_compared) {
            Some(score) => total == score + best.at(base_line + 1, side_line + 1),
            None => false,
        };
        if pairs_here {
            pairs.push(LinePosition {
                base: first.base + u32::try_from(base_line).unwrap_or(u32::MAX),
                side: first.side + u32::try_from(side_line).unwrap_or(u32::MAX),
            });
            base_line += 1;
            side_line += 1;
        } else if total == best.at(base_line + 1, side_line) {
            base_line += 1;
        } else {
            side_line += 1;
        }
    }
    pairs
}

/// One line as the pairing measure sees it; the token lists are sorted.
struct ComparedLine<'a> {
    words: Vec<&'a str>,
    /// Every token but whitespace: the words and the symbols.
    visible: Vec<&'a str>,
    without_whitespace: String,
}

fn compared_line(line: &str) -> ComparedLine<'_> {
    let mut words = Vec::new();
    let mut visible = Vec::new();
    for token in line_tokens(without_line_break(line)) {
        match token.kind {
            TokenKind::Word => {
                words.push(token.text);
                visible.push(token.text);
            }
            TokenKind::Symbol => visible.push(token.text),
            TokenKind::Space => {}
        }
    }
    words.sort_unstable();
    visible.sort_unstable();
    ComparedLine {
        words,
        visible,
        without_whitespace: without_whitespace(line),
    }
}

/// The shared percentage of two lines' words, or of all their visible tokens when either line has
/// no word; `None` below `MIN_SHARED_PERCENT`. A wordless line facing a worded one must also occur
/// inside it, whitespace removed: `}` pairs with `} else {`, `});` never with `bar();`.
fn pair_score(base: &ComparedLine, side: &ComparedLine) -> Option<usize> {
    let (base_tokens, side_tokens) = match (base.words.is_empty(), side.words.is_empty()) {
        (false, false) => (&base.words, &side.words),
        (true, true) => (&base.visible, &side.visible),
        (true, false) if side.without_whitespace.contains(&base.without_whitespace) => {
            (&base.visible, &side.visible)
        }
        (false, true) if base.without_whitespace.contains(&side.without_whitespace) => {
            (&base.visible, &side.visible)
        }
        (true, false) | (false, true) => return None,
    };
    let percent = (DICE_PERCENT_SCALE * shared_count(base_tokens, side_tokens))
        .checked_div(base_tokens.len() + side_tokens.len())?;
    (percent >= MIN_SHARED_PERCENT).then_some(percent)
}

/// For every pair of starting lines, the largest score sum reachable from there.
fn best_totals(base: &[ComparedLine], side: &[ComparedLine]) -> Table {
    let mut best = Table {
        rows: vec![vec![0; side.len()]; base.len()],
    };
    for (base_line, base_compared) in base.iter().enumerate().rev() {
        for (side_line, side_compared) in side.iter().enumerate().rev() {
            let paired = match pair_score(base_compared, side_compared) {
                Some(score) => score + best.at(base_line + 1, side_line + 1),
                None => 0,
            };
            let total = paired
                .max(best.at(base_line + 1, side_line))
                .max(best.at(base_line, side_line + 1));
            best.set(base_line, side_line, total);
        }
    }
    best
}

fn shared_count(base: &[&str], side: &[&str]) -> usize {
    let (mut base_index, mut side_index, mut shared) = (0, 0, 0);
    while let (Some(base_word), Some(side_word)) = (base.get(base_index), side.get(side_index)) {
        match base_word.cmp(side_word) {
            Ordering::Less => base_index += 1,
            Ordering::Greater => side_index += 1,
            Ordering::Equal => {
                shared += 1;
                base_index += 1;
                side_index += 1;
            }
        }
    }
    shared
}

/// One cell per base line × side line; reading past the last row or column gives 0.
struct Table {
    rows: Vec<Vec<usize>>,
}

impl Table {
    fn at(&self, row: usize, column: usize) -> usize {
        self.rows
            .get(row)
            .and_then(|cells| cells.get(column))
            .copied()
            .unwrap_or(0)
    }

    fn set(&mut self, row: usize, column: usize, value: usize) {
        if let Some(cell) = self
            .rows
            .get_mut(row)
            .and_then(|cells| cells.get_mut(column))
        {
            *cell = value;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pairs(base: &[&str], side: &[&str]) -> Vec<(u32, u32)> {
        line_pairs(base, side)
            .iter()
            .map(|pair| (pair.base, pair.side))
            .collect()
    }

    #[test]
    fn a_repeated_word_is_shared_as_often_as_both_lines_hold_it() {
        assert_eq!(shared_count(&["a", "a", "b"], &["a", "b", "b"]), 2);
        assert_eq!(shared_count(&["a", "b", "b"], &["a", "a", "b"]), 2);
        assert_eq!(shared_count(&["a", "a"], &["a", "a", "a"]), 2);
    }

    #[test]
    fn lines_equal_but_for_whitespace_pair_in_order() {
        let base = ["\t\tx();\n", "\t\t}\n", "\t}\n"];
        let side = ["\tx();\n", "\t}\n", "}\n"];
        assert_eq!(pairs(&base, &side), [(0, 0), (1, 1), (2, 2)]);
    }

    #[test]
    fn a_new_line_between_similar_lines_stays_unpaired() {
        let base = ["a(1);\n", "b(1);\n"];
        let side = ["a(2);\n", "log();\n", "b(2);\n"];
        assert_eq!(pairs(&base, &side), [(0, 0), (1, 2)]);
    }

    #[test]
    fn a_split_line_pairs_with_the_piece_sharing_more_words() {
        assert_eq!(pairs(&["foo(a, b)\n"], &["foo(a,\n", "\tb)\n"]), [(0, 0)]);
        assert_eq!(pairs(&["foo(a,\n", "\tb)\n"], &["foo(a, b)\n"]), [(0, 0)]);
    }

    #[test]
    fn lines_sharing_only_a_keyword_do_not_pair() {
        let base = ["if (!options.setupBindings.has(macro)) {\n"];
        let side = ["if (scriptSetupRanges.defineModel.length) {\n"];
        assert_eq!(pairs(&base, &side), []);
    }

    #[test]
    fn lines_without_words_compare_their_other_characters() {
        assert_eq!(pairs(&["}\n"], &["};\n"]), [(0, 0)]);
        assert_eq!(pairs(&["}\n"], &["{\n"]), []);
    }

    #[test]
    fn a_wordless_line_pairs_with_a_worded_one_by_words_and_symbols() {
        assert_eq!(pairs(&["}\n"], &["} else {\n"]), [(0, 0)]);
        assert_eq!(pairs(&["} else {\n"], &["}\n"]), [(0, 0)]);
        assert_eq!(pairs(&["});\n"], &["}, { passive });\n"]), [(0, 0)]);
        assert_eq!(pairs(&["});\n"], &["foo(a, b);\n"]), []);
    }

    #[test]
    fn a_wordless_line_pairs_only_when_it_occurs_inside_the_worded_one() {
        assert_eq!(pairs(&["});\n"], &["bar();\n"]), []);
        assert_eq!(pairs(&["bar();\n"], &["});\n"]), []);
        assert_eq!(pairs(&["},\n"], &["foo,\n"]), []);
        assert_eq!(pairs(&["foo,\n"], &["},\n"]), []);
        assert_eq!(pairs(&["} ;\n"], &["};\tx\n"]), [(0, 0)]);
        assert_eq!(pairs(&["};\tx\n"], &["} ;\n"]), [(0, 0)]);
    }

    #[test]
    fn half_of_the_words_shared_is_enough_to_pair() {
        assert_eq!(pairs(&["return a;\n"], &["return b;\n"]), [(0, 0)]);
        assert_eq!(pairs(&["a b c\n"], &["a d e\n"]), []);
    }

    #[test]
    fn a_gap_over_the_combination_cap_pairs_nothing_but_one_at_the_cap_does() {
        let base: Vec<String> = (0..101).map(|line| format!("x = {line};\n")).collect();
        let side: Vec<String> = (0..100).map(|line| format!("x = {line}a;\n")).collect();
        let mut base: Vec<&str> = base.iter().map(String::as_str).collect();
        let mut side: Vec<&str> = side.iter().map(String::as_str).collect();
        base.push("end\n");
        side.push("\tend\n");
        assert_eq!(pairs(&base, &side), [(101, 100)]);
        assert_eq!(pairs(&base[1..], &side).len(), 101);
    }
}

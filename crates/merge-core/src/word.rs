use std::ops::Range;

use imara_diff::{Algorithm, Diff, InternedInput};
use serde::Serialize;
use specta::Type;

use crate::chunk::{Chunk, ChunkId};
use crate::line::{BaseLine, InlineRange, LocalLine, RemoteLine, lines_in, split_lines};

/// Where one chunk's sides differ from base, word by word. `base` marks the base text that
/// either side changed (the union).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct WordChanges {
    /// The chunk these ranges belong to.
    pub chunk: ChunkId,
    /// Changed text in the chunk's local lines.
    pub local: Vec<InlineRange<LocalLine>>,
    /// Base text changed by local, remote or both.
    pub base: Vec<InlineRange<BaseLine>>,
    /// Changed text in the chunk's remote lines.
    pub remote: Vec<InlineRange<RemoteLine>>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CharKind {
    Word,
    Space,
    Symbol,
}

#[derive(Clone, Copy)]
enum TokenKind {
    Text(CharKind),
    LineBreak,
}

struct Token<'a> {
    text: &'a str,
    kind: TokenKind,
    line: u32,
    column: u32,
    width: u32,
}

struct ChunkText<'a> {
    lines: &'a [&'a str],
    first_line: u32,
    tokens: Vec<Token<'a>>,
}

impl<'a> ChunkText<'a> {
    fn new(all_lines: &'a [&'a str], range: &Range<u32>) -> ChunkText<'a> {
        let lines = lines_in(all_lines, range);
        ChunkText {
            lines,
            first_line: range.start,
            tokens: tokens(lines, range.start),
        }
    }

    fn token_span(&self, lines: &Range<u32>) -> Range<usize> {
        let start = self.first_line + lines.start;
        let end = self.first_line + lines.end;
        self.tokens.partition_point(|token| token.line < start)
            ..self.tokens.partition_point(|token| token.line < end)
    }
}

/// One entry per chunk, in the order of `chunks`.
#[must_use]
pub fn word_changes(base: &str, local: &str, remote: &str, chunks: &[Chunk]) -> Vec<WordChanges> {
    let base_lines = split_lines(base);
    let local_lines = split_lines(local);
    let remote_lines = split_lines(remote);
    let mut changes = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        let base = ChunkText::new(&base_lines, &(chunk.base.start.0..chunk.base.end().0));
        let local = ChunkText::new(&local_lines, &(chunk.local.start.0..chunk.local.end().0));
        let remote = ChunkText::new(&remote_lines, &(chunk.remote.start.0..chunk.remote.end().0));
        let (base_by_local, local_changed) = changed_tokens(&base, &local);
        let (base_by_remote, remote_changed) = changed_tokens(&base, &remote);
        let base_changed: Vec<bool> = base_by_local
            .iter()
            .zip(&base_by_remote)
            .map(|(by_local, by_remote)| *by_local || *by_remote)
            .collect();
        changes.push(WordChanges {
            chunk: chunk.id,
            local: ranges(&local.tokens, &local_changed, LocalLine),
            base: ranges(&base.tokens, &base_changed, BaseLine),
            remote: ranges(&remote.tokens, &remote_changed, RemoteLine),
        });
    }
    changes
}

fn tokens<'a>(lines: &'a [&'a str], first_line: u32) -> Vec<Token<'a>> {
    let mut tokens = Vec::new();
    for (line, text) in (first_line..).zip(lines) {
        let (content, line_break) = split_line_break(text);
        let mut column = 0;
        let mut rest = content;
        while let Some(first) = rest.chars().next() {
            let kind = kind_of(first);
            let byte_len = match kind {
                CharKind::Word | CharKind::Space => rest
                    .find(|next| kind_of(next) != kind)
                    .unwrap_or(rest.len()),
                CharKind::Symbol => first.len_utf8(),
            };
            let (text, after) = rest.split_at(byte_len);
            let width = utf16_len(text);
            tokens.push(Token {
                text,
                kind: TokenKind::Text(kind),
                line,
                column,
                width,
            });
            column += width;
            rest = after;
        }
        if !line_break.is_empty() {
            tokens.push(Token {
                text: line_break,
                kind: TokenKind::LineBreak,
                line,
                column,
                width: utf16_len(line_break),
            });
        }
    }
    tokens
}

fn split_line_break(line: &str) -> (&str, &'static str) {
    if let Some(content) = line.strip_suffix("\r\n") {
        (content, "\r\n")
    } else if let Some(content) = line.strip_suffix('\n') {
        (content, "\n")
    } else {
        (line, "")
    }
}

fn kind_of(character: char) -> CharKind {
    if character.is_alphanumeric() || character == '_' {
        CharKind::Word
    } else if character.is_whitespace() {
        CharKind::Space
    } else {
        CharKind::Symbol
    }
}

fn utf16_len(text: &str) -> u32 {
    u32::try_from(text.encode_utf16().count()).unwrap_or(u32::MAX)
}

fn changed_tokens(base: &ChunkText, side: &ChunkText) -> (Vec<bool>, Vec<bool>) {
    let mut base_changed = vec![false; base.tokens.len()];
    let mut side_changed = vec![false; side.tokens.len()];
    if base.lines.is_empty() || side.lines.is_empty() {
        return (base_changed, side_changed);
    }
    let mut input = InternedInput::default();
    input.update_before(base.lines.iter().copied());
    input.update_after(side.lines.iter().copied());
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    for hunk in diff.hunks() {
        let base_span = base.token_span(&hunk.before);
        let side_span = side.token_span(&hunk.after);
        mark_changed_tokens(
            base.tokens.get(base_span.clone()).unwrap_or_default(),
            side.tokens.get(side_span.clone()).unwrap_or_default(),
            base_changed.get_mut(base_span).unwrap_or_default(),
            side_changed.get_mut(side_span).unwrap_or_default(),
        );
    }
    (base_changed, side_changed)
}

fn mark_changed_tokens(
    base: &[Token],
    side: &[Token],
    base_changed: &mut [bool],
    side_changed: &mut [bool],
) {
    if base.is_empty() || side.is_empty() {
        base_changed.fill(true);
        side_changed.fill(true);
        return;
    }
    let mut input = InternedInput::default();
    input.update_before(base.iter().map(|token| token.text));
    input.update_after(side.iter().map(|token| token.text));
    let diff = Diff::compute(Algorithm::Histogram, &input);
    for (index, changed) in (0..).zip(base_changed) {
        *changed = diff.is_removed(index);
    }
    for (index, changed) in (0..).zip(side_changed) {
        *changed = diff.is_added(index);
    }
}

fn ranges<L: Copy + PartialEq>(
    tokens: &[Token],
    changed: &[bool],
    line_of: fn(u32) -> L,
) -> Vec<InlineRange<L>> {
    let text_changed: Vec<bool> = tokens
        .iter()
        .zip(changed)
        .map(|(token, changed)| *changed && !matches!(token.kind, TokenKind::LineBreak))
        .collect();
    let mut ranges: Vec<InlineRange<L>> = Vec::new();
    for (index, (token, is_changed)) in tokens.iter().zip(&text_changed).enumerate() {
        let before = index
            .checked_sub(1)
            .and_then(|before| text_changed.get(before));
        let after = text_changed.get(index + 1);
        if !is_highlighted(
            token.kind,
            *is_changed,
            before == Some(&true),
            after == Some(&true),
        ) {
            continue;
        }
        let line = line_of(token.line);
        match ranges.last_mut() {
            Some(last) if last.line == line && last.start + last.len == token.column => {
                last.len += token.width;
            }
            Some(_) | None => ranges.push(InlineRange {
                line,
                start: token.column,
                len: token.width,
            }),
        }
    }
    ranges
}

fn is_highlighted(kind: TokenKind, is_changed: bool, before: bool, after: bool) -> bool {
    match kind {
        TokenKind::LineBreak => false,
        TokenKind::Text(CharKind::Word | CharKind::Symbol) => is_changed,
        TokenKind::Text(CharKind::Space) => is_changed || (before && after),
    }
}

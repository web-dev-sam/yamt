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
enum TokenKind {
    Word,
    Space,
    Symbol,
    LineBreak,
}

struct Token<'a> {
    text: &'a str,
    kind: TokenKind,
    line: u32,
    column: u32,
    width: u32,
}

/// One entry per chunk, in the order of `chunks`.
#[must_use]
pub fn word_changes(base: &str, local: &str, remote: &str, chunks: &[Chunk]) -> Vec<WordChanges> {
    let base_lines = split_lines(base);
    let local_lines = split_lines(local);
    let remote_lines = split_lines(remote);
    let mut changes = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        let base = tokens(&base_lines, &(chunk.base.start.0..chunk.base.end().0));
        let local = tokens(&local_lines, &(chunk.local.start.0..chunk.local.end().0));
        let remote = tokens(&remote_lines, &(chunk.remote.start.0..chunk.remote.end().0));
        let (base_by_local, local_changed) = changed_tokens(&base, &local);
        let (base_by_remote, remote_changed) = changed_tokens(&base, &remote);
        let base_changed: Vec<bool> = base_by_local
            .iter()
            .zip(&base_by_remote)
            .map(|(by_local, by_remote)| *by_local || *by_remote)
            .collect();
        changes.push(WordChanges {
            chunk: chunk.id,
            local: ranges(&local, &local_changed, LocalLine),
            base: ranges(&base, &base_changed, BaseLine),
            remote: ranges(&remote, &remote_changed, RemoteLine),
        });
    }
    changes
}

fn tokens<'a>(lines: &'a [&'a str], range: &Range<u32>) -> Vec<Token<'a>> {
    let mut tokens = Vec::new();
    for (line, text) in (range.start..).zip(lines_in(lines, range)) {
        let (content, line_break) = split_line_break(text);
        let mut column = 0;
        let mut rest = content;
        while let Some(first) = rest.chars().next() {
            let kind = kind_of(first);
            let byte_len = match kind {
                TokenKind::Word | TokenKind::Space => rest
                    .find(|next| kind_of(next) != kind)
                    .unwrap_or(rest.len()),
                TokenKind::Symbol | TokenKind::LineBreak => first.len_utf8(),
            };
            let (text, after) = rest.split_at(byte_len);
            let width = utf16_len(text);
            tokens.push(Token {
                text,
                kind,
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

fn kind_of(character: char) -> TokenKind {
    if character.is_alphanumeric() || character == '_' {
        TokenKind::Word
    } else if character.is_whitespace() {
        TokenKind::Space
    } else {
        TokenKind::Symbol
    }
}

fn utf16_len(text: &str) -> u32 {
    u32::try_from(text.encode_utf16().count()).unwrap_or(u32::MAX)
}

fn changed_tokens(base: &[Token], side: &[Token]) -> (Vec<bool>, Vec<bool>) {
    if base.is_empty() || side.is_empty() {
        return (vec![false; base.len()], vec![false; side.len()]);
    }
    let mut input = InternedInput::default();
    input.update_before(base.iter().map(|token| token.text));
    input.update_after(side.iter().map(|token| token.text));
    let diff = Diff::compute(Algorithm::Histogram, &input);
    let base_changed = (0..).zip(base).map(|(index, _)| diff.is_removed(index));
    let side_changed = (0..).zip(side).map(|(index, _)| diff.is_added(index));
    (base_changed.collect(), side_changed.collect())
}

fn ranges<L: Copy + PartialEq>(
    tokens: &[Token],
    changed: &[bool],
    line_of: fn(u32) -> L,
) -> Vec<InlineRange<L>> {
    let mut ranges: Vec<InlineRange<L>> = Vec::new();
    for (index, token) in tokens.iter().enumerate() {
        if !is_highlighted(tokens, changed, index) {
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

fn is_highlighted(tokens: &[Token], changed: &[bool], index: usize) -> bool {
    let Some(token) = tokens.get(index) else {
        return false;
    };
    match token.kind {
        TokenKind::LineBreak => false,
        TokenKind::Word | TokenKind::Symbol => is_changed_text(tokens, changed, Some(index)),
        TokenKind::Space => {
            is_changed_text(tokens, changed, Some(index))
                || (is_changed_text(tokens, changed, index.checked_sub(1))
                    && is_changed_text(tokens, changed, index.checked_add(1)))
        }
    }
}

fn is_changed_text(tokens: &[Token], changed: &[bool], index: Option<usize>) -> bool {
    let Some(index) = index else {
        return false;
    };
    let is_text = tokens
        .get(index)
        .is_some_and(|token| token.kind != TokenKind::LineBreak);
    is_text && changed.get(index).copied().unwrap_or(false)
}

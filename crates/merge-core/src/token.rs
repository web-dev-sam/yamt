#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TokenKind {
    Word,
    Space,
    Symbol,
}

/// A piece of one line's content: a run of word characters, a run of whitespace, or one other
/// character.
pub(crate) struct Token<'a> {
    pub(crate) text: &'a str,
    pub(crate) kind: TokenKind,
    pub(crate) column: u32,
    pub(crate) width: u32,
}

pub(crate) fn line_tokens(content: &str) -> Vec<Token<'_>> {
    let mut tokens = Vec::new();
    let mut column = 0;
    let mut rest = content;
    while let Some(first) = rest.chars().next() {
        let kind = kind_of(first);
        let byte_len = match kind {
            TokenKind::Word | TokenKind::Space => rest
                .find(|next| kind_of(next) != kind)
                .unwrap_or(rest.len()),
            TokenKind::Symbol => first.len_utf8(),
        };
        let (text, after) = rest.split_at(byte_len);
        let width = utf16_len(text);
        tokens.push(Token {
            text,
            kind,
            column,
            width,
        });
        column += width;
        rest = after;
    }
    tokens
}

pub(crate) fn without_line_break(line: &str) -> &str {
    line.strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line)
}

pub(crate) fn utf16_len(text: &str) -> u32 {
    u32::try_from(text.encode_utf16().count()).unwrap_or(u32::MAX)
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

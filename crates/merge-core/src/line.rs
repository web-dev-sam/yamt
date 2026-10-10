use std::ops::Range;

use serde::Serialize;
use specta::Type;

/// 0-based line index in the base text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Type)]
pub struct BaseLine(pub u32);

/// 0-based line index in the local text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Type)]
pub struct LocalLine(pub u32);

/// 0-based line index in the remote text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Type)]
pub struct RemoteLine(pub u32);

/// The lines `start .. start + len` of one text; built from a length, so it cannot be inverted.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct LineRange<L> {
    /// First line of the range, or the insertion point when the range is empty.
    pub start: L,
    /// Number of lines in the range.
    pub len: u32,
}

impl<L> LineRange<L> {
    /// Whether the range holds no lines (a pure insertion point).
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
}

impl LineRange<BaseLine> {
    /// First line after the range.
    #[must_use]
    pub fn end(&self) -> BaseLine {
        BaseLine(self.start.0 + self.len)
    }
}

impl LineRange<LocalLine> {
    /// First line after the range.
    #[must_use]
    pub fn end(&self) -> LocalLine {
        LocalLine(self.start.0 + self.len)
    }
}

impl LineRange<RemoteLine> {
    /// First line after the range.
    #[must_use]
    pub fn end(&self) -> RemoteLine {
        RemoteLine(self.start.0 + self.len)
    }
}

/// Changed text inside one line of one text: `len` UTF-16 code units from column `start`
/// (the unit of JavaScript strings and `CodeMirror` positions). Never contains a line break.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct InlineRange<L> {
    /// The line holding the range.
    pub line: L,
    /// Column of the first changed code unit.
    pub start: u32,
    /// Number of changed code units; never zero.
    pub len: u32,
}

/// A zero-width place inside one line of one text: `column` UTF-16 code units from the line's
/// start, at most the line's length without its line break.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct InlinePoint<L> {
    /// The line holding the point.
    pub line: L,
    /// Column of the point.
    pub column: u32,
}

pub(crate) fn split_lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

pub(crate) fn lines_in<'a>(lines: &'a [&'a str], range: &Range<u32>) -> &'a [&'a str] {
    lines
        .get(range.start as usize..range.end as usize)
        .unwrap_or_default()
}

pub(crate) fn without_line_break(line: &str) -> &str {
    line.strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line)
}

pub(crate) fn utf16_len(text: &str) -> u32 {
    u32::try_from(text.encode_utf16().count()).unwrap_or(u32::MAX)
}

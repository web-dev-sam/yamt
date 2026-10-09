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

pub(crate) fn split_lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

pub(crate) fn lines_in<'a>(lines: &'a [&'a str], range: &Range<u32>) -> &'a [&'a str] {
    lines
        .get(range.start as usize..range.end as usize)
        .unwrap_or_default()
}

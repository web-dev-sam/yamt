//! Pure diff model: three-way chunks for a merge, two-way differences for a compare.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod apply;
mod chunk;
mod compare;
mod compute;
mod line;
mod line_map;
mod line_pairs;
mod token;
mod word;

pub use apply::apply_non_conflicting;
pub use chunk::{Chunk, ChunkId, ChunkKind};
pub use compare::{Difference, DifferenceWords, LineChange, compare, line_changes};
pub use compute::{DEFAULT_GAP, Options, compute_chunks};
pub use line::{
    BaseLine, InlinePoint, InlineRange, LeftLine, LineRange, LocalLine, RemoteLine, RightLine,
};
pub use line_map::{LineMap, line_map};
pub use word::{Removal, SideWordChanges, WordChanges, word_changes};

/// The most bytes a text may hold to be shown: larger files are answered "too large", never diffed.
pub const MAX_TEXT_BYTES: usize = 8 * 1024 * 1024;

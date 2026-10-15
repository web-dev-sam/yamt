//! Pure three-way chunk model: base, local and remote text in, classified chunks out.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod apply;
mod chunk;
mod compute;
mod line;
mod line_map;
mod line_pairs;
mod token;
mod word;

pub use apply::apply_non_conflicting;
pub use chunk::{Chunk, ChunkId, ChunkKind};
pub use compute::{DEFAULT_GAP, Options, compute_chunks};
pub use line::{BaseLine, InlinePoint, InlineRange, LineRange, LocalLine, RemoteLine};
pub use line_map::{LineMap, line_map};
pub use word::{Removal, SideWordChanges, WordChanges, word_changes};
